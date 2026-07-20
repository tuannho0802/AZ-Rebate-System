'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { listAssets, Asset } from '../../lib/api/admin';
import AssetTable from '../../components/AssetTable';
import CommissionManager from '../../components/CommissionManager';
import { PageShell, TopNav, PageBody, Card } from '../../components/ui/primitives';

export default function IbPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
    }
    listAssets().then(setAssets).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || user.type === 'admin') return null;

  return (
    <PageShell>
      <TopNav roleKind="IB" title="IB Dashboard" subtitle="Rebate System" userEmail={user.email} onLogout={logout} />

      <PageBody>
        <p className="text-sm text-slate-500">
          Xin chào <strong className="text-slate-800">{user.email}</strong> — đây là bảng điều khiển IB của bạn.
        </p>

        <CommissionManager />

        <Card title="Asset List" description="Danh sách tài sản (view-only). Chọn Asset để cấu hình hoa hồng cho con trực tiếp.">
          <AssetTable assets={assets} />
        </Card>
      </PageBody>
    </PageShell>
  );
}
