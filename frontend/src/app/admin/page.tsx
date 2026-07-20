'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api-client';

type AssetCategory = 'FOREX' | 'METAL' | 'ENERGY' | 'COMMODITY' | 'INDEX' | 'SHARES' | 'CRYPTO' | 'OTHER';

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

export default function AdminPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'assets' | 'templates' | 'integrity' | 'config' | 'sessions'>('users');

  const [assets, setAssets] = useState<Asset[]>([]);

  const [newAsset, setNewAsset] = useState({ code: '', name: '', category: 'OTHER' as AssetCategory });

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

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    if (activeTab === 'assets') {
      fetchAssets();
    }
    // Tab 'users' đã tách sang route /admin/users (Flow 03), tab 'templates' đã
    // tách sang route /admin/templates (Flow 04) — không tự fetch/render list
    // ở đây nữa, tránh trùng lặp dữ liệu + logic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoading, user]);

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
            onClick={() => setActiveTab('integrity')}
            className={`px-6 py-2 rounded-lg font-medium ${activeTab === 'integrity' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Integrity Check
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

        {/* Users Section — đã tách hẳn sang route /admin/users (Flow 03),
            chỉ còn card dẫn hướng, KHÔNG tự render form/list ở đây nữa
            (tránh trùng lặp đã gây lỗi route conflict). */}
        {activeTab === 'users' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">User Management</h2>
              <p className="text-gray-600 mb-4">
                User Management đã được tách ra thành route riêng để sử dụng components tái dụng.
              </p>
              <a
                href="/admin/users"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Open User Management
              </a>
            </div>
          </div>
        )}

        {/* Assets Section */}
        {activeTab === 'assets' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Asset Management</h2>
              <p className="text-gray-600 mb-4">
                Asset Management đã được tách ra thành route riêng để sử dụng components tái dụng.
              </p>
              <a
                href="/admin/assets"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Open Asset Management
              </a>
            </div>
          </div>
        )}

        {/* Templates Section — đã tách hẳn sang route /admin/templates (Flow 04),
            cùng pattern với Users/Assets, tránh lặp lại lỗi route conflict đã
            gặp ở Flow 03. */}
        {activeTab === 'templates' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Template Management</h2>
              <p className="text-gray-600 mb-4">
                Template Management đã được tách ra thành route riêng để sử dụng components tái dụng.
              </p>
              <a
                href="/admin/templates"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Open Template Management
              </a>
            </div>
          </div>
        )}

        {/* Integrity Check Section — route riêng /admin/integrity-check ngay từ đầu,
    theo đúng pattern Users/Assets/Templates, tránh lặp lại bug route-conflict
    đã gặp ở Flow 03. */}
        {activeTab === 'integrity' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Integrity Check</h2>
              <p className="text-gray-600 mb-4">
                Quét toàn bộ hệ thống để phát hiện vi phạm rule &quot;con ≤ cha&quot; giữa các cặp cha-con.
              </p>
              <a
                href="/admin/integrity-check"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Open Integrity Check
              </a>
            </div>
          </div>
        )}

        {/* Commission Configs Section — "Áp dụng Template" đã dời sang
            /admin/templates (gắn liền với Template hơn là Commission Config). */}
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
    </div >
  );
}