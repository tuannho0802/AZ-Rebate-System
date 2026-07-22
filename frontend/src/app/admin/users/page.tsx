'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { User, SubtreeNode, listUsers, createUser, updateUser, getSubtree } from '../../../lib/api/user';
import UserTable from '../../../components/UserTable';
import UserFormDialog from '../../../components/UserFormDialog';
import SubtreeTree, { buildSubtreeHierarchy, TreeSubtreeNode } from '../../../components/tree/SubtreeTree';
import { PageShell, PageBody, Card, Button, Field, Input, Loading, EmptyState } from '../../../components/ui/primitives';
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

  // New states for Subtree and Edit
  const [viewMode, setViewMode] = useState<'table' | 'subtree'>('table');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [subtreeRootId, setSubtreeRootId] = useState('');
  const [treeRoot, setTreeRoot] = useState<TreeSubtreeNode | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    if (viewMode === 'table') {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, parentId, isLoading, user, viewMode]);

  useEffect(() => {
    if (viewMode === 'subtree' && subtreeRootId) {
      loadSubtree(subtreeRootId);
    }
  }, [viewMode, subtreeRootId]);

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

  const loadSubtree = async (rootId: string) => {
    setIsLoadingTree(true);
    try {
      const nodes = await getSubtree(rootId);
      // We need to fetch User details for these nodes.
      // For simplicity, we can fetch all users or we could fetch by IDs.
      // Since listUsers might not return all if paginated, let's fetch with a high valid limit.
      const allUsers = await listUsers({ limit: 100 });
      const userMap = new Map<string, User>();
      allUsers.forEach((u) => userMap.set(u.id, u));
      
      const hierarchy = buildSubtreeHierarchy(nodes, userMap);
      setTreeRoot(hierarchy);
    } catch (error: any) {
      console.error('Failed to load subtree:', error);
      setTreeRoot(null);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleSaveUser = async (dto: any) => {
    setIsLoadingSave(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, dto);
      } else {
        await createUser(dto);
      }
      setIsDialogOpen(false);
      setEditingUser(null);
      if (viewMode === 'table') await loadUsers();
      if (viewMode === 'subtree' && subtreeRootId) await loadSubtree(subtreeRootId);
    } finally {
      setIsLoadingSave(false);
    }
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (u: User) => {
    setEditingUser(u);
    setIsDialogOpen(true);
  };

  const handleViewSubtree = (id: string) => {
    setSubtreeRootId(id);
    setViewMode('subtree');
  };

  const handleSwitchToSubtree = () => {
    if (parentId && !subtreeRootId) {
      setSubtreeRootId(parentId);
    }
    setViewMode('subtree');
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
          description={viewMode === 'table' ? `${users.length} user${hasMore ? '+' : ''} · trang ${page}` : "Xem cây phân cấp cha-con"}
          actions={
            <Button onClick={openCreateDialog}>+ Tạo User mới</Button>
          }
        >
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Danh sách
            </button>
            <button
              onClick={handleSwitchToSubtree}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'subtree' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cây phân cấp
            </button>
          </div>

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

          {viewMode === 'table' ? (
            <UserTable
              users={users}
              loading={isLoadingList}
              currentPage={page}
              hasMore={hasMore}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onEdit={openEditDialog}
              onViewSubtree={handleViewSubtree}
            />
          ) : (
            <div className="min-h-[300px]">
              {!subtreeRootId ? (
                <EmptyState icon="🌳" title="Chưa chọn gốc cây" description="Vui lòng Lọc theo Cha ở trên, hoặc bấm 'Xem cây con' từ một user trong Danh sách." />
              ) : isLoadingTree ? (
                <Loading label="Đang tải cây phân cấp..." />
              ) : !treeRoot ? (
                <EmptyState icon="⚠️" title="Lỗi tải cây" description="Không thể tải cây phân cấp cho user này." />
              ) : (
                <SubtreeTree root={treeRoot} defaultExpandedDepth={3} onEditNode={openEditDialog} />
              )}
            </div>
          )}
        </Card>

        <UserFormDialog 
          open={isDialogOpen} 
          onClose={() => setIsDialogOpen(false)} 
          onSave={handleSaveUser} 
          users={users} 
          isLoading={isLoadingSave} 
          mode={editingUser ? 'edit' : 'create'}
          initialData={editingUser}
        />
      </PageBody>
    </PageShell>
  );
}

