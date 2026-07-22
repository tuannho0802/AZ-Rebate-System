'use client';

import { useState } from 'react';
import { Dialog, FormError } from '../ui/Dialog';
import { Button, Field, Input } from '../ui/primitives';

export interface CreateChildDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (dto: { email: string; password: string; fullName: string }) => Promise<void>;
}

export default function CreateChildDialog({
  open,
  onClose,
  onSave,
}: CreateChildDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSave({ email, password, fullName });
      reset();
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo tài khoản con mới (IB)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="submit" form="create-child-form" disabled={loading}>
            {loading ? 'Đang tạo...' : 'Tạo con trực tiếp'}
          </Button>
        </>
      }
    >
      <form id="create-child-form" onSubmit={submit} className="space-y-4">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
        </Field>
        <Field label="Mật khẩu" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
        </Field>
        <Field label="Họ tên">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
