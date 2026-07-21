'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TemplateLockStatus,
  getTemplateLockStatus,
  lockTemplate,
  unlockTemplate,
} from '../lib/api/template';
import { User } from '../lib/api/user';
import { Dialog, FormError } from './ui/Dialog';
import { Badge, Button, EmptyState, Field, Loading, Table, Th, Td } from './ui/primitives';
import { LevelBadge } from './ui/LevelBadge';
import SearchableSelect from './ui/SearchableSelect';

interface ManageTemplateLockDialogProps {
  open: boolean;
  onClose: () => void;
  templates: unknown[]; // kept for backward compat but unused now
  directChildren: User[];
}

/**
 * ManageTemplateLockDialog — Redesigned (A.2):
 * 1. Chọn con trực tiếp trước
 * 2. Tự động load bảng trạng thái lock tất cả template (cùng level) cho con đó
 * 3. Toggle lock/unlock ngay trên từng dòng
 *
 * API flow:
 *   GET  /templates/locks/:userId         → TemplateLockStatus[]
 *   POST /templates/:templateId/lock/:userId
 *   POST /templates/:templateId/unlock/:userId
 */
export default function ManageTemplateLockDialog({
  open,
  onClose,
  directChildren,
}: ManageTemplateLockDialogProps) {
  const [targetUserId, setTargetUserId] = useState('');
  const [lockStatuses, setLockStatuses] = useState<TemplateLockStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load lock statuses when a child is selected
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
    if (open && targetUserId) {
      loadStatuses(targetUserId);
    }
    if (!open) {
      // Reset state when dialog closes
      setTargetUserId('');
      setLockStatuses([]);
      setError(null);
    }
  }, [open, targetUserId, loadStatuses]);

  const handleToggle = async (templateId: string, currentlyLocked: boolean) => {
    if (!targetUserId) return;
    setTogglingId(templateId);
    setError(null);
    try {
      if (currentlyLocked) {
        await unlockTemplate(templateId, targetUserId);
      } else {
        await lockTemplate(templateId, targetUserId);
      }
      // Reload statuses to reflect the change
      await loadStatuses(targetUserId);
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Thao tác thất bại');
    } finally {
      setTogglingId(null);
    }
  };

  const selectedChild = directChildren.find((c) => c.id === targetUserId);

  // Group by level for display
  const groups = new Map<number, TemplateLockStatus[]>();
  for (const t of lockStatuses) {
    const lvl = t.level ?? 0;
    if (!groups.has(lvl)) groups.set(lvl, []);
    groups.get(lvl)!.push(t);
  }
  const sortedLevels = Array.from(groups.keys()).sort((a, b) => a - b);

  const lockedCount = lockStatuses.filter((t) => t.isLocked).length;
  const unlockedCount = lockStatuses.filter((t) => !t.isLocked).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Khóa / Mở khóa Template cho con"
      description="Chọn con trực tiếp để xem & quản lý trạng thái khóa template."
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Step 1: Chọn con trực tiếp */}
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

        {/* Step 2: Bảng trạng thái */}
        {targetUserId && loadingStatuses && <Loading label="Đang tải trạng thái template..." />}

        {targetUserId && !loadingStatuses && lockStatuses.length === 0 && !error && (
          <EmptyState
            icon="📋"
            title="Không có template nào"
            description={`Không tìm thấy template nào phù hợp level của ${selectedChild?.email ?? 'user này'}.`}
          />
        )}

        {targetUserId && !loadingStatuses && lockStatuses.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
              <span className="text-slate-500">
                Tổng <strong className="text-slate-900">{lockStatuses.length}</strong> template
              </span>
              <Badge tone="emerald">🔓 {unlockedCount} đang mở</Badge>
              <Badge tone="slate">🔒 {lockedCount} đang khóa</Badge>
            </div>

            {/* Grouped table */}
            {sortedLevels.map((lvl) => {
              const group = groups.get(lvl) ?? [];
              return (
                <div key={lvl} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <LevelBadge level={lvl} />
                    <span className="text-xs text-slate-400">({group.length} templates)</span>
                  </div>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Tên Template</Th>
                        <Th>Mô tả</Th>
                        <Th>Trạng thái</Th>
                        <Th className="text-right">Thao tác</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((t) => {
                        const isToggling = togglingId === t.id;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70">
                            <Td className="font-medium text-slate-900">{t.name}</Td>
                            <Td className="text-slate-500 text-sm max-w-[200px] truncate">
                              {t.description || <span className="text-slate-300">—</span>}
                            </Td>
                            <Td>
                              {t.isLocked ? (
                                <Badge tone="slate">🔒 Đang khóa</Badge>
                              ) : (
                                <Badge tone="emerald">🔓 Đang mở</Badge>
                              )}
                            </Td>
                            <Td className="text-right">
                              <Button
                                size="sm"
                                variant={t.isLocked ? 'success' : 'danger'}
                                disabled={isToggling}
                                onClick={() => handleToggle(t.id, t.isLocked)}
                              >
                                {isToggling
                                  ? 'Đang xử lý...'
                                  : t.isLocked
                                    ? '🔓 Mở khóa'
                                    : '🔒 Khóa'}
                              </Button>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              );
            })}
          </>
        )}

        <FormError>{error}</FormError>
      </div>
    </Dialog>
  );
}
