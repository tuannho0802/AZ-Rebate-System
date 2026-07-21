'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import {
  getConfigChildren,
  setConfigTotal,
  updateConfigTotal,
  CommissionConfigSelf,
  CommissionConfigChild,
} from '../lib/api/commission-config';
import { Dialog, FormError } from './ui/Dialog';
import {
  ActiveBadge,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  InfoBanner,
  Loading,
  Select,
  Table,
  Th,
  Td,
} from './ui/primitives';
import SearchableSelect from './ui/SearchableSelect';
import BulkAssetConfigDialog from './BulkAssetConfigDialog';
import ManageTemplateLockDialog from './ManageTemplateLockDialog';
import { User, listUsers, createDirectChild, updateUser } from '../lib/api/user';
import { Asset, listAssets } from '../lib/api/admin';
import { Template, listTemplates, listVisibleTemplates, applyTemplate } from '../lib/api/template';

/**
 * Dùng chung cho cả MIB và IB. Quy tắc vàng (đã enforce ở backend, component
 * này chỉ cung cấp UI đúng luồng, KHÔNG tự ý nới quyền):
 *   - Chỉ CHA TRỰC TIẾP (chính actor) mới CRUD được tài khoản / commission
 *     config của CON TRỰC TIẾP (LvN+1). Không "quản lý hộ" cháu/chắt.
 *   - Actor KHÔNG tự sửa được tài khoản hoặc config của chính mình — nếu cần,
 *     phải nhờ cấp cao hơn (Admin, hoặc cha trực tiếp của actor).
 */
export default function CommissionManager() {
  const { user } = useAuth();
  const ownId = user?.sub;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [directChildren, setDirectChildren] = useState<User[]>([]);
  const [selfInfo, setSelfInfo] = useState<CommissionConfigSelf | null>(null);
  const [childrenConfig, setChildrenConfig] = useState<Map<string, CommissionConfigChild>>(new Map());
  const [loadingChildren, setLoadingChildren] = useState(false);

  // ---- Dialog visibility state ----
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<User | null>(null);
  const [configDialogChild, setConfigDialogChild] = useState<User | null>(null);
  const [bulkConfigChild, setBulkConfigChild] = useState<User | null>(null);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [lockTemplateOpen, setLockTemplateOpen] = useState(false);

  // ---- Load Assets + Templates (created by Admin, reused here) ----
  useEffect(() => {
    if (!ownId) return;
    let cancelled = false;

    const loadLookups = async () => {
      setLoadingLookups(true);
      try {
        const res = await listAssets();
        if (!cancelled) setAssets(res ?? []);
      } catch (error: any) {
        if (!cancelled) setAssetsError(error.message ?? 'Failed to load assets');
      }

      try {
        const res = await listVisibleTemplates();
        if (!cancelled) setTemplates(res ?? []);
      } catch (error: any) {
        if (!cancelled) setTemplatesError(error.message ?? 'Failed to load templates');
      }

      if (!cancelled) setLoadingLookups(false);
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [ownId]);

  // Auto-pick the first asset once loaded, so the tables aren't empty on arrival
  useEffect(() => {
    if (!selectedAssetId && assets.length > 0) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // ---- Load direct children account list (asset-independent) ----
  const loadDirectChildrenAccounts = async () => {
    if (!ownId) return;
    try {
      // Backend lọc trực tiếp qua ?parentId= — không còn tự lọc client-side từ
      // 1 trang /users giới hạn (an toàn hơn khi subtree có >100 user, tránh
      // thiếu con trực tiếp âm thầm nếu chỉ lấy đúng 1 trang rồi filter tay).
      const res = await listUsers({ parentId: ownId, limit: 100 });
      setDirectChildren(res ?? []);
    } catch (error) {
      console.error('Failed to load direct children accounts:', error);
    }
  };

  useEffect(() => {
    loadDirectChildrenAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownId]);

  // ---- Load commission config (self + direct children) for selected asset ----
  const loadChildrenConfig = async (assetId: string) => {
    if (!ownId || !assetId) return;
    setLoadingChildren(true);
    try {
      const data = await getConfigChildren(ownId, assetId);
      setSelfInfo(data.self);
      const map = new Map<string, CommissionConfigChild>();
      for (const c of data.children) map.set(c.userId, c);
      setChildrenConfig(map);
    } catch (error: any) {
      alert(`Failed to load commission config: ${error.message}`);
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    if (selectedAssetId) loadChildrenConfig(selectedAssetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId, ownId]);

  const refreshAll = () => {
    loadDirectChildrenAccounts();
    if (selectedAssetId) loadChildrenConfig(selectedAssetId);
  };

  // ---- Account CRUD (direct children only) ----
  const handleCreateChild = async (dto: { email: string; password: string; fullName: string }) => {
    if (!ownId) return;
    await createDirectChild({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName || undefined,
      parentId: ownId,
    });
    setCreateChildOpen(false);
    refreshAll();
  };

  const handleEditAccountSubmit = async (dto: { fullName: string; isActive: boolean }) => {
    if (!editingAccount) return;
    await updateUser(editingAccount.id, dto);
    setEditingAccount(null);
    refreshAll();
  };

  // ---- Single-asset config (create-or-update in one dialog) ----
  // [SUA] MIB/IB chỉ được nhập 1 số tổng (transferUnit) — gửi rebateUnit/markupPips
  // riêng lẻ sẽ bị backend trả 403 (ForbiddenException, xem commission-config.service.ts).
  const handleSetConfig = async (dto: { transferUnit: number }) => {
    if (!configDialogChild || !selectedAssetId) return;
    const existing = childrenConfig.get(configDialogChild.id);
    if (existing?.version != null) {
      // Đã có config — dùng update kèm version cho optimistic lock.
      await updateConfigTotal(configDialogChild.id, selectedAssetId, {
        transferUnit: dto.transferUnit,
        version: existing.version,
      });
    } else {
      await setConfigTotal({
        userId: configDialogChild.id,
        assetId: selectedAssetId,
        transferUnit: dto.transferUnit,
      });
    }
    setConfigDialogChild(null);
    loadChildrenConfig(selectedAssetId);
  };

  // Dùng thẳng endpoint thật POST /templates/:templateId/apply/:userId — chạy
  // trong 1 transaction ở backend (xem template-apply.service.ts), rollback
  // toàn bộ nếu 1 asset lỗi (vd vượt cap).
  const handleApplyTemplate = async (templateId: string, targetUserId: string) => {
    const applied = await applyTemplate(templateId, targetUserId);
    setApplyTemplateOpen(false);
    if (selectedAssetId) loadChildrenConfig(selectedAssetId);
    return applied.length;
  };

  if (!ownId) return null;

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  return (
    <div className="space-y-6 mt-6">
      <InfoBanner>
        <strong>Quy tắc:</strong> bạn chỉ quản lý được tài khoản và cấu hình <strong>MaxPips</strong> (tổng nhận) cho{' '}
        <strong>con trực tiếp</strong> của chính mình — không quản lý hộ cháu/chắt. Cấu hình của{' '}
        <strong>chính bạn</strong> chỉ được set bởi cấp cao hơn (Admin hoặc cha trực tiếp của bạn).
      </InfoBanner>

      {/* Asset selector + self cap */}
      <Card title="Asset đang xem" description="Chọn asset để xem/sửa cấu hình MaxPips cho con trực tiếp.">
        {loadingLookups && <p className="text-sm text-slate-400 mb-3">Đang tải danh sách asset/template...</p>}
        {assetsError && (
          <p className="text-sm text-rose-600 mb-3">
            Không tải được danh sách Asset ({assetsError}) — có thể route <code>/admin/assets</code> đang chặn
            non-Admin, cần backend mở quyền đọc (GET) cho MIB/IB.
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-full sm:w-72">
            <Select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
              <option value="">-- Select Asset --</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} ({a.name})
                </option>
              ))}
            </Select>
          </div>

          {selfInfo && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
              <span className="text-xs text-slate-500">Cấu hình của bạn ({selfInfo.email}):</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                MaxPips {selfInfo.transferUnit ?? '—'}
              </span>
              <Badge tone="indigo">trần cho con</Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Direct children table: account info + commission config combined */}
      <Card
        title="Con trực tiếp của bạn"
        description={selectedAsset ? `Đang xem cấu hình cho asset ${selectedAsset.code}` : undefined}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setLockTemplateOpen(true)}>
              Khóa/Mở khóa Template
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setApplyTemplateOpen(true)}>
              Áp dụng Template
            </Button>
            <Button size="sm" onClick={() => setCreateChildOpen(true)}>
              + Tạo tài khoản con
            </Button>
          </>
        }
      >
        {loadingChildren && <Loading label="Đang tải cấu hình..." />}
        {!loadingChildren && directChildren.length === 0 ? (
          <EmptyState icon="👤" title="Chưa có con trực tiếp nào" description='Bấm "+ Tạo tài khoản con" để bắt đầu.' />
        ) : (
          !loadingChildren && (
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th className="hidden md:table-cell">Họ tên</Th>
                  <Th>Trạng thái</Th>
                  <Th>MaxPips</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {directChildren.map((child) => {
                  const cfg = childrenConfig.get(child.id);
                  const hasConfig = cfg?.transferUnit != null;
                  return (
                    <tr key={child.id} className="hover:bg-slate-50/70">
                      <Td className="font-medium text-slate-900">{child.email}</Td>
                      <Td className="hidden md:table-cell">{child.fullName || <span className="text-slate-300">—</span>}</Td>
                      <Td>
                        <ActiveBadge active={child.isActive} />
                      </Td>
                      <Td mono>{cfg?.transferUnit ?? <span className="font-sans text-slate-300">chưa set</span>}</Td>
                      <Td className="text-right whitespace-nowrap">
                        <div className="inline-flex gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setEditingAccount(child)}>
                            Sửa TK
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-indigo-600"
                            disabled={!selectedAssetId}
                            title={!selectedAssetId ? 'Chọn Asset trước' : ''}
                            onClick={() => setConfigDialogChild(child)}
                          >
                            {hasConfig ? 'Sửa Config' : '+ Set Config'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setBulkConfigChild(child)}>
                            Nhiều Asset
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )
        )}
      </Card>

      {/* ---------------- Dialogs ---------------- */}

      <CreateChildDialog open={createChildOpen} onClose={() => setCreateChildOpen(false)} onSave={handleCreateChild} />

      {editingAccount && (
        <EditAccountDialog
          user={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={handleEditAccountSubmit}
        />
      )}

      {configDialogChild && selectedAssetId && (
        <SetConfigDialog
          child={configDialogChild}
          assetLabel={selectedAsset ? `${selectedAsset.code} — ${selectedAsset.name}` : ''}
          existing={childrenConfig.get(configDialogChild.id) ?? null}
          selfCap={selfInfo}
          onClose={() => setConfigDialogChild(null)}
          onSave={handleSetConfig}
        />
      )}

      <BulkAssetConfigDialog
        open={!!bulkConfigChild}
        onClose={() => setBulkConfigChild(null)}
        ownId={ownId}
        targetUser={bulkConfigChild}
        assets={assets}
        templates={templates}
        onDone={() => {
          setBulkConfigChild(null);
          if (selectedAssetId) loadChildrenConfig(selectedAssetId);
        }}
      />

      <ApplyTemplateDialog
        open={applyTemplateOpen}
        onClose={() => setApplyTemplateOpen(false)}
        templates={templates}
        templatesError={templatesError}
        directChildren={directChildren}
        onApply={handleApplyTemplate}
      />

      <ManageTemplateLockDialog
        open={lockTemplateOpen}
        onClose={() => setLockTemplateOpen(false)}
        templates={templates}
        directChildren={directChildren}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small dialogs local to CommissionManager                            */
/* ------------------------------------------------------------------ */

function CreateChildDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (dto: { email: string; password: string; fullName: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({ email, password, fullName });
      reset();
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo tài khoản con mới (IB)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="submit" form="create-child-form" disabled={loading}>
            {loading ? 'Đang tạo...' : 'Tạo con trực tiếp'}
          </Button>
        </>
      }
    >
      <form id="create-child-form" onSubmit={submit} className="space-y-4">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
        </Field>
        <Field label="Mật khẩu" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
        </Field>
        <Field label="Họ tên">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}

function EditAccountDialog({
  user,
  onClose,
  onSave,
}: {
  user: { email: string; fullName?: string | null; isActive: boolean };
  onClose: () => void;
  onSave: (dto: { fullName: string; isActive: boolean }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({ fullName, isActive });
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Sửa tài khoản: ${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Huỷ
          </Button>
          <Button type="submit" form="edit-account-form" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="edit-account-form" onSubmit={submit} className="space-y-4">
        <Field label="Họ tên">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Tài khoản đang hoạt động
        </label>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}

function SetConfigDialog({
  child,
  assetLabel,
  existing,
  selfCap,
  onClose,
  onSave,
}: {
  child: { email: string };
  assetLabel: string;
  existing: CommissionConfigChild | null;
  selfCap: CommissionConfigSelf | null;
  onClose: () => void;
  onSave: (dto: { transferUnit: number }) => Promise<void>;
}) {
  const [transferUnit, setTransferUnit] = useState(existing?.transferUnit != null ? String(existing.transferUnit) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({ transferUnit: parseFloat(transferUnit) || 0 });
    } catch (err: any) {
      if (err.status === 409) {
        setError('Dữ liệu đã bị đổi bởi người khác. Đóng form, mở lại để lấy version mới nhất rồi thử lại.');
      } else {
        setError(err?.body?.message || err?.message || 'Lỗi không xác định');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${existing ? 'Sửa' : 'Set'} Config — ${child.email}`}
      description={`Asset: ${assetLabel}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Huỷ
          </Button>
          <Button type="submit" form="set-config-form" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="set-config-form" onSubmit={submit} className="space-y-4">
        {selfCap && (
          <p className="text-xs text-slate-400">
            Trần của bạn cho asset này (MaxPips): {selfCap.transferUnit ?? '—'}
          </p>
        )}
        <Field label="MaxPips (tổng nhận)" required>
          <Input type="number" min="0" step="0.0001" value={transferUnit} onChange={(e) => setTransferUnit(e.target.value)} required disabled={loading} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}

function ApplyTemplateDialog({
  open,
  onClose,
  templates,
  templatesError,
  directChildren,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  templatesError: string | null;
  directChildren: User[];
  onApply: (templateId: string, targetUserId: string) => Promise<number>;
}) {
  const [templateId, setTemplateId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!templateId || !targetUserId) {
      setError('Vui lòng chọn Template và User (con trực tiếp)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const count = await onApply(templateId, targetUserId);
      alert(`Áp dụng Template thành công cho ${count} asset!`);
      setTemplateId('');
      setTargetUserId('');
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Áp dụng thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Áp dụng Template cho con trực tiếp"
      description="Chạy trong 1 transaction ở backend — nếu 1 asset vượt cap, toàn bộ request rollback."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Đóng
          </Button>
          <Button variant="success" onClick={submit} disabled={loading}>
            {loading ? 'Đang áp dụng...' : 'Áp dụng Template'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {templatesError && (
          <p className="text-sm text-rose-600">
            Không tải được danh sách Template ({templatesError}) — có thể route <code>/admin/templates</code> đang
            chặn non-Admin.
          </p>
        )}
        <Field label="Template" required>
          <SearchableSelect
            options={[...templates]
              .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
              .map((t) => ({
                id: t.id,
                label: t.name,
                sublabel: `${t.items?.length ?? 0} asset`,
                ...(t.level !== undefined && t.level !== null ? { tag: `Cấp ${t.level}` } : {}),
              }))}
            value={templateId}
            onChange={setTemplateId}
            placeholder="Chọn Template..."
          />
        </Field>
        <Field label="Con trực tiếp" required>
          <SearchableSelect
            options={directChildren.map((c) => ({
              id: c.id,
              label: c.fullName ? `${c.fullName} (${c.email})` : c.email,
              sublabel: c.email,
            }))}
            value={targetUserId}
            onChange={setTargetUserId}
            placeholder="Chọn con trực tiếp..."
          />
        </Field>
        <FormError>{error}</FormError>
      </div>
    </Dialog>
  );
}