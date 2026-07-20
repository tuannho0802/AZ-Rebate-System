'use client';

import { useState } from 'react';
import { AssetCategory, CreateAssetDto, UpdateAssetDto } from '../lib/api/admin';

type Mode = 'create' | 'edit';

interface AssetFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  initialData?: { id: string; code: string; name: string; category: AssetCategory; isActive: boolean };
  onSave: (dto: CreateAssetDto | UpdateAssetDto) => Promise<void>;
  isLoading?: boolean;
}

export default function AssetFormDialog({
  open,
  onClose,
  mode,
  initialData,
  onSave,
  isLoading,
}: AssetFormDialogProps) {
  const [code, setCode] = useState(initialData?.code ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(initialData?.category ?? 'OTHER');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!code.trim()) {
      setError('Mã asset là bắt buộc');
      return;
    }
    if (!name.trim()) {
      setError('Tên asset là bắt buộc');
      return;
    }

    const dto: CreateAssetDto | UpdateAssetDto =
      mode === 'create'
        ? { code: code.trim(), name: name.trim(), category }
        : { code: code.trim(), name: name.trim(), category, isActive };

    try {
      await onSave(dto);
      onClose();
    } catch (err: any) {
      // Show backend error message (already translated to Vietnamese by backend)
      setError(err?.body?.message || err?.message || 'Lỗi không xác định');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">
          {mode === 'create' ? 'Tạo Asset mới' : `Sửa Asset: ${initialData?.code}`}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'edit' && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Mã hiện tại:</span>
              <span className="font-mono text-sm font-medium">{initialData?.code}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã asset *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: GOLD"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên asset *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Vàng"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="FOREX">FOREX</option>
              <option value="METAL">METAL</option>
              <option value="ENERGY">ENERGY</option>
              <option value="COMMODITY">COMMODITY</option>
              <option value="INDEX">INDEX</option>
              <option value="SHARES">SHARES</option>
              <option value="CRYPTO">CRYPTO</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Kích hoạt
              </label>
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
              {isLoading ? 'Đang lưu...' : mode === 'create' ? 'Tạo' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
