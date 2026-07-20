'use client';

import { IntegrityViolation } from '../lib/api/integrity';
import { Badge, Button, EmptyState, Loading, Table, Th, Td } from './ui/primitives';

interface IntegrityCheckPanelProps {
    violations: IntegrityViolation[];
    loading: boolean;
    onRefresh: () => void;
}

export default function IntegrityCheckPanel({ violations, loading, onRefresh }: IntegrityCheckPanelProps) {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Integrity Check</h2>
                    <p className="text-sm text-slate-500">Quét vi phạm quy tắc "con ≤ cha" giữa các cặp cha-con.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
                    {loading ? 'Đang kiểm tra...' : '↻ Refresh'}
                </Button>
            </div>

            {loading ? (
                <Loading />
            ) : violations.length === 0 ? (
                <EmptyState icon="✓" title="Không có vi phạm" description="Toàn bộ config con hiện đang ≤ config của cha tương ứng." />
            ) : (
                <Table>
                    <thead>
                        <tr>
                            <Th>Asset</Th>
                            <Th>Con (child)</Th>
                            <Th>Cha (parent)</Th>
                            <Th>Rebate (con / cha)</Th>
                            <Th>Markup (con / cha)</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {violations.map((v, idx) => (
                            <tr key={`${v.childUserId}-${v.assetId}-${idx}`} className="hover:bg-slate-50/70">
                                <Td mono>{v.assetCode}</Td>
                                <Td>{v.childEmail}</Td>
                                <Td className="text-slate-500">{v.parentEmail}</Td>
                                {/* Dùng thẳng cờ violatesRebate/violatesMarkup do backend trả về để
                    highlight — KHÔNG tự so sánh lại childRebate > parentRebate ở FE,
                    vì backend đã tính đúng theo business rule (xem API_REFERENCE.md). */}
                                <Td>
                                    {v.violatesRebate ? (
                                        <Badge tone="rose">{v.childRebate} / {v.parentRebate} ⚠</Badge>
                                    ) : (
                                        <span className="tabular-nums">{v.childRebate} / {v.parentRebate}</span>
                                    )}
                                </Td>
                                <Td>
                                    {v.violatesMarkup ? (
                                        <Badge tone="rose">{v.childMarkup} / {v.parentMarkup} ⚠</Badge>
                                    ) : (
                                        <span className="tabular-nums">{v.childMarkup} / {v.parentMarkup}</span>
                                    )}
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );
}
