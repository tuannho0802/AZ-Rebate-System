'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { User, SubtreeNode, listUsers, getSubtree } from '../../../lib/api/user';
import {
  PageShell,
  TopNav,
  PageBody,
  Card,
  ActiveBadge,
  EmptyState,
  Loading,
} from '../../../components/ui/primitives';
import SubtreeTree, { buildSubtreeHierarchy } from '../../../components/tree/SubtreeTree';

export default function MibTreePage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const [userList, setUserList] = useState<User[]>([]);
  const [subtree, setSubtree] = useState<SubtreeNode[]>([]);
  const [subtreeRoot, setSubtreeRoot] = useState<string | null>(null);
  const [loadingSubtree, setLoadingSubtree] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
      return;
    }
    if (user.role !== 'MIB') {
      router.push('/ib');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.sub) {
      listUsers({ limit: 100 }).then(setUserList).catch(console.error);
    }
  }, [user]);

  const loadSubtree = async (userId: string) => {
    setLoadingSubtree(true);
    setSubtreeRoot(userId);
    try {
      const nodes = await getSubtree(userId);
      setSubtree(nodes);
    } catch (error: any) {
      alert(`Failed to load subtree: ${error.message}`);
    } finally {
      setLoadingSubtree(false);
    }
  };

  const userById = new Map(userList.map((u) => [u.id, u]));

  if (isLoading) return null;
  if (!user || user.type === 'admin' || user.role !== 'MIB') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cây con cháu (Subtree)</h1>
        <p className="text-sm text-slate-500">
          Xem toàn bộ sơ đồ hình cây của các con cháu cấp dưới (view-only). Bấm vào một user để tải và hiển thị sơ đồ.
        </p>
      </div>

      <Card title="Chọn User để xem cây con cháu" description="Danh sách các tài khoản cấp dưới của bạn.">
        {userList.length === 0 ? (
          <Loading label="Đang tải danh sách user..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {userList.map((u) => (
              <button
                key={u.id}
                onClick={() => loadSubtree(u.id)}
                className={
                  'text-left px-4 py-3 rounded-lg border transition-colors ' +
                  (subtreeRoot === u.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100')
                }
              >
                <div className="font-medium text-slate-900 truncate" title={u.id}>{u.email}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <ActiveBadge active={u.isActive} />
                  <span className="text-xs text-slate-400">cấp {u.level}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {loadingSubtree && <Loading label="Đang tải sơ đồ cây..." />}

        {!loadingSubtree && subtree.length > 0 && (() => {
          const rootTree = buildSubtreeHierarchy(subtree, userById);
          return (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Cấu trúc cây con (Subtree View)</h3>
              {rootTree ? (
                <SubtreeTree root={rootTree} defaultExpandedDepth={2} currentActorId={user.sub} />
              ) : (
                <EmptyState title="User này chưa có con" />
              )}
              <p className="text-xs text-slate-400 mt-3">Click vào biểu tượng icon (► / ▼) để thu gọn hoặc mở rộng từng nhánh cây.</p>
            </div>
          );
        })()}

        {!loadingSubtree && subtree.length === 0 && subtreeRoot && (
          <EmptyState title="User này chưa có con" />
        )}
      </Card>
    </div>
  );
}
