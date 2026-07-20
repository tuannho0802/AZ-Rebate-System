'use client';

import { IntegrityViolation } from '../lib/api/integrity';

interface IntegrityCheckPanelProps {
    violations: IntegrityViolation[];
    loading: boolean;
    onRefresh: () => void;
}

export default function IntegrityCheckPanel({ violations, loading, onRefresh }: IntegrityCheckPanelProps) {
    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Integrity Check</h2>
                <button onClick={onRefresh} disabled={loading} className="text-sm text-blue-600 hover:underline disabled:opacity-50">
                    {loading ? 'Đang kiểm tra...' : 'Refresh'}
                </button>
            </div>

            {loading ? (
                <p className="text-gray-500 text-center py-6">Đang tải...</p>
            ) : violations.length === 0 ? (
                <p className="text-green-600 text-center py-6 font-medium">✓ Không có vi phạm</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-3 py-2 text-left">Asset</th>
                                <th className="px-3 py-2 text-left">Con (child)</th>
                                <th className="px-3 py-2 text-left">Cha (parent)</th>
                                <th className="px-3 py-2 text-left">Rebate (con / cha)</th>
                                <th className="px-3 py-2 text-left">Markup (con / cha)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {violations.map((v, idx) => (
                                <tr key={`${v.childUserId}-${v.assetId}-${idx}`} className="border-t">
                                    <td className="px-3 py-2 font-mono">{v.assetCode}</td>
                                    <td className="px-3 py-2">{v.childEmail}</td>
                                    <td className="px-3 py-2">{v.parentEmail}</td>
                                    {/* Dùng thẳng cờ violatesRebate/violatesMarkup do backend trả về để
                      highlight — KHÔNG tự so sánh lại childRebate > parentRebate ở FE,
                      vì backend đã tính đúng theo business rule (xem API_REFERENCE.md). */}
                                    <td className={`px-3 py-2 ${v.violatesRebate ? 'bg-red-50 text-red-700 font-medium' : ''}`}>
                                        {v.childRebate} / {v.parentRebate}
                                        {v.violatesRebate && <span className="ml-1 text-xs">⚠ lệch</span>}
                                    </td>
                                    <td className={`px-3 py-2 ${v.violatesMarkup ? 'bg-red-50 text-red-700 font-medium' : ''}`}>
                                        {v.childMarkup} / {v.parentMarkup}
                                        {v.violatesMarkup && <span className="ml-1 text-xs">⚠ lệch</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}