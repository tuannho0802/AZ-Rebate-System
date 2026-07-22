'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api-client';
import {
  getConfigTree,
  getConfigChildren,
  upsertConfig,
  updateConfig,
  CommissionConfigTreeNode,
  CommissionConfigChildrenResponse,
  CommissionConfigChild,
} from '@/lib/api/commission-config';
import {
  Card,
  Button,
  Field,
  Input,
  Table,
  Th,
  Td,
  Badge,
  Loading,
} from '@/components/ui/primitives';
import { FormError } from '@/components/ui/Dialog';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface Asset {
  id: string;
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

interface EditContext {
  userId: string;
  assetId: string;
  version: number;
  userLabel: string;
  assetLabel: string;
}

export default function AdminCommissionConfigsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'tree' | 'children'>('tree');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [treeData, setTreeData] = useState<CommissionConfigTreeNode | null>(null);
  const [childrenData, setChildrenData] = useState<CommissionConfigChildrenResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Form State (Single dynamically changing card form)
  const [formUserId, setFormUserId] = useState('');
  const [formAssetId, setFormAssetId] = useState('');
  const [rebateUnit, setRebateUnit] = useState('');
  const [markupPips, setMarkupPips] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Optimistic lock edit context
  const [editContext, setEditContext] = useState<EditContext | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;

    let cancelled = false;

    const loadLookups = async () => {
      setLoadingLookups(true);
      try {
        const assetsRes = await api.get<Asset[] | { data: Asset[] }>('/admin/assets');
        const assetsList = Array.isArray(assetsRes) ? assetsRes : assetsRes.data;
        if (!cancelled) setAssets(assetsList ?? []);
      } catch (error) {
        console.error('Failed to load assets:', error);
      }

      try {
        const usersRes = await api.get<UserOption[] | { data: UserOption[] }>('/users?limit=100');
        const usersList = Array.isArray(usersRes) ? usersRes : usersRes.data;
        if (!cancelled) setUserOptions(usersList ?? []);
      } catch (error) {
        console.error('Failed to load users:', error);
      }

      if (!cancelled) setLoadingLookups(false);
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading]);

  const loadTree = async (userId: string, assetId: string) => {
    setViewLoading(true);
    try {
      const data = await getConfigTree(userId, assetId);
      setTreeData(data);
    } catch (error: any) {
      alert(`Failed to load tree: ${error.message}`);
      setTreeData(null);
    } finally {
      setViewLoading(false);
    }
  };

  const loadChildren = async (userId: string, assetId: string) => {
    setViewLoading(true);
    try {
      const data = await getConfigChildren(userId, assetId);
      setChildrenData(data);
    } catch (error: any) {
      alert(`Failed to load children: ${error.message}`);
      setChildrenData(null);
    } finally {
      setViewLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedUserId || !selectedAssetId) return;
    if (activeTab === 'tree') {
      loadTree(selectedUserId, selectedAssetId);
    } else {
      loadChildren(selectedUserId, selectedAssetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, selectedAssetId, activeTab]);

  const resetForm = () => {
    setFormUserId('');
    setFormAssetId('');
    setRebateUnit('');
    setMarkupPips('');
    setEditContext(null);
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editContext) {
      // Edit Config Mode
      setFormLoading(true);
      setFormError(null);
      try {
        const updated = await updateConfig(editContext.userId, editContext.assetId, {
          rebateUnit: rebateUnit ? parseFloat(rebateUnit) : undefined,
          markupPips: markupPips ? parseFloat(markupPips) : undefined,
          version: editContext.version,
        });
        alert(`Cập nhật thành công! (version mới: ${updated.version})`);
        const { userId: doneUserId, assetId: doneAssetId } = editContext;
        resetForm();
        if (selectedUserId === doneUserId && selectedAssetId === doneAssetId) {
          activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
        }
      } catch (error: any) {
        if (error.status === 409) {
          setFormError('Dữ liệu đã bị người khác cập nhật. Vui lòng bấm "Sửa" lại trên bảng để lấy dữ liệu mới nhất!');
        } else {
          setFormError(error?.body?.message || error.message || 'Lỗi cập nhật cấu hình');
        }
      } finally {
        setFormLoading(false);
      }
    } else {
      // Create Config Mode
      if (!formUserId || !formAssetId) {
        setFormError('Vui lòng chọn User và Asset');
        return;
      }
      setFormLoading(true);
      setFormError(null);
      try {
        const created = await upsertConfig({
          userId: formUserId,
          assetId: formAssetId,
          rebateUnit: parseFloat(rebateUnit) || 0,
          markupPips: parseFloat(markupPips) || 0,
        });
        alert(`Cấu hình được lưu thành công! (phiên bản: ${created.version})`);
        const doneUserId = formUserId;
        const doneAssetId = formAssetId;
        resetForm();
        if (selectedUserId === doneUserId && selectedAssetId === doneAssetId) {
          activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
        }
      } catch (error: any) {
        setFormError(error?.body?.message || error.message || 'Lỗi lưu cấu hình');
      } finally {
        setFormLoading(false);
      }
    }
  };

  const startEdit = (node: { userId: string; email: string; version: number | null; rebateUnit?: number | null; markupPips?: number | null }) => {
    if (!selectedAssetId || node.version == null) return;
    const asset = assets.find((a) => a.id === selectedAssetId);
    setEditContext({
      userId: node.userId,
      assetId: selectedAssetId,
      version: node.version,
      userLabel: node.email,
      assetLabel: asset ? `${asset.code} (${asset.name})` : selectedAssetId,
    });
    setFormUserId(node.userId);
    setFormAssetId(selectedAssetId);
    setRebateUnit(node.rebateUnit != null ? String(node.rebateUnit) : '');
    setMarkupPips(node.markupPips != null ? String(node.markupPips) : '');
    setFormError(null);
    document.getElementById('config-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const startCreate = (node: { userId: string; email: string }) => {
    if (!selectedAssetId) return;
    resetForm();
    setFormUserId(node.userId);
    setFormAssetId(selectedAssetId);
    document.getElementById('config-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const userLabel = (u: UserOption) => `${u.role} — ${u.fullName ?? u.email} (${u.email})`;

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <div className="space-y-6">
      {/* Selection Card */}
      <Card title="Cấu hình hoa hồng hệ thống" description="Chọn sản phẩm và tài khoản gốc để hiển thị sơ đồ phân cấp hoa hồng.">
        {loadingLookups && <p className="text-sm text-slate-400 mb-2">Đang tải danh sách asset/user...</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Sản phẩm (Asset)">
            <SearchableSelect
              options={assets.map((a) => ({
                id: a.id,
                label: `${a.code} — ${a.name}`,
                sublabel: a.code,
              }))}
              value={selectedAssetId}
              onChange={setSelectedAssetId}
              placeholder="Chọn Asset..."
            />
          </Field>
          <Field label="Tài khoản gốc (User)">
            <SearchableSelect
              options={userOptions.map((u) => ({
                id: u.id,
                label: userLabel(u),
                sublabel: u.email,
                tag: u.role,
              }))}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Chọn User..."
            />
          </Field>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('tree')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'tree'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Cây phân cấp (Full Tree)
        </button>
        <button
          onClick={() => setActiveTab('children')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'children'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Con trực tiếp (Direct Children)
        </button>
      </div>

      {/* View Data */}
      {viewLoading ? (
        <Loading label="Đang tải dữ liệu cấu hình..." />
      ) : (
        <>
          {activeTab === 'tree' && treeData && (
            <Card title={`Sơ đồ hoa hồng của ${treeData.email}`} description="Hiển thị rebate/markup kế thừa từ cấp trên xuống dưới.">
              <div className="space-y-1">
                <TreeDisplay node={treeData} onEdit={startEdit} onCreate={startCreate} />
              </div>
            </Card>
          )}

          {activeTab === 'children' && childrenData && (
            <Card title="Cấu hình tài khoản và con trực tiếp" description="Danh sách chi tiết các tài khoản trực thuộc.">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    Cấu hình của chính bạn (Self)
                    {childrenData.self.version != null && (
                      <Badge tone="indigo">v{childrenData.self.version}</Badge>
                    )}
                  </h3>
                  <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                    <span>Rebate Unit: <strong className="text-slate-700">{childrenData.self.rebateUnit ?? 'N/A'}</strong></span>
                    <span>Markup Pips: <strong className="text-slate-700">{childrenData.self.markupPips ?? 'N/A'}</strong></span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={childrenData.self.version != null ? 'secondary' : 'success'}
                  onClick={() =>
                    childrenData.self.version != null
                      ? startEdit(childrenData.self)
                      : startCreate(childrenData.self)
                  }
                >
                  {childrenData.self.version != null ? 'Sửa' : '+ Tạo'}
                </Button>
              </div>

              <Table>
                <thead>
                  <tr>
                    <Th>Email</Th>
                    <Th>Vai trò</Th>
                    <Th>Kích hoạt</Th>
                    <Th>Rebate Unit</Th>
                    <Th>Markup Pips</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {childrenData.children.map((c: CommissionConfigChild) => (
                    <tr key={c.userId} className="hover:bg-slate-50/50">
                      <Td className="font-medium text-slate-800">{c.email}</Td>
                      <Td>
                        <Badge tone={c.role === 'MIB' ? 'violet' : 'blue'}>{c.role}</Badge>
                      </Td>
                      <Td>
                        {c.isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                      </Td>
                      <Td mono>{c.rebateUnit ?? 'N/A'}</Td>
                      <Td mono>
                        {c.markupPips ?? 'N/A'}
                        {c.version != null && (
                          <span className="text-[10px] text-slate-400 ml-1.5">(v{c.version})</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant={c.version != null ? 'secondary' : 'success'}
                          onClick={() => (c.version != null ? startEdit(c) : startCreate(c))}
                        >
                          {c.version != null ? 'Sửa' : '+ Tạo'}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Combined Dynamic Form Card */}
      <div id="config-form-card">
        <Card
          title={editContext ? 'Cập nhật cấu hình hoa hồng' : 'Thiết lập cấu hình mới'}
          description={
            editContext
              ? `Chỉnh sửa cấu hình rebate/markup đã có cho ${editContext.userLabel}.`
              : 'Tạo mới hoặc ghi đè config rebate/markup cho 1 cặp User + Asset.'
          }
          actions={
            editContext ? (
              <Button size="sm" variant="ghost" onClick={resetForm} disabled={formLoading}>
                Hủy chế độ sửa
              </Button>
            ) : undefined
          }
        >
          <form onSubmit={handleFormSubmit} className="space-y-4 max-w-2xl">
            {editContext ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200/60 rounded-xl p-4">
                <div>
                  <span className="text-slate-400">Tài khoản con: </span>
                  <span className="font-semibold text-slate-800">{editContext.userLabel}</span>
                </div>
                <div>
                  <span className="text-slate-400">Sản phẩm: </span>
                  <span className="font-semibold text-slate-800">{editContext.assetLabel}</span>
                </div>
                {editContext.version != null && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Mã phiên bản (optimistic lock): </span>
                    <Badge tone="indigo">Phiên bản {editContext.version}</Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tài khoản con (User)" required>
                  <SearchableSelect
                    options={userOptions.map((u) => ({
                      id: u.id,
                      label: userLabel(u),
                      sublabel: u.email,
                      tag: u.role,
                    }))}
                    value={formUserId}
                    onChange={setFormUserId}
                    placeholder="Chọn User..."
                  />
                </Field>
                <Field label="Sản phẩm (Asset)" required>
                  <SearchableSelect
                    options={assets.map((a) => ({
                      id: a.id,
                      label: `${a.code} — ${a.name}`,
                      sublabel: a.code,
                    }))}
                    value={formAssetId}
                    onChange={setFormAssetId}
                    placeholder="Chọn Asset..."
                  />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Rebate Unit" required>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={rebateUnit}
                  onChange={(e) => setRebateUnit(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </Field>
              <Field label="Markup Pips" required>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={markupPips}
                  onChange={(e) => setMarkupPips(e.target.value)}
                  disabled={formLoading}
                  required
                />
              </Field>
            </div>

            <FormError>{formError}</FormError>

            <div className="flex gap-2.5 justify-end mt-2">
              {editContext && (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={formLoading}>
                  Hủy sửa
                </Button>
              )}
              <Button type="submit" variant="success" disabled={formLoading}>
                {formLoading ? 'Đang lưu...' : editContext ? 'Cập nhật cấu hình' : 'Tạo cấu hình mới'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function TreeDisplay({
  node,
  onEdit,
  onCreate,
}: {
  node: CommissionConfigTreeNode;
  onEdit: (node: { userId: string; email: string; version: number | null; rebateUnit?: number | null; markupPips?: number | null }) => void;
  onCreate: (node: { userId: string; email: string }) => void;
}) {
  const hasConfig = node.version != null;
  return (
    <div className="pl-4 border-l border-slate-200 mt-2">
      <div className="py-2.5 px-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 flex justify-between items-center gap-4 transition-colors">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{node.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
            <Badge tone={node.role === 'MIB' ? 'violet' : 'blue'}>{node.role}</Badge>
            {node.isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
            <span>Rebate: <strong className="text-slate-700">{node.rebateUnit ?? 'N/A'}</strong></span>
            <span>Markup: <strong className="text-slate-700">{node.markupPips ?? 'N/A'}</strong></span>
            {node.version != null && <span className="text-[10px] text-slate-400">(v{node.version})</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant={hasConfig ? 'secondary' : 'success'}
          onClick={() => (hasConfig ? onEdit(node) : onCreate(node))}
        >
          {hasConfig ? 'Sửa' : '+ Tạo'}
        </Button>
      </div>
      <div className="space-y-1">
        {(node.children ?? []).map((child) => (
          <TreeDisplay key={child.userId} node={child} onEdit={onEdit} onCreate={onCreate} />
        ))}
      </div>
    </div>
  );
}
