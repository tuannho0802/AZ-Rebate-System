'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api-client';
import { getMockAssets, getMockTemplates } from '../../lib/mock-store';

export interface ConfigNode {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  rebateUnit: number | null;
  markupPips: number | null;
  transferUnit: number | null;
  version: number | null;
}

interface CommissionConfig {
  id: string;
  userId: string;
  assetId: string;
  rebateUnit: number;
  markupPips: number;
  transferUnit: number;
  version: number;
  createdAt: string;
}

export default function ConfigPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'tree' | 'children'>('tree');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [configList, setConfigList] = useState<CommissionConfig[]>([]);
  const [treeData, setTreeData] = useState<ConfigNode | null>(null);
  const [childrenData, setChildrenData] = useState<any | null>(null);

  // Assets & Templates from mock store
  const [assets] = useState(() => getMockAssets());
  const [templates] = useState(() => getMockTemplates());

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      // Redirect MIB/IB to their pages
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, router]);

  const loadTree = async (userId: string, assetId: string) => {
    try {
      const data = await api.get<ConfigNode>(`/commission-configs/tree/${userId}?assetId=${assetId}`);
      setTreeData(data);
      setSelectedUserId(userId);
      setSelectedAssetId(assetId);
    } catch (error: any) {
      alert(`Failed to load tree: ${error.message}`);
    }
  };

  const loadChildren = async (userId: string, assetId: string) => {
    try {
      const data = await api.get<any>(`/commission-configs/children/${userId}?assetId=${assetId}`);
      setChildrenData(data);
      setSelectedUserId(userId);
      setSelectedAssetId(assetId);
    } catch (error: any) {
      alert(`Failed to load children: ${error.message}`);
    }
  };

  const handleUpsert = async (dto: { userId: string; assetId: string; rebateUnit: number; markupPips: number }) => {
    try {
      const created = await api.post<CommissionConfig>('/commission-configs', dto);
      setConfigList([...configList, created]);
      alert('Config created successfully!');
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    }
  };

  const handleUpdate = async (
    userId: string,
    assetId: string,
    dto: { rebateUnit?: number; markupPips?: number; version: number }
  ) => {
    try {
      const updated = await api.patch<CommissionConfig>(`/commission-configs/${userId}/${assetId}`, dto);
      setConfigList(configList.map((c) => (c.userId === userId && c.assetId === assetId ? updated : c)));
      alert('Config updated successfully!');
    } catch (error: any) {
      if (error.status === 409) {
        alert('Dữ liệu đã bị người khác cập nhật. Vui lòng tải lại!');
      } else {
        alert(`Failed: ${error.message}`);
      }
    }
  };

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
        {/* Assets & Templates dropdowns */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Select Asset & User</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Select Asset --</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.code} ({a.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Select User --</option>
                <option value="mib@test.com">MIB (root)</option>
                <option value="lv1-a@test.com">IB (lv1-a)</option>
                <option value="lv1-b@test.com">IB (lv1-b)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  if (activeTab === 'tree' && selectedUserId && selectedAssetId) {
                    loadTree(selectedUserId, selectedAssetId);
                  } else if (activeTab === 'children' && selectedUserId && selectedAssetId) {
                    loadChildren(selectedUserId, selectedAssetId);
                  }
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Load
              </button>
            </div>
          </div>
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
            <TreeDisplay node={treeData} />
          </div>
        )}

        {/* Children View */}
        {activeTab === 'children' && childrenData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Self & Direct Children</h2>
            <div className="border p-4 rounded mb-4">
              <h3 className="font-medium">Self Config:</h3>
              <p>Rebate: {childrenData.self.rebateUnit ?? 'N/A'}</p>
              <p>Markup: {childrenData.self.markupPips ?? 'N/A'}</p>
            </div>
            <h3 className="font-medium mb-2">Children:</h3>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2">Rebate</th>
                  <th className="px-4 py-2">Markup</th>
                </tr>
              </thead>
              <tbody>
                {childrenData.children.map((c: any) => (
                  <tr key={c.userId}>
                    <td className="px-4 py-2">{c.email}</td>
                    <td className="px-4 py-2">{c.role}</td>
                    <td className="px-4 py-2">{c.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{c.rebateUnit ?? 'N/A'}</td>
                    <td className="px-4 py-2">{c.markupPips ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Upsert Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Create/Update Config</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpsert({
                userId: formData.get('userId') as string,
                assetId: formData.get('assetId') as string,
                rebateUnit: parseFloat(formData.get('rebateUnit') as string) || 0,
                markupPips: parseFloat(formData.get('markupPips') as string) || 0,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <input type="text" name="userId" placeholder="User ID" required className="px-3 py-2 border rounded" />
              <input type="text" name="assetId" placeholder="Asset ID" required className="px-3 py-2 border rounded" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                name="rebateUnit"
                placeholder="Rebate Unit"
                min="0"
                required
                className="px-3 py-2 border rounded"
              />
              <input
                type="number"
                name="markupPips"
                placeholder="Markup Pips"
                min="0"
                required
                className="px-3 py-2 border rounded"
              />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Create Config
            </button>
          </form>

          {/* Update Form */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium mb-2">Update Existing Config</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdate(
                  formData.get('userId') as string,
                  formData.get('assetId') as string,
                  {
                    rebateUnit: formData.get('rebateUnit') ? parseFloat(formData.get('rebateUnit') as string) : undefined,
                    markupPips: formData.get('markupPips') ? parseFloat(formData.get('markupPips') as string) : undefined,
                    version: parseInt(formData.get('version') as string),
                  }
                );
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-4">
                <input type="text" name="userId" placeholder="User ID" required className="px-3 py-2 border rounded" />
                <input type="text" name="assetId" placeholder="Asset ID" required className="px-3 py-2 border rounded" />
                <input type="number" name="version" placeholder="Current Version" required className="px-3 py-2 border rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" name="rebateUnit" placeholder="New Rebate (optional)" min="0" className="px-3 py-2 border rounded" />
                <input type="number" name="markupPips" placeholder="New Markup (optional)" min="0" className="px-3 py-2 border rounded" />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Update Config
              </button>
            </form>
          </div>
        </div>

        {/* Mock Data Banner */}
        <div className="mt-6 p-4 bg-yellow-100 border border-yellow-400 rounded">
          <p className="text-yellow-800">
            ⚠️ MOCK DATA — Backend chưa có API GET /commission-configs. List config được load từ tree/children API.
          </p>
        </div>
      </div>
    </div>
  );
}

function TreeDisplay({ node }: { node: ConfigNode }) {
  return (
    <div className="pl-4 border-l">
      <div className="py-2">
        <p className="font-medium">{node.email}</p>
        <p className="text-sm text-gray-600">
          Role: {node.role}, Active: {node.isActive ? 'Yes' : 'No'}, Rebate: {node.rebateUnit ?? 'N/A'}, Markup: {node.markupPips ?? 'N/A'}
        </p>
      </div>
      <div>
        {node.children.map((child) => (
          <TreeDisplay key={child.userId} node={child} />
        ))}
      </div>
    </div>
  );
}
