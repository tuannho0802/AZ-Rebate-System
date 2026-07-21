'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import CommissionManager from '../../components/CommissionManager';
import { Asset, listAssets } from '../../lib/api/admin';
import { User, SubtreeNode, listUsers, getSubtree } from '../../lib/api/user';
import AssetTable from '../../components/AssetTable';
import { PageShell, TopNav, PageBody, Card, ActiveBadge, RoleBadge, EmptyState, Loading } from '../../components/ui/primitives';
import SubtreeTree, { buildSubtreeHierarchy } from '../../components/tree/SubtreeTree';

export default function MibPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [userList, setUserList] = useState<User[]>([]);
  const [subtree, setSubtree] = useState<SubtreeNode[]>([]);
  const [subtreeRoot, setSubtreeRoot] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingSubtree, setLoadingSubtree] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.sub) {
      // Không truyền limit sẽ dùng page size mặc định của backend (nhỏ hơn 100),
      // khiến lưới "Cây con cháu" âm thầm thiếu user khi MIB có nhiều con/cháu
      // hơn 1 trang. Truyền limit=100 (giới hạn tối đa cho phép) để tránh mất user.
      listUsers({ limit: 100 }).then(setUserList).catch(console.error);
    }
    listAssets().then(setAssets).catch(console.error);
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

  if (!user || user.type === 'admin') return null;

  return (
    <PageShell>
      <TopNav roleKind="MIB" title="MIB Dashboard" subtitle="Rebate System" userEmail={user.email} onLogout={logout} />

      <PageBody>
        <p className="text-sm text-slate-500">
          Xin chào <strong className="text-slate-800">{user.email}</strong>. Xem toàn bộ cây con cháu của bạn bên dưới
          (view-only). Phần quản lý/cấu hình chỉ áp dụng cho <strong>con trực tiếp (Lv1)</strong>.
        </p>

        <Card title="Cây con cháu (Subtree)" description="Bấm vào một user để xem toàn bộ cây con của họ.">
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
                    <RoleBadge role={u.role} />
                    <ActiveBadge active={u.isActive} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {loadingSubtree && <Loading label="Đang tải cây con..." />}

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

        <CommissionManager />

        <Card title="Asset List" description="Danh sách tài sản (view-only). Chọn Asset để cấu hình hoa hồng cho con trực tiếp.">
          <AssetTable assets={assets} />
        </Card>
      </PageBody>
    </PageShell>
  );
}