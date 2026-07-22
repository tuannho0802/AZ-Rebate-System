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
import {
  Badge,
  Card,
  InfoBanner,
  Select,
} from './ui/primitives';
import ManageTemplateLockDialog from './ManageTemplateLockDialog';
import { User, listUsers, createDirectChild } from '../lib/api/user';
import { Asset, listAssets } from '../lib/api/admin';
import { Template, listTemplates, listVisibleTemplates, applyTemplate } from '../lib/api/template';
import {
  CreateChildDialog,
  ApplyTemplateDialog,
  DirectChildrenTable,
} from './commission-manager';

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
      <DirectChildrenTable
        directChildren={directChildren}
        childrenConfig={childrenConfig}
        selectedAsset={selectedAsset}
        selectedAssetId={selectedAssetId}
        loadingChildren={loadingChildren}
        rolePath={user.role === 'MIB' ? 'mib' : 'ib'}
        onCreateChild={() => setCreateChildOpen(true)}
        onOpenApplyTemplate={() => setApplyTemplateOpen(true)}
        onOpenLockTemplate={() => setLockTemplateOpen(true)}
      />

      {/* ---------------- Dialogs ---------------- */}

      <CreateChildDialog open={createChildOpen} onClose={() => setCreateChildOpen(false)} onSave={handleCreateChild} />

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