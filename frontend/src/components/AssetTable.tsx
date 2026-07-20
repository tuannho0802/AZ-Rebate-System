'use client';

import { Asset, AssetCategory } from '../lib/api/admin';
import { useAuth } from '../context/auth-context';

interface AssetTableProps {
  assets: Asset[];
  onEditName?: (asset: Asset) => void;
  onToggleActive?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
}

export default function AssetTable({ assets, onEditName, onToggleActive, onDelete }: AssetTableProps) {
  const { user } = useAuth();
  const isAdmin = user?.type === 'admin';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Asset List</h2>
        {isAdmin && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">⚠️ ADMIN ONLY ACTIONS</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2 text-left">Created</th>
              {isAdmin && <th className="px-4 py-2 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-gray-400">
                  Chưa có asset nào
                </td>
              </tr>
            ) : (
              assets.map((a) => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-sm">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2">{a.category}</td>
                  <td className="px-4 py-2">
                    {a.isActive ? (
                      <span className="text-green-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400 text-sm">Ngừng hoạt động</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{formatDate(a.createdAt)}</td>
                  {isAdmin && (
                    <td className="px-4 py-2 space-x-2">
                      {onEditName && (
                        <button
                          onClick={() => onEditName(a)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Sửa tên
                        </button>
                      )}
                      {onToggleActive && (
                        <button
                          onClick={() => onToggleActive(a)}
                          className="text-yellow-600 hover:underline text-sm"
                        >
                          {a.isActive ? 'Vô hiệu hoá' : 'Kích hoạt'}
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(a)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Xoá
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <p className="text-gray-500 text-sm mt-4">
          * Chỉ Admin có thể tạo/sửa/xoá asset. MIB/IB chỉ xem được danh sách.
        </p>
      )}
    </div>
  );
}
