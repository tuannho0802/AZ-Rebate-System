'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { TemplateLockStatus, getTemplateLockStatus, lockTemplate, unlockTemplate } from '@/lib/api/template';
import { User, listUsers } from '@/lib/api/user';
import { Card, Badge, Button, EmptyState, Table, Th, Td, Loading } from '@/components/ui/primitives';
import { FormError } from '@/components/ui/Dialog';
import { LevelBadge } from '@/components/ui/LevelBadge';

export default function TemplateLocksPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [directChildren, setDirectChildren] = useState<User[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [lockStatuses, setLockStatuses] = useState<TemplateLockStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    listUsers({ parentId: user.sub, limit: 100 })
      .then(setDirectChildren)
      .catch(console.error);
  }, [user, isLoading, router]);

  const loadStatuses = useCallback(async (userId: string) => {
    if (!userId) {
      setLockStatuses([]);
      return;
    }
    setLoadingStatuses(true);
    setError(null);
    try {
      const statuses = await getTemplateLockStatus(userId);
      setLockStatuses(statuses);
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Không thể tải trạng thái lock');
      setLockStatuses([]);
    } finally {
      setLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    if (targetUserId) {
      loadStatuses(targetUserId);
    } else {
      setLockStatuses([]);
    }
  }, [targetUserId, loadStatuses]);

  const handleToggleLock = async (status: TemplateLockStatus) => {
    if (!targetUserId) return;
    setTogglingId(status.id);
    setError(null);
    try {
      if (status.isLocked) {
        await unlockTemplate(status.id, targetUserId);
      } else {
        await lockTemplate(status.id, targetUserId);
      }
      await loadStatuses(targetUserId);
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Thao tác lock/unlock thất bại');
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) return null;
  if (!user || user.type === 'admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Template Locks</h1>
        <p className="text-sm text-slate-500">Khóa hoặc mở khóa template hoa hồng cho con trực tiếp của bạn.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Overview Direct Children List */}
        <div className="lg:col-span-1">
          <Card title="Danh sách con trực tiếp" description="Bấm chọn một user để cấu hình khóa template.">
            {directChildren.length === 0 ? (
              <EmptyState title="Chưa có con trực tiếp nào" />
            ) : (
              <div className="space-y-2">
                {directChildren.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTargetUserId(c.id)}
                    className={
                      'w-full text-left px-4 py-3 rounded-lg border transition-all ' +
                      (targetUserId === c.id
                        ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50')
                    }
                  >
                    <div className="font-semibold text-slate-800 text-sm truncate">
                      {c.fullName || c.email}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate">{c.email}</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge tone={c.isActive ? 'emerald' : 'slate'} className="text-[10px] px-1.5 py-0.5">
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-[10px] text-slate-400">cấp {c.level}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Lock/Unlock detail control */}
        <div className="lg:col-span-2">
          <Card title="Trạng thái Template Locks" description="Thiết lập các template được phép hoặc bị cấm áp dụng.">
            <FormError>{error}</FormError>

            {loadingStatuses ? (
              <div className="py-12 text-center text-sm text-slate-400">Đang tải danh sách template lock...</div>
            ) : targetUserId && lockStatuses.length === 0 ? (
              <EmptyState title="Không tìm thấy template tương thích" description="User này không có template nào trùng khớp level để hiển thị." />
            ) : targetUserId ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Tên Template</Th>
                    <Th className="hidden md:table-cell">Mô tả</Th>
                    <Th>Level</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Hành động</Th>
                  </tr>
                </thead>
                <tbody>
                  {lockStatuses.map((status) => (
                    <tr key={status.id} className="hover:bg-slate-50/70">
                      <Td className="font-medium text-slate-900">{status.name}</Td>
                      <Td className="hidden md:table-cell text-slate-500">{status.description || '—'}</Td>
                      <Td>
                        <LevelBadge level={status.level} />
                      </Td>
                      <Td>
                        {status.isLocked ? (
                          <Badge tone="rose">Bị Khóa (Locked)</Badge>
                        ) : (
                          <Badge tone="emerald">Khả Dụng</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant={status.isLocked ? 'success' : 'danger'}
                          onClick={() => handleToggleLock(status)}
                          disabled={togglingId === status.id}
                        >
                          {togglingId === status.id ? 'Đang xử lý...' : status.isLocked ? 'Mở Khóa' : 'Khóa'}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="Chưa chọn tài khoản con" description="Vui lòng bấm chọn một tài khoản con ở danh sách bên trái để hiển thị danh sách locks." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
