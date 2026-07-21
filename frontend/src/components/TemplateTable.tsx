'use client';

import { useState } from 'react';
import { Template, TemplateItem } from '../lib/api/template';
import { Badge, Button, EmptyState, Table, Th, Td } from './ui/primitives';
import { LevelBadge } from './ui/LevelBadge';

interface TemplateTableProps {
    templates: Template[];
    onEditDescription: (template: Template) => void;
    onDeleteTemplate: (template: Template) => void;
    onUpdateItem: (template: Template, item: TemplateItem, field: 'rebateUnit' | 'markupPips', value: number) => void;
}

// Item (0,0) là placeholder backend tự sinh cho asset chưa được Admin liệt kê khi
// tạo/sửa Template — KHÔNG phải Admin cố ý set (xem BUSINESS_RULES.md mục 3).
function isPlaceholder(item: TemplateItem): boolean {
    return Number(item.rebateUnit) === 0 && Number(item.markupPips) === 0;
}

export default function TemplateTable({ templates, onEditDescription, onDeleteTemplate, onUpdateItem }: TemplateTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (templates.length === 0) {
        return <EmptyState icon="🗂️" title="Chưa có template nào" description="Tạo template để đóng gói sẵn 1 bộ rebate/markup, áp dụng nhanh cho nhiều IB." />;
    }

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // Group templates by level
    const groups = new Map<number, Template[]>();
    for (const t of templates) {
        const lvl = t.level ?? 0;
        if (!groups.has(lvl)) {
            groups.set(lvl, []);
        }
        groups.get(lvl)!.push(t);
    }

    // Sort levels ascending
    const sortedLevels = Array.from(groups.keys()).sort((a, b) => a - b);

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedId(null)}
                    disabled={expandedId === null}
                >
                    Thu gọn tất cả
                </Button>
            </div>

            {sortedLevels.map((lvl) => {
                const groupTemplates = groups.get(lvl) ?? [];
                return (
                    <div key={lvl} className="space-y-3">
                        <div className="flex items-center gap-2 px-1 py-1 border-b border-slate-100">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {lvl === 0 ? 'Cấp 0 (Dành cho MIB)' : `Cấp ${lvl}`}
                            </span>
                            <span className="text-xs text-slate-300">({groupTemplates.length} templates)</span>
                        </div>

                        <div className="space-y-4">
                            {groupTemplates.map((t) => {
                                const setCount = t.items.filter((it) => !isPlaceholder(it)).length;
                                const isExpanded = expandedId === t.id;

                                return (
                                    <div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/70 border-b border-slate-200">
                                            <div className="min-w-0 flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(t.id)}
                                                    className="p-1 text-slate-400 hover:text-slate-700 text-xs font-bold"
                                                    aria-label="Toggle details"
                                                >
                                                    {isExpanded ? '▼' : '►'}
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-900">{t.name}</span>
                                                        {t.level !== undefined && <LevelBadge level={t.level} />}
                                                        <Badge tone="indigo">{setCount} asset đã set</Badge>
                                                    </div>
                                                    {t.description && <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5 shrink-0 items-center">
                                                <Button size="sm" variant="secondary" onClick={() => toggleExpand(t.id)}>
                                                    {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => onEditDescription(t)}>
                                                    Sửa mô tả
                                                </Button>
                                                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => onDeleteTemplate(t)}>
                                                    Xoá
                                                </Button>
                                            </div>
                                        </div>
                                        {isExpanded && (
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
