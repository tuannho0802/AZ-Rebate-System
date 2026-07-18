'use client';

import { useState, useEffect, useCallback } from 'react';
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

// Khớp đúng response thật từ backend (AdminService.listAssets/createAsset/updateAsset)
interface Asset {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  templateItems?: unknown[];
}

interface TemplateItem {
  id?: string;
  assetId: string;
  rebateUnit: number;
  markupPips: number;
  asset?: { id: string; code: string; name: string };
}

// Khớp đúng response thật từ backend (AdminService.listTemplates/createTemplate/updateTemplate)
interface Template {
  id: string;
  name: string;
  description?: string;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'assets' | 'templates' | 'config' | 'sessions'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'MIB' as 'MIB' | 'IB', parentId: '' });
  const [newAsset, setNewAsset] = useState({ code: '', name: '', category: 'OTHER' as AssetCategory });
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', items: [{ assetId: '', rebateUnit: 0, markupPips: 0 }] });
  const [applyTemplateForm, setApplyTemplateForm] = useState({ templateId: '', userId: '' });
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  useEffect(() => {
    if (isLoading) return; // Đang kiểm tra cookie/token — chưa biết user thật hay chưa, đừng redirect vội
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      // Redirect based on role if not admin
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, isLoading, router]);

  const fetchAssets = useCallback(() => {
    return api.get<Asset[]>('/admin/assets').then(setAssets).catch(console.error);
  }, []);

  const fetchTemplates = useCallback(() => {
    return api.get<Template[]>('/admin/templates').then(setTemplates).catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    if (activeTab === 'users') {
      api.get<User[]>('/users').then(setUsers).catch(console.error);
    } else if (activeTab === 'assets') {
      fetchAssets();
    } else if (activeTab === 'templates') {
      // Template item picker cần danh sách asset thật, nên load kèm nếu chưa có
      if (assets.length === 0) fetchAssets();
      fetchTemplates();
    } else if (activeTab === 'config') {
      // Form "Áp dụng Template" cần cả danh sách User (mọi cấp, kể cả MIB root)
      // và Template — load nếu chưa có sẵn.
      if (users.length === 0) api.get<User[]>('/users').then(setUsers).catch(console.error);
      if (templates.length === 0) fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoading, user]);

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
      await api.post<Asset>('/admin/assets', newAsset);
      // Refetch thay vì tự ghép state cục bộ — response POST không kèm templateItems,
      // trong khi GET list có, refetch đảm bảo state luôn khớp đúng dữ liệu thật.
      await fetchAssets();
      setNewAsset({ code: '', name: '', category: 'OTHER' as AssetCategory });
      alert('Asset created successfully!');
    } catch (error: any) {
      alert(`Failed to create asset: ${error.message}`);
    }
  };

  const handleUpdateAsset = async (asset: Asset) => {
    const newName = window.prompt('Tên mới:', asset.name);
    if (newName === null || newName === asset.name) return;
    try {
      await api.patch<Asset>(`/admin/assets/${asset.id}`, { name: newName });
      await fetchAssets();
    } catch (error: any) {
      alert(`Failed to update asset: ${error.message}`);
    }
  };

  const handleToggleAssetActive = async (asset: Asset) => {
    try {
      await api.patch<Asset>(`/admin/assets/${asset.id}`, { isActive: !asset.isActive });
      await fetchAssets();
    } catch (error: any) {
      alert(`Failed to update asset: ${error.message}`);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!window.confirm(`Xoá asset "${asset.code}"?`)) return;
    try {
      await api.delete(`/admin/assets/${asset.id}`);
      await fetchAssets();
    } catch (error: any) {
      // Backend chặn xoá nếu asset đang có config/payout/ledger, hoặc template item khác 0
      alert(`Failed to delete asset: ${error.message}`);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await api.post<Template>('/admin/templates', newTemplate);
      await fetchTemplates();
      setNewTemplate({ name: '', description: '', items: [{ assetId: '', rebateUnit: 0, markupPips: 0 }] });
      alert('Template created successfully!');
    } catch (error: any) {
      alert(`Failed to create template: ${error.message}`);
    }
  };

  const handleUpdateTemplateDescription = async (template: Template) => {
    const newDescription = window.prompt('Mô tả mới:', template.description ?? '');
    if (newDescription === null || newDescription === template.description) return;
    try {
      // Chỉ gửi description, KHÔNG gửi items -> backend giữ nguyên toàn bộ items hiện có
      await api.patch<Template>(`/admin/templates/${template.id}`, { description: newDescription });
      await fetchTemplates();
    } catch (error: any) {
      alert(`Failed to update template: ${error.message}`);
    }
  };

  const handleUpdateTemplateItem = async (template: Template, item: TemplateItem, field: 'rebateUnit' | 'markupPips', value: number) => {
    try {
      // QUAN TRỌNG: rebateUnit/markupPips trong schema là kiểu Prisma `Decimal`.
      // Khi backend trả JSON, Decimal luôn được serialize thành STRING (vd "1.0000"),
      // dù hiển thị trong input trông như số bình thường. Nếu gửi thẳng item.rebateUnit/
      // item.markupPips (đọc từ response GET) lên PATCH mà không ép kiểu lại, backend sẽ
      // từ chối 400 vì @IsNumber() thấy string, không phải number — đây chính là bug
      // "nhập 1 số là lỗi/loop" đã gặp. Luôn Number(...) cả 2 field trước khi gửi.
      const rebateUnit = Number(field === 'rebateUnit' ? value : item.rebateUnit);
      const markupPips = Number(field === 'markupPips' ? value : item.markupPips);

      if (Number.isNaN(rebateUnit) || Number.isNaN(markupPips)) {
        alert('Giá trị không hợp lệ, vui lòng nhập số.');
        return;
      }

      // Chỉ gửi đúng 1 item vừa sửa — backend (bản đã fix) chỉ upsert item này,
      // các item khác trong template giữ nguyên giá trị cũ.
      await api.patch<Template>(`/admin/templates/${template.id}`, {
        items: [{ assetId: item.assetId, rebateUnit, markupPips }],
      });
      await fetchTemplates();
    } catch (error: any) {
      alert(`Failed to update template item: ${error.message}`);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!window.confirm(`Xoá template "${template.name}"?`)) return;
    try {
      await api.delete(`/admin/templates/${template.id}`);
      await fetchTemplates();
    } catch (error: any) {
      alert(`Failed to delete template: ${error.message}`);
    }
  };

  // Admin áp Template cho BẤT KỲ user nào, kể cả MIB root — vì actor là Admin
  // nên assertCanWrite() bên backend bỏ qua hoàn toàn cap/orphan check (xem
  // commission-config.service.ts: `if (actor.type === 'ADMIN') return;`).
  // Đây là cách "mồi" config gốc cho MIB, để MIB sau đó tự áp Template được
  // cho con trực tiếp của mình (orphan check yêu cầu cha trực tiếp phải có
  // config trước).
  const handleApplyTemplateAdmin = async () => {
    if (!applyTemplateForm.templateId || !applyTemplateForm.userId) {
      alert('Vui lòng chọn Template và User');
      return;
    }
    setApplyingTemplate(true);
    try {
      const applied = await api.post<any[]>(
        `/templates/${applyTemplateForm.templateId}/apply/${applyTemplateForm.userId}`,
        {}
      );
      alert(`Áp dụng Template thành công cho ${applied.length} asset!`);
      setApplyTemplateForm({ templateId: '', userId: '' });
    } catch (error: any) {
      alert(`Áp dụng thất bại: ${error.message}`);
    } finally {
      setApplyingTemplate(false);
    }
  };

  if (isLoading) return null;
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
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'config' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Commission Configs
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'sessions' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Payout Sessions
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

        {/* Assets Section — API thật, không còn mock */}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Asset List</h2>
                <button onClick={() => fetchAssets()} className="text-sm text-blue-600 hover:underline">
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Active</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-2">{a.code}</td>
                        <td className="px-4 py-2">{a.name}</td>
                        <td className="px-4 py-2">{a.category}</td>
                        <td className="px-4 py-2">{a.isActive ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-2 space-x-2">
                          <button onClick={() => handleUpdateAsset(a)} className="text-blue-600 hover:underline text-sm">
                            Sửa tên
                          </button>
                          <button onClick={() => handleToggleAssetActive(a)} className="text-yellow-600 hover:underline text-sm">
                            {a.isActive ? 'Vô hiệu hoá' : 'Kích hoạt'}
                          </button>
                          <button onClick={() => handleDeleteAsset(a)} className="text-red-600 hover:underline text-sm">
                            Xoá
                          </button>
                        </td>
                      </tr>
                    ))}
                    {assets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                          Chưa có asset nào
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                * Xoá sẽ bị chặn nếu asset đang được dùng thật trong commission configs, payout
                sessions, hoặc có template item khác 0.
              </p>
            </div>
          </div>
        )}

        {/* Templates Section — API thật, không còn mock */}
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
                  className="px-3 py-2 border rounded w-full"
                />
                <div className="border p-4 rounded space-y-2">
                  <h3 className="font-medium">Template Items</h3>
                  {newTemplate.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <select
                        value={item.assetId}
                        onChange={(e) => {
                          const items = [...newTemplate.items];
                          items[idx] = { ...item, assetId: e.target.value };
                          setNewTemplate({ ...newTemplate, items });
                        }}
                        className="flex-1 px-3 py-2 border rounded"
                      >
                        <option value="">-- Chọn Asset --</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Rebate Unit"
                        value={item.rebateUnit}
                        onChange={(e) => {
                          const items = [...newTemplate.items];
                          items[idx] = { ...item, rebateUnit: parseFloat(e.target.value) || 0 };
                          setNewTemplate({ ...newTemplate, items });
                        }}
                        className="w-28 px-3 py-2 border rounded"
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
                        className="w-28 px-3 py-2 border rounded"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setNewTemplate({
                        ...newTemplate,
                        items: [...newTemplate.items, { assetId: '', rebateUnit: 0, markupPips: 0 }],
                      })
                    }
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Thêm item
                  </button>
                  <p className="text-gray-500 text-xs">
                    Asset nào không liệt kê ở đây sẽ tự động có rebateUnit=0, markupPips=0 (backend tự
                    đồng bộ đủ mọi asset hiện có).
                  </p>
                </div>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Create Template
                </button>
              </form>
            </div>

            {/* Templates List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Template List</h2>
                <button onClick={() => fetchTemplates()} className="text-sm text-blue-600 hover:underline">
                  Refresh
                </button>
              </div>
              <div className="space-y-6">
                {templates.map((t) => (
                  <div key={t.id} className="border rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold">{t.name}</span>
                        {t.description && <span className="text-gray-500 ml-2">— {t.description}</span>}
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => handleUpdateTemplateDescription(t)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Sửa mô tả
                        </button>
                        <button onClick={() => handleDeleteTemplate(t)} className="text-red-600 hover:underline text-sm">
                          Xoá
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left">Asset</th>
                          <th className="px-2 py-1 text-left">Rebate Unit</th>
                          <th className="px-2 py-1 text-left">Markup Pips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.items.map((item) => (
                          <tr key={item.assetId} className="border-t">
                            <td className="px-2 py-1">{item.asset ? `${item.asset.code} — ${item.asset.name}` : item.assetId}</td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                defaultValue={item.rebateUnit}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (val !== item.rebateUnit) handleUpdateTemplateItem(t, item, 'rebateUnit', val);
                                }}
                                className="w-24 px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                defaultValue={item.markupPips}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (val !== item.markupPips) handleUpdateTemplateItem(t, item, 'markupPips', val);
                                }}
                                className="w-24 px-2 py-1 border rounded"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {templates.length === 0 && <p className="text-gray-400 text-center py-6">Chưa có template nào</p>}
              </div>
            </div>
          </div>
        )}

        {/* Commission Configs Section */}
        {activeTab === 'config' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Commission Configs</h2>
              <p className="text-gray-600 mb-4">
                Commission Configs được quản lý tại trang riêng để xử lý tree/children hierarchy.
              </p>
              <a
                href="/config"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Open Commission Configs
              </a>
            </div>

            {/* Apply Template — chỉ Admin mới bypass được cap/orphan check, dùng
                để "mồi" config gốc cho MIB (root), hoặc set nhanh cho bất kỳ ai. */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Áp dụng Template</h2>
              <p className="text-sm text-gray-500 mb-4">
                Admin có thể áp Template cho <strong>bất kỳ user nào, kể cả MIB (root)</strong> — không bị
                chặn bởi cap/orphan check (chỉ áp dụng với MIB/IB tự áp cho con trực tiếp của họ). Dùng để
                mồi config gốc cho MIB trước, để MIB sau đó tự áp Template được cho con của mình.
              </p>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <select
                    value={applyTemplateForm.templateId}
                    onChange={(e) => setApplyTemplateForm({ ...applyTemplateForm, templateId: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">-- Select Template --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.items?.length ?? 0} asset)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User (bất kỳ cấp nào)</label>
                  <select
                    value={applyTemplateForm.userId}
                    onChange={(e) => setApplyTemplateForm({ ...applyTemplateForm, userId: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">-- Select User --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.role} — {u.fullName ?? u.email} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleApplyTemplateAdmin}
                  disabled={applyingTemplate}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {applyingTemplate ? 'Đang áp dụng...' : 'Áp dụng Template'}
                </button>
              </div>
              {templates.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">Chưa có template nào — tạo ở tab Templates trước.</p>
              )}
              {users.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">Chưa có user nào — tạo ở tab Users trước.</p>
              )}
            </div>
          </div>
        )}

        {/* Payout Sessions Section */}
        {activeTab === 'sessions' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Payout Sessions</h2>
              <p className="text-gray-600 mb-4">
                Payout Sessions được quản lý tại trang riêng với state machine (DRAFT → LOCKED → COMPLETED).
              </p>
              <a
                href="/sessions"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Open Payout Sessions
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}