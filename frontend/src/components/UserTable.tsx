'use client';

import { User } from '../lib/api/admin';

interface UserTableProps {
  users: User[];
  loading: boolean;
  currentPage?: number;
  hasMore?: boolean;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}

export default function UserTable({ users, loading, currentPage, hasMore, onPrevPage, onNextPage }: UserTableProps) {
  const formatRole = (role: string) => (role === 'MIB' ? 'MIB (Root)' : 'IB (Con)');
  const formatActive = (active: boolean) => (active ? 'Yes' : 'No');

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-400">Không có user nào</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Full Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2 text-left">Parent</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.fullName || '-'}</td>
                <td className="px-4 py-2">{formatRole(u.role)}</td>
                <td className="px-4 py-2">{formatActive(u.isActive)}</td>
                <td className="px-4 py-2 text-sm text-gray-500">{u.parentId ? u.parentId.slice(0, 8) + '...' : 'Root'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — khong con "total" that tu backend (GET /users tra mang thang),
          dung heuristic: mang tra ve du "limit" phan tu => co the con trang sau */}
      {currentPage && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">Trang {currentPage}</div>
          <div className="space-x-2">
            <button
              onClick={onPrevPage}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Trước
            </button>
            <button
              onClick={onNextPage}
              disabled={!hasMore}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              Tiếp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}