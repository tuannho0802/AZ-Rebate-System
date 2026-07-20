'use client';

import { useState } from 'react';
import { CreateUserDto } from '../lib/api/admin';

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (dto: CreateUserDto) => Promise<void>;
  isLoading?: boolean;
}

export default function UserFormDialog({
  open,
  onClose,
  onSave,
  isLoading,
}: UserFormDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'MIB' | 'IB'>('MIB');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email.trim()) {
      setError('Email là bắt buộc');
      return;
    }
    if (!password.trim()) {
      setError('Mật khẩu là bắt buộc');
      return;
    }
    if (!fullName.trim()) {
      setError('Họ tên là bắt buộc');
      return;
    }

    const dto: CreateUserDto = {
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
      parentId: role === 'IB' && parentId.trim() ? parentId.trim() : undefined,
    };

    try {
      await onSave(dto);
      onClose();
    } catch (err: any) {
      // Backend error message (already translated to Vietnamese)
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Tạo User mới</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="******"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nguyen Van A"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'MIB' | 'IB')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="MIB">MIB (Root)</option>
              <option value="IB">IB (Con)</option>
            </select>
          </div>

          {role === 'IB' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent ID (chỉ áp dụng với IB) *</label>
              <input
                type="text"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste UUID của cha (MIB hoặc IB đã tồn tại)"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste UUID của cha. IB phải có parentId; MIB không có parentId.
              </p>
            </div>
          )}

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Đang tạo...' : 'Tạo User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
