'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api-client';
type AssetCategory = 'FOREX' | 'METAL' | 'ENERGY' | 'COMMODITY' | 'INDEX' | 'SHARES' | 'CRYPTO' | 'OTHER';
interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'MIB' | 'IB';
  isActive: boolean;
  parentId?: string;
  createdAt: string;
}

interface Asset {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  isActive: boolean;
}

interface Template {
  id: string;
  name: string;
  description?: string;
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'assets' | 'templates'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'MIB' as 'MIB' | 'IB', parentId: '' });
  const [newAsset, setNewAsset] = useState({ code: '', name: '', category: 'OTHER' as AssetCategory });
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', items: [{ assetId: '', rebateUnit: 0, markupPips: 0 }] });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      // Redirect based on role if not admin
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, router]);

  useEffect(() => {
    if (activeTab === 'users') {
      api.get<User[]>('/users').then(setUsers).catch(console.error);
    }
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.post<User>('/admin/users', newUser);
      setUsers([...users, created]);
      setNewUser({ email: '', password: '', fullName: '', role: 'MIB', parentId: '' });
      alert('User created successfully!');
    } catch (error: any) {
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.post<Asset>('/admin/assets', newAsset);
      setAssets([...assets, created]);
      setNewAsset({ code: '', name: '', category: 'OTHER' as AssetCategory });
      alert('Asset created successfully!');
    } catch (error: any) {
      alert(`Failed to create asset: ${error.message}`);
    }
  };

  const handleCreateTemplate = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const created = await api.post<Template>('/admin/templates', newTemplate);
      setTemplates([...templates, created]);
      setNewTemplate({ name: '', description: '', items: [{ assetId: '', rebateUnit: 0, markupPips: 0 }] });
      alert('Template created successfully!');
    } catch (error: any) {
      alert(`Failed to create template: ${error.message}`);
    }
  };

  if (!user || user.type !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Rebate System — Admin</h1>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'assets' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Assets
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'templates' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Templates
          </button>
        </div>

        {/* Users Section */}
        {activeTab === 'users' && (
          <div className="space-y-8">
            {/* Create User Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    className="px-3 py-2 border rounded"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    className="px-3 py-2 border rounded"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Full Name (optional)"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    className="px-3 py-2 border rounded"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'MIB' | 'IB' })}
                    className="px-3 py-2 border rounded"
                  >
                    <option value="MIB">MIB</option>
                    <option value="IB">IB</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Parent ID (optional, for IB)"
                  value={newUser.parentId}
                  onChange={(e) => setNewUser({ ...newUser, parentId: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Create User
                </button>
              </form>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">User List</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Full Name</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-4 py-2">{u.email}</td>
                        <td className="px-4 py-2">{u.fullName}</td>
                        <td className="px-4 py-2">{u.role}</td>
                        <td className="px-4 py-2">{u.isActive ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Assets Section */}
        {activeTab === 'assets' && (
          <div className="space-y-8">
            {/* Create Asset Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Create New Asset</h2>
              <form onSubmit={handleCreateAsset} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Code"
                    value={newAsset.code}
                    onChange={(e) => setNewAsset({ ...newAsset, code: e.target.value })}
                    required
                    className="px-3 py-2 border rounded"
                  />
                  <input
                    type="text"
                    placeholder="Name"
                    value={newAsset.name}
                    onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                    required
                    className="px-3 py-2 border rounded"
                  />
                </div>
                <select
                  value={newAsset.category}
                  onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value as AssetCategory })}
                  className="px-3 py-2 border rounded"
                >
                  <option value="FOREX">FOREX</option>
                  <option value="METAL">METAL</option>
                  <option value="ENERGY">ENERGY</option>
                  <option value="COMMODITY">COMMODITY</option>
                  <option value="INDEX">INDEX</option>
                  <option value="SHARES">SHARES</option>
                  <option value="CRYPTO">CRYPTO</option>
                  <option value="OTHER">OTHER</option>
                </select>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Create Asset
                </button>
              </form>
            </div>

            {/* Assets List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Asset List</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-2">{a.code}</td>
                        <td className="px-4 py-2">{a.name}</td>
                        <td className="px-4 py-2">{a.category}</td>
                        <td className="px-4 py-2">{a.isActive ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                * Chưa có API để list/edit/delete assets — chỉ có POST /admin/assets
              </p>
            </div>
          </div>
        )}

        {/* Templates Section */}
        {activeTab === 'templates' && (
          <div className="space-y-8">
            {/* Create Template Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Create New Template</h2>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  required
                  className="px-3 py-2 border rounded"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <div className="border p-4 rounded space-y-2">
                  <h3 className="font-medium">Template Items</h3>
                  {newTemplate.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <input
                        type="text"
                        placeholder="Asset ID"
                        value={item.assetId}
                        onChange={(e) => {
                          const items = [...newTemplate.items];
                          items[idx] = { ...item, assetId: e.target.value };
                          setNewTemplate({ ...newTemplate, items });
                        }}
                        className="flex-1 px-3 py-2 border rounded"
                      />
                      <input
                        type="number"
                        placeholder="Rebate Unit"
                        value={item.rebateUnit}
                        onChange={(e) => {
                          const items = [...newTemplate.items];
                          items[idx] = { ...item, rebateUnit: parseFloat(e.target.value) || 0 };
                          setNewTemplate({ ...newTemplate, items });
                        }}
                        className="w-24 px-3 py-2 border rounded"
                      />
                      <input
                        type="number"
                        placeholder="Markup Pips"
                        value={item.markupPips}
                        onChange={(e) => {
                          const items = [...newTemplate.items];
                          items[idx] = { ...item, markupPips: parseFloat(e.target.value) || 0 };
                          setNewTemplate({ ...newTemplate, items });
                        }}
                        className="w-24 px-3 py-2 border rounded"
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Create Template
                </button>
              </form>
            </div>

            {/* Templates List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Template List</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-4 py-2">{t.name}</td>
                        <td className="px-4 py-2">{t.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                * Chưa có API để list/edit/delete templates — chỉ có POST /admin/templates
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
