'use client';

import { useRouter } from 'next/navigation';
import { User } from '../../lib/api/user';
import { Asset } from '../../lib/api/admin';
import { CommissionConfigChild } from '../../lib/api/commission-config';
import {
  ActiveBadge,
  Button,
  Card,
  EmptyState,
  Loading,
  Table,
  Th,
  Td,
} from '../ui/primitives';

export interface DirectChildrenTableProps {
  directChildren: User[];
  childrenConfig: Map<string, CommissionConfigChild>;
  selectedAsset: Asset | undefined;
  selectedAssetId: string;
  loadingChildren: boolean;
  rolePath: 'mib' | 'ib';
  onCreateChild: () => void;
  onOpenApplyTemplate: () => void;
  onOpenLockTemplate: () => void;
}

export default function DirectChildrenTable({
  directChildren,
  childrenConfig,
  selectedAsset,
  selectedAssetId,
  loadingChildren,
  rolePath,
  onCreateChild,
  onOpenApplyTemplate,
  onOpenLockTemplate,
}: DirectChildrenTableProps) {
  const router = useRouter();

  return (
    <Card
      title="Con trực tiếp của bạn"
      description={selectedAsset ? `Đang xem cấu hình cho asset ${selectedAsset.code}` : undefined}
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={onOpenLockTemplate}>
            Khóa/Mở khóa Template
          </Button>
          <Button size="sm" variant="secondary" onClick={onOpenApplyTemplate}>
            Áp dụng Template
          </Button>
          <Button size="sm" onClick={onCreateChild}>
            + Tạo tài khoản con
          </Button>
        </>
      }
    >
      {loadingChildren && <Loading label="Đang tải cấu hình..." />}
      {!loadingChildren && directChildren.length === 0 ? (
        <EmptyState icon="👤" title="Chưa có con trực tiếp nào" description='Bấm "+ Tạo tài khoản con" để bắt đầu.' />
      ) : (
        !loadingChildren && (
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th className="hidden md:table-cell">Họ tên</Th>
                <Th>Trạng thái</Th>
                <Th>MaxPips</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {directChildren.map((child) => {
                const cfg = childrenConfig.get(child.id);
                return (
                  <tr key={child.id} className="hover:bg-slate-50/70">
                    <Td className="font-medium text-slate-900">{child.email}</Td>
                    <Td className="hidden md:table-cell">{child.fullName || <span className="text-slate-300">—</span>}</Td>
                    <Td>
                      <ActiveBadge active={child.isActive} />
                    </Td>
                    <Td mono>{cfg?.transferUnit ?? <span className="font-sans text-slate-300">chưa set</span>}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/${rolePath}/config/${child.id}`)}>
                        Quản lý
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )
      )}
    </Card>
  );
}
