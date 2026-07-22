'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { listAssets, Asset } from '../../../lib/api/admin';
import AssetTable from '../../../components/AssetTable';
import { Card } from '../../../components/ui/primitives';

export default function IbAssetsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
      return;
    }
    listAssets().then(setAssets).catch(console.error);
  }, [user, router]);

  if (!user || user.type === 'admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Assets View</h1>
        <p className="text-sm text-slate-500">Danh sách tài sản giao dịch đang hoạt động trong hệ thống (View Only).</p>
      </div>

      <Card title="Asset List" description="Xem thông tin chi tiết các loại asset được cấu hình bởi Admin.">
        <AssetTable assets={assets} />
      </Card>
    </div>
  );
}
