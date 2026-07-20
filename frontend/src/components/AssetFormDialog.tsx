'use client';

import { useState } from 'react';
import { AssetCategory, CreateAssetDto, UpdateAssetDto } from '../lib/api/admin';
import { Dialog, FormError } from './ui/Dialog';
import { Button, Field, Input, Select } from './ui/primitives';

type Mode = 'create' | 'edit';

interface AssetFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  initialData?: { id: string; code: string; name: string; category: AssetCategory; isActive: boolean };
  onSave: (dto: CreateAssetDto | UpdateAssetDto) => Promise<void>;
  isLoading?: boolean;
}

const categories: AssetCategory[] = ['FOREX', 'METAL', 'ENERGY', 'COMMODITY', 'INDEX', 'SHARES', 'CRYPTO', 'OTHER'];

export default function AssetFormDialog({ open, onClose, mode, initialData, onSave, isLoading }: AssetFormDialogProps) {
  const [code, setCode] = useState(initialData?.code ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(initialData?.category ?? 'OTHER');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) return setError('Mã asset là bắt buộc');
    if (!name.trim()) return setError('Tên asset là bắt buộc');

    const dto: CreateAssetDto | UpdateAssetDto =
      mode === 'create'
        ? { code: code.trim(), name: name.trim(), category }
        : { code: code.trim(), name: name.trim(), category, isActive };

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
      title={mode === 'create' ? 'Tạo Asset mới' : `Sửa Asset: ${initialData?.code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button type="submit" form="asset-form" disabled={isLoading}>
            {isLoading ? 'Đang lưu...' : mode === 'create' ? 'Tạo' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="asset-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Mã asset" required>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: GOLD" disabled={isLoading} />
        </Field>

        <Field label="Tên asset" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Vàng" disabled={isLoading} />
        </Field>

        <Field label="Danh mục" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value as AssetCategory)} disabled={isLoading}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        {mode === 'edit' && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Kích hoạt asset này
          </label>
        )}

        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
