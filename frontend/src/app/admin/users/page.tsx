'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { User, listUsers, createUser } from '../../../lib/api/user';
import UserTable from '../../../components/UserTable';
import UserFormDialog from '../../../components/UserFormDialog';
import { PageShell, PageBody, Card, Button, Field, Input } from '../../../components/ui/primitives';
import SearchableSelect from '../../../components/ui/SearchableSelect';

export default function AdminUsersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [parentId, setParentId] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingSave, setIsLoadingSave] = useState(false);

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, parentId, isLoading, user]);

  const loadUsers = async () => {
    setIsLoadingList(true);
    try {
      const params: { page?: number; limit?: number; parentId?: string } = { page, limit };
      if (parentId) params.parentId = parentId.trim();
      const data = await listUsers(params);
      setUsers(data);
      setHasMore(data.length === limit);
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
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => p + 1);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <PageShell>

      <PageBody>
        <Card
          title="Danh sách User"
          description={`${users.length} user${hasMore ? '+' : ''} · trang ${page}`}
          actions={
            <Button onClick={() => setIsDialogOpen(true)}>+ Tạo User mới</Button>
          }
        >
          <form onSubmit={handleFilter} className="flex flex-wrap gap-3 items-end mb-6 pb-6 border-b border-slate-100">
            <div className="w-64">
              <Field label="Lọc theo Cha (Parent User)">
                <SearchableSelect
                  options={users.map((u) => ({
                    id: u.id,
                    label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
                    sublabel: u.email,
                    tag: u.role,
                  }))}
                  value={parentId}
                  onChange={(val) => setParentId(val)}
                  placeholder="Chọn User cha..."
                />
              </Field>
            </div>
            <div className="w-28">
              <Field label="Limit">
                <Input type="number" value={limit} min={1} max={100} onChange={(e) => setLimit(parseInt(e.target.value) || 20)} />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Lọc
            </Button>
            {parentId && (
              <Button type="button" variant="ghost" onClick={() => { setParentId(''); setPage(1); }}>
                Reset filter
              </Button>
            )}
          </form>

          <UserTable
            users={users}
            loading={isLoadingList}
            currentPage={page}
            hasMore={hasMore}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </Card>

        <UserFormDialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSave={handleCreateUser} users={users} isLoading={isLoadingSave} />
      </PageBody>
    </PageShell>
  );
}

