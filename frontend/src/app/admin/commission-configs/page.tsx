'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api-client';
import {
  getConfigTree,
  getConfigChildren,
  upsertConfig,
  updateConfig,
  CommissionConfigTreeNode,
  CommissionConfigChildrenResponse,
  CommissionConfigChild,
} from '../../../lib/api/commission-config';

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

interface UpsertFormState {
  userId: string;
  assetId: string;
  rebateUnit: string;
  markupPips: string;
}

interface EditContext {
  userId: string;
  assetId: string;
  version: number;
  userLabel: string;
  assetLabel: string;
}

const emptyUpsertForm: UpsertFormState = { userId: '', assetId: '', rebateUnit: '', markupPips: '' };

export default function AdminCommissionConfigsPage() {
  const { user, logout, isLoading } = useAuth();
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

  const [upsertForm, setUpsertForm] = useState<UpsertFormState>(emptyUpsertForm);

  const [editContext, setEditContext] = useState<EditContext | null>(null);
  const [editRebateUnit, setEditRebateUnit] = useState('');
  const [editMarkupPips, setEditMarkupPips] = useState('');

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

  const handleUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upsertForm.userId || !upsertForm.assetId) {
      alert('Vui lòng chọn User và Asset');
      return;
    }
    try {
      const created = await upsertConfig({
        userId: upsertForm.userId,
        assetId: upsertForm.assetId,
        rebateUnit: parseFloat(upsertForm.rebateUnit) || 0,
        markupPips: parseFloat(upsertForm.markupPips) || 0,
      });
      alert(`Config created/updated successfully! (version hiện tại: ${created.version})`);
      setUpsertForm(emptyUpsertForm);
      if (selectedUserId === upsertForm.userId && selectedAssetId === upsertForm.assetId) {
        activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
      }
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContext) return;
    try {
      const updated = await updateConfig(editContext.userId, editContext.assetId, {
        rebateUnit: editRebateUnit ? parseFloat(editRebateUnit) : undefined,
        markupPips: editMarkupPips ? parseFloat(editMarkupPips) : undefined,
        version: editContext.version,
      });
      alert(`Cập nhật thành công! (version mới: ${updated.version})`);
      const { userId: doneUserId, assetId: doneAssetId } = editContext;
      cancelEdit();
      if (selectedUserId === doneUserId && selectedAssetId === doneAssetId) {
        activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
      }
    } catch (error: any) {
      if (error.status === 409) {
        alert('Dữ liệu đã bị người khác cập nhật. Vui lòng bấm "Sửa" lại trên bảng để lấy dữ liệu mới nhất!');
        cancelEdit();
        if (selectedUserId === editContext.userId && selectedAssetId === editContext.assetId) {
          activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
        }
      } else {
        alert(`Failed: ${error.message}`);
      }
    }
  };

  const cancelEdit = () => {
    setEditContext(null);
    setEditRebateUnit('');
    setEditMarkupPips('');
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
    setEditRebateUnit(node.rebateUnit != null ? String(node.rebateUnit) : '');
    setEditMarkupPips(node.markupPips != null ? String(node.markupPips) : '');
    document.getElementById('edit-config-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const startCreate = (node: { userId: string; email: string }) => {
    if (!selectedAssetId) return;
    setUpsertForm({ userId: node.userId, assetId: selectedAssetId, rebateUnit: '', markupPips: '' });
    document.getElementById('create-config-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const userLabel = (u: UserOption) => `${u.role} — ${u.fullName ?? u.email} (${u.email})`;

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto py-4">
        {/* Assets & Users dropdowns */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Select Asset & User</h2>
          {loadingLookups && <p className="text-sm text-gray-500 mb-2">Đang tải danh sách asset/user...</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Select Asset --</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} ({a.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User (gốc để xem tree/children)</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Select User --</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!selectedUserId || !selectedAssetId ? (
            <p className="text-sm text-gray-500 mt-3">Chọn cả Asset và User để tự động load dữ liệu bên dưới.</p>
          ) : viewLoading ? (
            <p className="text-sm text-gray-500 mt-3">Đang tải...</p>
          ) : null}
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Full Tree (Admin)
          </button>
          <button
            onClick={() => setActiveTab('children')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'children' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Direct Children
          </button>
        </div>

        {/* Tree View */}
        {activeTab === 'tree' && treeData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Commission Tree for {treeData.email}</h2>
            <TreeDisplay node={treeData} onEdit={startEdit} onCreate={startCreate} />
          </div>
        )}

        {/* Children View */}
        {activeTab === 'children' && childrenData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Self & Direct Children</h2>
            <div className="border p-4 rounded mb-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium">Self Config:</h3>
                <p>Rebate: {childrenData.self.rebateUnit ?? 'N/A'}</p>
                <p>Markup: {childrenData.self.markupPips ?? 'N/A'}</p>
                <p className="text-xs text-gray-400">v{childrenData.self.version ?? '—'}</p>
              </div>
              {childrenData.self.version != null ? (
                <button
                  onClick={() => startEdit(childrenData.self)}
                  className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm h-fit"
                >
                  Sửa
                </button>
              ) : (
                <button
                  onClick={() => startCreate(childrenData.self)}
                  className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm h-fit"
                >
                  + Tạo
                </button>
              )}
            </div>
            <h3 className="font-medium mb-2">Children:</h3>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Active</th>
                  <th className="px-4 py-2 text-left">Rebate</th>
                  <th className="px-4 py-2 text-left">Markup</th>
                  <th className="px-4 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {childrenData.children.map((c: CommissionConfigChild) => (
                  <tr key={c.userId} className="border-t">
                    <td className="px-4 py-2">{c.email}</td>
                    <td className="px-4 py-2">{c.role}</td>
                    <td className="px-4 py-2">{c.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{c.rebateUnit ?? 'N/A'}</td>
                    <td className="px-4 py-2">
                      {c.markupPips ?? 'N/A'} <span className="text-xs text-gray-400">v{c.version ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2">
                      {c.version != null ? (
                        <button
                          onClick={() => startEdit(c)}
                          className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                        >
                          Sửa
                        </button>
                      ) : (
                        <button
                          onClick={() => startCreate(c)}
                          className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm"
                        >
                          + Tạo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Config Form */}
        <div id="create-config-form" className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create Config</h2>
          <p className="text-sm text-gray-500 mb-4">
            Tạo mới config rebate/markup cho 1 cặp User + Asset. Nếu cặp này đã tồn tại, endpoint sẽ upsert
            (ghi đè) — dùng form "Update Existing Config" bên dưới nếu muốn kiểm tra optimistic lock qua version.
          </p>
          <form onSubmit={handleUpsert} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <select
                  value={upsertForm.userId}
                  onChange={(e) => setUpsertForm({ ...upsertForm, userId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">-- Select User --</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userLabel(u)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                <select
                  value={upsertForm.assetId}
                  onChange={(e) => setUpsertForm({ ...upsertForm, assetId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">-- Select Asset --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rebate Unit</label>
                <input
                  type="number"
                  value={upsertForm.rebateUnit}
                  onChange={(e) => setUpsertForm({ ...upsertForm, rebateUnit: e.target.value })}
                  min="0"
                  step="0.0001"
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Markup Pips</label>
                <input
                  type="number"
                  value={upsertForm.markupPips}
                  onChange={(e) => setUpsertForm({ ...upsertForm, markupPips: e.target.value })}
                  min="0"
                  step="0.0001"
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Create Config
            </button>
          </form>
        </div>

        {/* Edit Config panel */}
        <div id="edit-config-form" className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Edit Config</h2>

          {!editContext ? (
            <p className="text-sm text-gray-500">
              Chọn 1 dòng trong bảng <strong>Tree</strong> hoặc <strong>Direct Children</strong> ở trên rồi bấm{' '}
              <strong>"Sửa"</strong> để chỉnh sửa config đã có. Nếu dòng đó chưa có config, bấm{' '}
              <strong>"+ Tạo"</strong> thay vào đó — form sẽ tự chuyển lên khung Create Config phía trên.
            </p>
          ) : (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded p-3">
                <div>
                  <span className="text-gray-500">User: </span>
                  <span className="font-medium">{editContext.userLabel}</span>
                </div>
                <div>
                  <span className="text-gray-500">Asset: </span>
                  <span className="font-medium">{editContext.assetLabel}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Rebate</label>
                  <input
                    type="number"
                    value={editRebateUnit}
                    onChange={(e) => setEditRebateUnit(e.target.value)}
                    min="0"
                    step="0.0001"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Markup</label>
                  <input
                    type="number"
                    value={editMarkupPips}
                    onChange={(e) => setEditMarkupPips(e.target.value)}
                    min="0"
                    step="0.0001"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
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
    <div className="pl-4 border-l">
      <div className="py-2 flex justify-between items-center">
        <div>
          <p className="font-medium">{node.email}</p>
          <p className="text-sm text-gray-600">
            Role: {node.role}, Active: {node.isActive ? 'Yes' : 'No'}, Rebate: {node.rebateUnit ?? 'N/A'}, Markup:{' '}
            {node.markupPips ?? 'N/A'}{' '}
            <span className="text-xs text-gray-400">v{node.version ?? '—'}</span>
          </p>
        </div>
        {hasConfig ? (
          <button onClick={() => onEdit(node)} className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm">
            Sửa
          </button>
        ) : (
          <button
            onClick={() => onCreate(node)}
            className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm"
          >
            + Tạo
          </button>
        )}
      </div>
      <div>
        {(node.children ?? []).map((child) => (
          <TreeDisplay key={child.userId} node={child} onEdit={onEdit} onCreate={onCreate} />
        ))}
      </div>
    </div>
  );
}
