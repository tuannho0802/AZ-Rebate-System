'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { TemplateLockStatus, getTemplateLockStatus, lockTemplate, unlockTemplate } from '../../../lib/api/template';
import { User, listUsers } from '../../../lib/api/user';
import { Card, Field, Badge, Button, EmptyState, Table, Th, Td, Loading } from '../../../components/ui/primitives';
import { FormError } from '../../../components/ui/Dialog';
import { LevelBadge } from '../../../components/ui/LevelBadge';
import SearchableSelect from '../../../components/ui/SearchableSelect';

export default function IbLocksPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [directChildren, setDirectChildren] = useState<User[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [lockStatuses, setLockStatuses] = useState<TemplateLockStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [user, router]);

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

  if (!user || user.type === 'admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Template Locks</h1>
        <p className="text-sm text-slate-500">Khóa hoặc mở khóa template hoa hồng cho con trực tiếp của bạn.</p>
      </div>

      <Card title="Chọn tài khoản con để thiết lập" description="Quyết định template nào được phép hoặc bị cấm áp dụng.">
        <div className="max-w-xl mb-6">
          <Field label="Chọn con trực tiếp" required>
            <SearchableSelect
              options={directChildren.map((c) => ({
                id: c.id,
                label: c.fullName ? `${c.fullName} (${c.email})` : c.email,
                sublabel: c.email,
              }))}
              value={targetUserId}
              onChange={setTargetUserId}
              placeholder="Chọn con trực tiếp..."
            />
          </Field>
          <FormError>{error}</FormError>
        </div>

        {loadingStatuses ? (
          <Loading label="Đang tải danh sách template lock..." />
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
                      {togglingId === status.id ? 'Đang xử lý...' : status.isLocked ? 'Mở Khóa' : 'Khóa Lại'}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Chưa chọn tài khoản" description="Vui lòng chọn một tài khoản con từ dropdown phía trên để quản lý khóa template." />
        )}
      </Card>
    </div>
  );
}
