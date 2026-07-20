'use client';

import { Template, TemplateItem } from '../lib/api/template';

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
        return (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-400">Chưa có template nào</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-6">
                {templates.map((t) => (
                    <div key={t.id} className="border border-gray-200 rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <span className="font-bold">{t.name}</span>
                                {t.description && <span className="text-gray-500 ml-2">— {t.description}</span>}
                            </div>
                            <div className="space-x-2">
                                <button onClick={() => onEditDescription(t)} className="text-blue-600 hover:underline text-sm">
                                    Sửa mô tả
                                </button>
                                <button onClick={() => onDeleteTemplate(t)} className="text-red-600 hover:underline text-sm">
                                    Xoá
                                </button>
                            </div>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="px-2 py-1 text-left">Asset</th>
                                    <th className="px-2 py-1 text-left">Rebate Unit</th>
                                    <th className="px-2 py-1 text-left">Markup Pips</th>
                                    <th className="px-2 py-1 text-left">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {t.items.map((item) => {
                                    const placeholder = isPlaceholder(item);
                                    return (
                                        <tr key={item.assetId} className={`border-t ${placeholder ? 'bg-gray-50 text-gray-400' : ''}`}>
                                            <td className="px-2 py-1">{item.asset ? `${item.asset.code} — ${item.asset.name}` : item.assetId}</td>
                                            <td className="px-2 py-1">
                                                <input
                                                    type="number"
                                                    defaultValue={item.rebateUnit}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        if (val !== Number(item.rebateUnit)) onUpdateItem(t, item, 'rebateUnit', val);
                                                    }}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded"
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                <input
                                                    type="number"
                                                    defaultValue={item.markupPips}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        if (val !== Number(item.markupPips)) onUpdateItem(t, item, 'markupPips', val);
                                                    }}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded"
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                {placeholder ? (
                                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-xs rounded whitespace-nowrap">
                                                        Placeholder — không áp dụng khi Apply
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded whitespace-nowrap">
                                                        Admin đã set
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
}