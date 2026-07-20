'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { User, listUsers, createUser } from '../../../lib/api/admin';
import UserTable from '../../../components/UserTable';
import UserFormDialog from '../../../components/UserFormDialog';

export default function AdminUsersPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [parentId, setParentId] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingSave, setIsLoadingSave] = useState(false);

  // Load users khi page/limit/parentId thay đổi
  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    loadUsers();
  }, [page, limit, parentId, isLoading, user]);

  const loadUsers = async () => {
    setIsLoadingList(true);
    try {
      const params: { page?: number; limit?: number; parentId?: string } = { page, limit };
      if (parentId) params.parentId = parentId.trim();
      const data = await listUsers(params); // data la User[] thang, khong co .data/.total
      setUsers(data);
      setHasMore(data.length === limit); // heuristic: du limit -> co the con trang sau
    } catch (error: any) {
      console.error('Failed to load users:', error);
      setUsers([]);
      setHasMore(false);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleCreateUser = async (dto: any) => {
    setIsLoadingSave(true);
    try {
      await createUser(dto);
      await loadUsers();
    } catch (error: any) {
      // Backend error message (already translated to Vietnamese)
      alert(`Tạo user thất bại: ${error?.body?.message || error?.message || 'Lỗi không xác định'}`);
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => p + 1);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset về trang 1 khi filter
    loadUsers();
  };

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">User Management</h1>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filter Form */}
        <form onSubmit={handleFilter} className="mb-6 flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent ID (filter)</label>
            <input
              type="text"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded"
              placeholder="Paste UUID cha (tùy chọn)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              className="w-24 px-3 py-2 border border-gray-300 rounded"
              min={1}
              max={100}
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Lọc
          </button>
          <button
            type="button"
            onClick={() => { setParentId(''); setPage(1); }}
            className="text-gray-600 hover:underline text-sm"
          >
            Reset filter
          </button>
        </form>

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Tạo User mới
          </button>
        </div>

        {/* User Table */}
        <UserTable
          users={users}
          loading={isLoadingList}
          currentPage={page}
          hasMore={hasMore}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />

        {/* Create User Dialog */}
        <UserFormDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleCreateUser}
          isLoading={isLoadingSave}
        />
      </div>
    </div>
  );
}