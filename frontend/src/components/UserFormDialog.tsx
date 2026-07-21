'use client';

import { useState } from 'react';
import { CreateUserDto } from '../lib/api/user';
import { Dialog, FormError } from './ui/Dialog';
import { Button, Field, Input, Select } from './ui/primitives';

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (dto: CreateUserDto) => Promise<void>;
  isLoading?: boolean;
}

export default function UserFormDialog({ open, onClose, onSave, isLoading }: UserFormDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'MIB' | 'IB'>('MIB');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError('Email là bắt buộc');
    if (!password.trim()) return setError('Mật khẩu là bắt buộc');
    if (!fullName.trim()) return setError('Họ tên là bắt buộc');

    const dto: CreateUserDto = {
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
      parentId: role === 'IB' && parentId.trim() ? parentId.trim() : undefined,
    };

    try {
      await onSave(dto);
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo User mới"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button type="submit" form="user-form" disabled={isLoading}>
            {isLoading ? 'Đang tạo...' : 'Tạo User'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" disabled={isLoading} />
        </Field>

        <Field label="Mật khẩu" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" disabled={isLoading} />
        </Field>

        <Field label="Họ tên" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyen Van A" disabled={isLoading} />
        </Field>

        <Field label="Vai trò" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as 'MIB' | 'IB')} disabled={isLoading}>
            <option value="MIB">MIB (Root)</option>
            <option value="IB">IB (Con)</option>
          </Select>
        </Field>

        {role === 'IB' && (
          <Field label="Parent ID (chỉ áp dụng với IB)" required hint="Paste UUID của cha. IB phải có parentId; MIB không có parentId.">
            <Input value={parentId} onChange={(e) => setParentId(e.target.value)} placeholder="Paste UUID của cha (MIB hoặc IB đã tồn tại)" disabled={isLoading} />
          </Field>
        )}

        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
