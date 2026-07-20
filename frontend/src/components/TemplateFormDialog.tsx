'use client';

import { useState } from 'react';
import { Asset } from '../lib/api/admin';
import { CreateTemplateDto } from '../lib/api/template';

interface DraftItem {
    assetId: string;
    rebateUnit: number;
    markupPips: number;
}

interface TemplateFormDialogProps {
    open: boolean;
    onClose: () => void;
    assets: Asset[];
    onSave: (dto: CreateTemplateDto) => Promise<void>;
    isLoading?: boolean;
}

export default function TemplateFormDialog({ open, onClose, assets, onSave, isLoading }: TemplateFormDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState<DraftItem[]>([{ assetId: '', rebateUnit: 0, markupPips: 0 }]);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setName('');
        setDescription('');
        setItems([{ assetId: '', rebateUnit: 0, markupPips: 0 }]);
    };

    const updateItem = (idx: number, patch: Partial<DraftItem>) => {
        const next = [...items];
        next[idx] = { ...next[idx], ...patch };
        setItems(next);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError('Tên template là bắt buộc');
            return;
        }

        // Chỉ gửi item đã chọn asset thật — item chưa chọn asset (assetId rỗng) bỏ qua,
        // gửi nguyên như vậy lên backend sẽ bị 400 vì assetId rỗng không hợp lệ.
        const validItems = items
            .filter((it) => it.assetId)
            .map((it) => ({ assetId: it.assetId, rebateUnit: Number(it.rebateUnit) || 0, markupPips: Number(it.markupPips) || 0 }));

        const dto: CreateTemplateDto = {
            name: name.trim(),
            description: description.trim() || undefined,
            items: validItems,
        };

        try {
            await onSave(dto);
            resetForm();
            onClose();
        } catch (err: any) {
            setError(err?.body?.message || err?.message || 'Lỗi không xác định');
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4">Tạo Template mới</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên template *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="VD: Gói Standard"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="border border-gray-200 rounded-md p-4 space-y-2">
                        <h3 className="font-medium text-sm text-gray-700">Template Items</h3>
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-end">
                                <select
                                    value={item.assetId}
                                    onChange={(e) => updateItem(idx, { assetId: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                    disabled={isLoading}
                                >
                                    <option value="">-- Chọn Asset --</option>
                                    {assets.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.code} — {a.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Rebate Unit"
                                    value={item.rebateUnit}
                                    onChange={(e) => updateItem(idx, { rebateUnit: parseFloat(e.target.value) || 0 })}
                                    className="w-28 px-3 py-2 border border-gray-300 rounded-md"
                                    disabled={isLoading}
                                />
                                <input
                                    type="number"
                                    placeholder="Markup Pips"
                                    value={item.markupPips}
                                    onChange={(e) => updateItem(idx, { markupPips: parseFloat(e.target.value) || 0 })}
                                    className="w-28 px-3 py-2 border border-gray-300 rounded-md"
                                    disabled={isLoading}
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setItems([...items, { assetId: '', rebateUnit: 0, markupPips: 0 }])}
                            className="text-sm text-blue-600 hover:underline"
                            disabled={isLoading}
                        >
                            + Thêm item
                        </button>
                        <p className="text-gray-500 text-xs">
                            Asset nào không liệt kê ở đây sẽ tự động có rebateUnit=0, markupPips=0 (backend tự đồng bộ
                            đủ mọi asset hiện có) — hiện dưới dạng "Placeholder" trong bảng sau khi tạo.
                        </p>
                    </div>

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
                            {isLoading ? 'Đang tạo...' : 'Tạo Template'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}