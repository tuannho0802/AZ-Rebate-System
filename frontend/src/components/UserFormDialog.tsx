'use client';

import { useState, useEffect } from 'react';
import { CreateUserDto, User } from '../lib/api/user';
import { Dialog, FormError } from './ui/Dialog';
import { Button, Field, Input, Select } from './ui/primitives';
import SearchableSelect from './ui/SearchableSelect';

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (dto: any) => Promise<void>;
  users?: User[];
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  initialData?: User | null;
}

export default function UserFormDialog({ open, onClose, onSave, users = [], isLoading, mode = 'create', initialData }: UserFormDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'MIB' | 'IB'>('MIB');
  const [parentId, setParentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize fields on open
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        setEmail(initialData.email);
        setFullName(initialData.fullName || '');
        setRole(initialData.role);
        setParentId(initialData.parentId || '');
        setIsActive(initialData.isActive);
        setPassword('');
      } else {
        setEmail('');
        setFullName('');
        setRole('MIB');
        setParentId('');
        setIsActive(true);
        setPassword('');
      }
      setError(null);
    }
  }, [open, mode, initialData]);

  const parentOptions = users.map((u) => ({
    id: u.id,
    label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
    sublabel: u.email,
    tag: u.role,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'create') {
      if (!email.trim()) return setError('Email là bắt buộc');
      if (!password.trim()) return setError('Mật khẩu là bắt buộc');
      if (!fullName.trim()) return setError('Họ tên là bắt buộc');
      if (role === 'IB' && !parentId.trim()) return setError('Parent ID là bắt buộc khi tạo IB');

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
    } else {
      // Edit mode: only fullName and isActive are allowed
      if (!fullName.trim()) return setError('Họ tên là bắt buộc');

      try {
        await onSave({ fullName: fullName.trim(), isActive });
      } catch (err: any) {
        setError(err?.body?.message || err?.message || 'Lỗi không xác định');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo User mới' : 'Chỉnh sửa User'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button type="submit" form="user-form" disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : mode === 'create' ? 'Tạo User' : 'Lưu thay đổi'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" required={mode === 'create'}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" disabled={isLoading || mode === 'edit'} />
        </Field>

        {mode === 'create' && (
          <Field label="Mật khẩu" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" disabled={isLoading} />
          </Field>
        )}

        <Field label="Họ tên" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyen Van A" disabled={isLoading} />
        </Field>

        <Field label="Vai trò" required={mode === 'create'}>
          <Select value={role} onChange={(e) => setRole(e.target.value as 'MIB' | 'IB')} disabled={isLoading || mode === 'edit'}>
            <option value="MIB">MIB (Root)</option>
            <option value="IB">IB (Con)</option>
          </Select>
        </Field>

        {role === 'IB' && (
          <Field label="Người quản lý (Parent User)" required={mode === 'create'} hint="Chọn MIB hoặc IB đã tồn tại làm cha quản lý trực tiếp.">
            <SearchableSelect
              options={parentOptions}
              value={parentId}
              onChange={setParentId}
              placeholder="Gõ để tìm kiếm theo Tên hoặc Email..."
              disabled={isLoading || mode === 'edit'}
              emptyMessage="Không tìm thấy User nào"
            />
          </Field>
        )}

        {mode === 'edit' && (
          <Field label="Trạng thái hoạt động">
            <Select value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')} disabled={isLoading}>
              <option value="true">Đang hoạt động</option>
              <option value="false">Đã vô hiệu hóa</option>
            </Select>
          </Field>
        )}

        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}