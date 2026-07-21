'use client';

import { useState } from 'react';
import { Asset } from '../lib/api/admin';
import { CreateTemplateDto } from '../lib/api/template';
import { Dialog, FormError } from './ui/Dialog';
import { Button, Field, Input, Select } from './ui/primitives';

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
    const [level, setLevel] = useState(0);
    const [items, setItems] = useState<DraftItem[]>([{ assetId: '', rebateUnit: 0, markupPips: 0 }]);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setName('');
        setDescription('');
        setLevel(0);
        setItems([{ assetId: '', rebateUnit: 0, markupPips: 0 }]);
    };

    const updateItem = (idx: number, patch: Partial<DraftItem>) => {
        const next = [...items];
        next[idx] = { ...next[idx], ...patch };
        setItems(next);
    };

    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return setError('Tên template là bắt buộc');

        // Chỉ gửi item đã chọn asset thật — item chưa chọn asset (assetId rỗng) bỏ qua,
        // gửi nguyên như vậy lên backend sẽ bị 400 vì assetId rỗng không hợp lệ.
        const validItems = items
            .filter((it) => it.assetId)
            .map((it) => ({ assetId: it.assetId, rebateUnit: Number(it.rebateUnit) || 0, markupPips: Number(it.markupPips) || 0 }));

        const dto: CreateTemplateDto = {
            name: name.trim(),
            description: description.trim() || undefined,
            level,
            items: validItems,
        };

        try {
            await onSave(dto);
            resetForm();
        } catch (err: any) {
            setError(err?.body?.message || err?.message || 'Lỗi không xác định');
        }
    };

    const usedAssetIds = new Set(items.map((i) => i.assetId).filter(Boolean));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Tạo Template mới"
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Hủy
                    </Button>
                    <Button type="submit" form="template-form" disabled={isLoading}>
                        {isLoading ? 'Đang tạo...' : 'Tạo Template'}
                    </Button>
                </>
            }
        >
            <form id="template-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Tên template" required>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Gói Standard" disabled={isLoading} />
                    </Field>
                    <Field label="Mô tả">
                        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tuỳ chọn" disabled={isLoading} />
                    </Field>
                    <Field label="Level" required hint="0 = MIB→Lv1, 1 = Lv1→Lv2, ...">
                        <Input type="number" min={0} value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 0)} disabled={isLoading} />
                    </Field>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-slate-50/50">
                    <h3 className="font-medium text-sm text-slate-700">Template Items</h3>
                    {items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <Select
                                value={item.assetId}
                                onChange={(e) => updateItem(idx, { assetId: e.target.value })}
                                className="flex-1"
                                disabled={isLoading}
                            >
                                <option value="">-- Chọn Asset --</option>
                                {assets.map((a) => (
                                    <option key={a.id} value={a.id} disabled={usedAssetIds.has(a.id) && a.id !== item.assetId}>
                                        {a.code} — {a.name}
                                    </option>
                                ))}
                            </Select>
                            <Input
                                type="number"
                                placeholder="Rebate"
                                value={item.rebateUnit}
                                onChange={(e) => updateItem(idx, { rebateUnit: parseFloat(e.target.value) || 0 })}
                                className="w-24"
                                disabled={isLoading}
                            />
                            <Input
                                type="number"
                                placeholder="Markup"
                                value={item.markupPips}
                                onChange={(e) => updateItem(idx, { markupPips: parseFloat(e.target.value) || 0 })}
                                className="w-24"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                disabled={isLoading || items.length === 1}
                                className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1.5"
                                aria-label="Xoá dòng"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setItems([...items, { assetId: '', rebateUnit: 0, markupPips: 0 }])}
                        disabled={isLoading}
                        className="text-indigo-600"
                    >
                        + Thêm item
                    </Button>
                    <p className="text-xs text-slate-400 pt-1">
                        Asset không liệt kê ở đây sẽ tự động có rebateUnit=0, markupPips=0 (backend tự đồng bộ đủ mọi
                        asset hiện có) — hiện dưới dạng "Placeholder" sau khi tạo.
                    </p>
                </div>

                <FormError>{error}</FormError>
            </form>
        </Dialog>
    );
}
