'use client';

import { Template, TemplateItem } from '../lib/api/template';
import { Badge, Button, EmptyState, Table, Th, Td } from './ui/primitives';

interface TemplateTableProps {
    templates: Template[];
    onEditDescription: (template: Template) => void;
    onDeleteTemplate: (template: Template) => void;
    onUpdateItem: (template: Template, item: TemplateItem, field: 'rebateUnit' | 'markupPips', value: number) => void;
}

// Item (0,0) là placeholder backend tự sinh cho asset chưa được Admin liệt kê khi
// tạo/sửa Template — KHÔNG phải Admin cố ý set (xem BUSINESS_RULES.md mục 3).
// So sánh qua Number(...) vì rebateUnit/markupPips là Decimal, backend trả về
// dạng string (vd "0.0000"), so sánh trực tiếp với 0 sẽ luôn false.
function isPlaceholder(item: TemplateItem): boolean {
    return Number(item.rebateUnit) === 0 && Number(item.markupPips) === 0;
}

export default function TemplateTable({ templates, onEditDescription, onDeleteTemplate, onUpdateItem }: TemplateTableProps) {
    if (templates.length === 0) {
        return <EmptyState icon="🗂️" title="Chưa có template nào" description="Tạo template để đóng gói sẵn 1 bộ rebate/markup, áp dụng nhanh cho nhiều IB." />;
    }

    return (
        <div className="space-y-4">
            {templates.map((t) => {
                const setCount = t.items.filter((it) => !isPlaceholder(it)).length;
                return (
                    <div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/70 border-b border-slate-200">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900">{t.name}</span>
                                    <Badge tone="indigo">{setCount} asset đã set</Badge>
                                </div>
                                {t.description && <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => onEditDescription(t)}>
                                    Sửa mô tả
                                </Button>
                                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => onDeleteTemplate(t)}>
                                    Xoá
                                </Button>
                            </div>
                        </div>
                        <Table>
                            <thead>
                                <tr>
                                    <Th>Asset</Th>
                                    <Th>Rebate Unit</Th>
                                    <Th>Markup Pips</Th>
                                    <Th>Trạng thái</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {t.items.map((item) => {
                                    const placeholder = isPlaceholder(item);
                                    return (
                                        <tr key={item.assetId} className={placeholder ? 'text-slate-400' : 'hover:bg-slate-50/70'}>
                                            <Td className={placeholder ? '' : 'font-medium text-slate-900'}>
                                                {item.asset ? `${item.asset.code} — ${item.asset.name}` : item.assetId}
                                            </Td>
                                            <Td>
                                                <input
                                                    type="number"
                                                    defaultValue={item.rebateUnit}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        if (val !== Number(item.rebateUnit)) onUpdateItem(t, item, 'rebateUnit', val);
                                                    }}
                                                    className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                />
                                            </Td>
                                            <Td>
                                                <input
                                                    type="number"
                                                    defaultValue={item.markupPips}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        if (val !== Number(item.markupPips)) onUpdateItem(t, item, 'markupPips', val);
                                                    }}
                                                    className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                />
                                            </Td>
                                            <Td>
                                                {placeholder ? (
                                                    <Badge tone="slate">Placeholder — không áp dụng</Badge>
                                                ) : (
                                                    <Badge tone="emerald">Admin đã set</Badge>
                                                )}
                                            </Td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                );
            })}
        </div>
    );
}
