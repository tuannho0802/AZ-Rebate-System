'use client';

import { User } from '../lib/api/user';
import { ActiveBadge, Button, EmptyState, Loading, RoleBadge, Table, Th, Td } from './ui/primitives';
import { IdDisplay, buildUserMap } from './ui/IdDisplay';

interface UserTableProps {
  users: User[];
  loading: boolean;
  currentPage?: number;
  hasMore?: boolean;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onEdit?: (user: User) => void;
  onViewSubtree?: (id: string) => void;
}

export default function UserTable({ users, loading, currentPage, hasMore, onPrevPage, onNextPage, onEdit, onViewSubtree }: UserTableProps) {
  if (loading) return <Loading label="Đang tải danh sách user..." />;

  if (users.length === 0) {
    return <EmptyState icon="👥" title="Không có user nào" description="Thử xoá bộ lọc hoặc tạo user mới." />;
  }

  const userMap = buildUserMap(users);

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th className="hidden sm:table-cell">Họ tên</Th>
            <Th>Vai trò</Th>
            <Th>Trạng thái</Th>
            <Th className="hidden md:table-cell">Cha (parent)</Th>
            <Th className="text-right">Thao tác</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50/70">
              <Td className="font-medium text-slate-900">{u.email}</Td>
              <Td className="hidden sm:table-cell">{u.fullName || <span className="text-slate-300">—</span>}</Td>
              <Td>
                <RoleBadge role={u.role} />
              </Td>
              <Td>
                <ActiveBadge active={u.isActive} />
              </Td>
              <Td className="hidden md:table-cell">
                {u.parentId ? (
                  <IdDisplay id={u.parentId} map={userMap} />
                ) : (
                  <span className="font-sans text-slate-400 italic">Root</span>
                )}
              </Td>
              <Td className="text-right whitespace-nowrap">
                {onViewSubtree && (
                  <Button size="sm" variant="success" onClick={() => onViewSubtree(u.id)} className="mr-2">
                    Xem Sub-tree
                  </Button>
                )}
                {onEdit && (
                  <Button size="sm" variant="secondary" onClick={() => onEdit(u)}>
                    Sửa
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {currentPage && (
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-400">Trang {currentPage}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onPrevPage} disabled={currentPage === 1}>
              ← Trước
            </Button>
            <Button size="sm" variant="secondary" onClick={onNextPage} disabled={!hasMore}>
              Tiếp →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
