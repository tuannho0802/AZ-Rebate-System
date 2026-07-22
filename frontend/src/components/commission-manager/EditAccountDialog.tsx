'use client';

import { useState } from 'react';
import { Dialog, FormError } from '../ui/Dialog';
import { Button, Field, Input } from '../ui/primitives';

export interface EditAccountDialogProps {
  user: { email: string; fullName?: string | null; isActive: boolean };
  onClose: () => void;
  onSave: (dto: { fullName: string; isActive: boolean }) => Promise<void>;
}

export default function EditAccountDialog({
  user,
  onClose,
  onSave,
}: EditAccountDialogProps) {
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({ fullName, isActive });
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Sửa tài khoản: ${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Huỷ
          </Button>
          <Button type="submit" form="edit-account-form" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="edit-account-form" onSubmit={submit} className="space-y-4">
        <Field label="Họ tên">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Tài khoản đang hoạt động
        </label>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
