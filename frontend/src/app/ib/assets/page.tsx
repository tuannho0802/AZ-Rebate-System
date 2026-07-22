'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { listAssets, Asset } from '@/lib/api/admin';
import { getMySummary, MyAssetSummary } from '@/lib/api/commission-config';
import { Card, Table, Th, Td, Badge, EmptyState } from '@/components/ui/primitives';

const categoryTone: Record<string, 'amber' | 'indigo' | 'teal' | 'blue' | 'slate' | 'violet'> = {
  FOREX: 'blue',
  METAL: 'amber',
  ENERGY: 'violet',
  COMMODITY: 'teal',
  INDEX: 'indigo',
  SHARES: 'indigo',
  CRYPTO: 'violet',
  OTHER: 'slate',
};

export default function IbAssetsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [mySummary, setMySummary] = useState<Map<string, MyAssetSummary>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
      return;
    }

    Promise.all([
      listAssets(),
      getMySummary().catch(() => [] as MyAssetSummary[]),
    ])
      .then(([assetsList, summaryList]) => {
        setAssets(assetsList);
        const map = new Map<string, MyAssetSummary>();
        for (const s of summaryList) {
          map.set(s.assetId, s);
        }
        setMySummary(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, router]);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('vi-VN');

  if (!user || user.type === 'admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Assets View</h1>
        <p className="text-sm text-slate-500">Danh sách sản phẩm giao dịch và Rebate của bạn.</p>
      </div>

      <Card title="Danh sách Asset" description="Xem thông tin chi tiết các loại sản phẩm giao dịch và hoa hồng tổng nhận của bạn.">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Đang tải danh sách asset & hoa hồng...</div>
        ) : assets.length === 0 ? (
          <EmptyState icon="📦" title="Chưa có asset nào" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Mã</Th>
                <Th>Tên</Th>
                <Th>Danh mục</Th>
                <Th>Trạng thái</Th>
                <Th>Rebate của tôi (MaxPips)</Th>
                <Th className="hidden md:table-cell">Ngày tạo</Th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const summary = mySummary.get(a.id);
                return (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <Td mono>{a.code}</Td>
                    <Td className="font-medium text-slate-900">{a.name}</Td>
                    <Td>
                      <Badge tone={categoryTone[a.category] ?? 'slate'}>{a.category}</Badge>
                    </Td>
                    <Td>
                      {a.isActive ? <Badge tone="emerald">● Active</Badge> : <Badge tone="slate">Ngừng hoạt động</Badge>}
                    </Td>
                    <Td mono className="font-semibold">
                      {summary ? (
                        <span className="text-indigo-600">{summary.transferUnit}</span>
                      ) : (
                        <span className="text-slate-400 font-sans italic text-xs">Chưa cấu hình</span>
                      )}
                    </Td>
                    <Td className="hidden md:table-cell text-slate-400">{formatDate(a.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
