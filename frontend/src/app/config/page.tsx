'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api-client';
import {
  getConfigTree,
  getConfigChildren,
  upsertConfig,
  updateConfig,
  CommissionConfigTreeNode,
  CommissionConfigChildrenResponse,
  CommissionConfigChild,
} from '../../lib/api/commission-config';

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

// Local shape for the two forms — kept separate from CommissionConfig because fields
// are strings while being edited (empty string = "not typed yet") and cast to number on submit.
interface UpsertFormState {
  userId: string;
  assetId: string;
  rebateUnit: string;
  markupPips: string;
}

interface UpdateFormState {
  userId: string;
  assetId: string;
  version: string;
  rebateUnit: string;
  markupPips: string;
}

const emptyUpsertForm: UpsertFormState = { userId: '', assetId: '', rebateUnit: '', markupPips: '' };
const emptyUpdateForm: UpdateFormState = { userId: '', assetId: '', version: '', rebateUnit: '', markupPips: '' };

export default function ConfigPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'tree' | 'children'>('tree');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [treeData, setTreeData] = useState<CommissionConfigTreeNode | null>(null);
  const [childrenData, setChildrenData] = useState<CommissionConfigChildrenResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Assets & Users from real backend API (mock-store removed — backend has real GET/PATCH/DELETE now)
  const [assets, setAssets] = useState<Asset[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Controlled form state — dropdowns instead of free-text UUID inputs, so manual testing
  // doesn't require copy-pasting IDs from anywhere.
  const [upsertForm, setUpsertForm] = useState<UpsertFormState>(emptyUpsertForm);
  const [updateForm, setUpdateForm] = useState<UpdateFormState>(emptyUpdateForm);

  useEffect(() => {
    if (isLoading) return; // Đang kiểm tra cookie/token — chưa biết user thật hay chưa, đừng redirect vội
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, isLoading, router]);

  // Load real Assets + Users for the dropdowns (previously came from mock-store / hardcoded list)
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

  // Auto-load whenever both dropdowns have a value or the tab is switched — no need to press
  // "Load" manually every time, matches how an admin would expect to explore the tree.
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
      // Refresh the currently loaded view if it matches, so the change is visible immediately
      if (selectedUserId === upsertForm.userId && selectedAssetId === upsertForm.assetId) {
        activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
      }
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateForm.userId || !updateForm.assetId || !updateForm.version) {
      alert('Vui lòng chọn User, Asset và nhập Version hiện tại');
      return;
    }
    try {
      const updated = await updateConfig(updateForm.userId, updateForm.assetId, {
        rebateUnit: updateForm.rebateUnit ? parseFloat(updateForm.rebateUnit) : undefined,
        markupPips: updateForm.markupPips ? parseFloat(updateForm.markupPips) : undefined,
        version: parseInt(updateForm.version, 10),
      });
      alert(`Config updated successfully! (version mới: ${updated.version})`);
      setUpdateForm(emptyUpdateForm);
      if (selectedUserId === updateForm.userId && selectedAssetId === updateForm.assetId) {
        activeTab === 'tree' ? loadTree(selectedUserId, selectedAssetId) : loadChildren(selectedUserId, selectedAssetId);
      }
    } catch (error: any) {
      if (error.status === 409) {
        alert('Dữ liệu đã bị người khác cập nhật (version conflict). Vui lòng tải lại để lấy version mới nhất!');
      } else {
        alert(`Failed: ${error.message}`);
      }
    }
  };

  // Prefill the Update form from a node already visible in the tree/children view — this is
  // the main way to test manually: no copy-pasting IDs, just click "Sửa" next to a row.
  const prefillUpdateFrom = (node: { userId: string; version: number | null; rebateUnit: number | null; markupPips: number | null }) => {
    if (!selectedAssetId) return;
    setUpdateForm({
      userId: node.userId,
      assetId: selectedAssetId,
      version: node.version != null ? String(node.version) : '',
      rebateUnit: node.rebateUnit != null ? String(node.rebateUnit) : '',
      markupPips: node.markupPips != null ? String(node.markupPips) : '',
    });
    // Scroll the form into view so the admin notices it got filled
    document.getElementById('update-config-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const userLabel = (u: UserOption) => `${u.role} — ${u.fullName ?? u.email} (${u.email})`;

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Commission Configs</h1>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Assets & Users dropdowns — auto-loads as soon as both are picked, no "Load" click needed */}
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
            <TreeDisplay node={treeData} onEdit={prefillUpdateFrom} />
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
                <p className="text-sm text-gray-500">Version: {childrenData.self.version ?? 'N/A'}</p>
              </div>
              <button
                onClick={() => prefillUpdateFrom(childrenData.self)}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm h-fit"
              >
                Sửa
              </button>
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
                  <th className="px-4 py-2 text-left">Version</th>
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
                    <td className="px-4 py-2">{c.markupPips ?? 'N/A'}</td>
                    <td className="px-4 py-2">{c.version ?? 'N/A'}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => prefillUpdateFrom(c)}
                        className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Config Form — dropdowns instead of free-text IDs */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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

        {/* Update Existing Config Form */}
        <div id="update-config-form" className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Update Existing Config</h2>
          <p className="text-sm text-gray-500 mb-4">
            Bấm nút "Sửa" ở bảng tree/children bên trên để tự điền User/Asset/Version — hoặc chọn tay bên dưới.
            Version bắt buộc đúng với version hiện tại trên server (optimistic lock), sai sẽ trả lỗi 409.
          </p>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <select
                  value={updateForm.userId}
                  onChange={(e) => setUpdateForm({ ...updateForm, userId: e.target.value })}
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
                  value={updateForm.assetId}
                  onChange={(e) => setUpdateForm({ ...updateForm, assetId: e.target.value })}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Version</label>
                <input
                  type="number"
                  value={updateForm.version}
                  onChange={(e) => setUpdateForm({ ...updateForm, version: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Rebate (optional)</label>
                <input
                  type="number"
                  value={updateForm.rebateUnit}
                  onChange={(e) => setUpdateForm({ ...updateForm, rebateUnit: e.target.value })}
                  min="0"
                  step="0.0001"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Markup (optional)</label>
                <input
                  type="number"
                  value={updateForm.markupPips}
                  onChange={(e) => setUpdateForm({ ...updateForm, markupPips: e.target.value })}
                  min="0"
                  step="0.0001"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Update Config
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TreeDisplay({
  node,
  onEdit,
}: {
  node: CommissionConfigTreeNode;
  onEdit: (node: { userId: string; version: number | null; rebateUnit: number | null; markupPips: number | null }) => void;
}) {
  return (
    <div className="pl-4 border-l">
      <div className="py-2 flex justify-between items-center">
        <div>
          <p className="font-medium">{node.email}</p>
          <p className="text-sm text-gray-600">
            Role: {node.role}, Active: {node.isActive ? 'Yes' : 'No'}, Rebate: {node.rebateUnit ?? 'N/A'}, Markup:{' '}
            {node.markupPips ?? 'N/A'}, Version: {node.version ?? 'N/A'}
          </p>
        </div>
        <button onClick={() => onEdit(node)} className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm">
          Sửa
        </button>
      </div>
      <div>
        {(node.children ?? []).map((child) => (
          <TreeDisplay key={child.userId} node={child} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}