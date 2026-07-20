'use client';

import { Asset } from '../lib/api/admin';
import { useAuth } from '../context/auth-context';
import { Badge, Button, EmptyState, Table, Th, Td } from './ui/primitives';

interface AssetTableProps {
  assets: Asset[];
  onEditName?: (asset: Asset) => void;
  onToggleActive?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
}

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

export default function AssetTable({ assets, onEditName, onToggleActive, onDelete }: AssetTableProps) {
  const { user } = useAuth();
  const isAdmin = user?.type === 'admin';

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('vi-VN');

  if (assets.length === 0) {
    return <EmptyState icon="📦" title="Chưa có asset nào" description={isAdmin ? 'Tạo asset đầu tiên để bắt đầu cấu hình hoa hồng.' : undefined} />;
  }

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <Th>Mã</Th>
            <Th>Tên</Th>
            <Th>Danh mục</Th>
            <Th>Trạng thái</Th>
            <Th className="hidden md:table-cell">Ngày tạo</Th>
            {isAdmin && <Th className="text-right">Thao tác</Th>}
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="group hover:bg-slate-50/70">
              <Td mono>{a.code}</Td>
              <Td className="font-medium text-slate-900">{a.name}</Td>
              <Td>
                <Badge tone={categoryTone[a.category] ?? 'slate'}>{a.category}</Badge>
              </Td>
              <Td>
                {a.isActive ? <Badge tone="emerald">● Active</Badge> : <Badge tone="slate">Ngừng hoạt động</Badge>}
              </Td>
              <Td className="hidden md:table-cell text-slate-400">{formatDate(a.createdAt)}</Td>
              {isAdmin && (
                <Td className="text-right whitespace-nowrap">
                  <div className="inline-flex gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    {onEditName && (
                      <Button size="sm" variant="ghost" onClick={() => onEditName(a)}>
                        Sửa
                      </Button>
                    )}
                    {onToggleActive && (
                      <Button size="sm" variant="ghost" onClick={() => onToggleActive(a)}>
                        {a.isActive ? 'Vô hiệu hoá' : 'Kích hoạt'}
                      </Button>
                    )}
                    {onDelete && (
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => onDelete(a)}>
                        Xoá
                      </Button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      {!isAdmin && (
        <p className="text-xs text-slate-400 mt-4">Chỉ Admin có thể tạo, sửa hoặc xoá asset. MIB/IB chỉ xem được danh sách.</p>
      )}
    </div>
  );
}
