'use client';

import { useState } from 'react';
import { CommissionConfigSelf, CommissionConfigChild } from '../../lib/api/commission-config';
import { Dialog, FormError } from '../ui/Dialog';
import { Button, Field, Input } from '../ui/primitives';

export interface SetConfigDialogProps {
  child: { email: string };
  assetLabel: string;
  existing: CommissionConfigChild | null;
  selfCap: CommissionConfigSelf | null;
  onClose: () => void;
  onSave: (dto: { transferUnit: number }) => Promise<void>;
}

export default function SetConfigDialog({
  child,
  assetLabel,
  existing,
  selfCap,
  onClose,
  onSave,
}: SetConfigDialogProps) {
  const [transferUnit, setTransferUnit] = useState(existing?.transferUnit != null ? String(existing.transferUnit) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({ transferUnit: parseFloat(transferUnit) || 0 });
    } catch (err: any) {
      if (err.status === 409) {
        setError('Dữ liệu đã bị đổi bởi người khác. Đóng form, mở lại để lấy version mới nhất rồi thử lại.');
      } else {
        setError(err?.body?.message || err?.message || 'Lỗi không xác định');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${existing ? 'Sửa' : 'Set'} Config — ${child.email}`}
      description={`Asset: ${assetLabel}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Huỷ
          </Button>
          <Button type="submit" form="set-config-form" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="set-config-form" onSubmit={submit} className="space-y-4">
        {selfCap && (
          <p className="text-xs text-slate-400">
            Trần của bạn cho asset này (MaxPips): {selfCap.transferUnit ?? '—'}
          </p>
        )}
        <Field label="MaxPips (tổng nhận)" required>
          <Input type="number" min="0" step="0.0001" value={transferUnit} onChange={(e) => setTransferUnit(e.target.value)} required disabled={loading} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
