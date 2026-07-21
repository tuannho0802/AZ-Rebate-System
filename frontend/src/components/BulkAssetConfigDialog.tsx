'use client';

import { useEffect, useMemo, useState } from 'react';
import { getConfigChildren, setConfigTotal } from '../lib/api/commission-config';
import { Template } from '../lib/api/template';
import { Dialog, FormError } from './ui/Dialog';
import { Badge, Button, Select, Spinner } from './ui/primitives';

interface AssetLite {
  id: string;
  code: string;
  name: string;
}

// [SUA] Dialog này chỉ dùng cho MIB/IB (non-admin, xem CommissionManager.tsx) —
// listVisibleTemplates() cho non-admin trả maxPips (đã mask), KHÔNG còn
// rebateUnit/markupPips riêng lẻ (xem template-lock.service.ts listVisibleTemplates,
// và field maxPips optional trong lib/api/template.ts::TemplateItem).
// Dùng thẳng Template từ lib/api/template thay vì tự định nghĩa type riêng —
// tránh lệch shape với CommissionManager.tsx (nơi truyền prop `templates` vào đây).

interface RowState {
  assetId: string;
  transferUnit: string;
  capTotal: number | null; // MaxPips hiện tại của actor cho asset này — hiển thị để biết trần
  hadExisting: boolean; // có config sẵn cho user này trước khi mở form không
  status: 'idle' | 'saving' | 'saved' | 'error';
  errorMessage?: string;
}

interface BulkAssetConfigDialogProps {
  open: boolean;
  onClose: () => void;
  ownId: string; // actor hiện tại — dùng để lấy cap (getConfigChildren trả cả self + children)
  targetUser: { id: string; email: string; fullName?: string | null } | null;
  assets: AssetLite[];
  templates?: Template[];
  onDone: () => void; // gọi lại sau khi đóng, để refresh bảng chính
}

/**
 * "Personal template" flow: giống TemplateFormDialog (nhiều dòng asset trong 1
 * form) nhưng áp trực tiếp, cá nhân hoá cho ĐÚNG 1 user con trực tiếp — không
 * lưu lại thành Template dùng chung. Không có endpoint bulk ở backend, nên
 * form này submit tuần tự từng asset qua upsertConfig và dừng lại ngay khi có
 * lỗi (thường là vượt cap của bạn) — các dòng đã lưu thành công TRƯỚC đó vẫn
 * giữ nguyên, không tự rollback, vì mỗi upsert là 1 request độc lập ở backend.
 */
export default function BulkAssetConfigDialog({
  open,
  onClose,
  ownId,
  targetUser,
  assets,
  templates = [],
  onDone,
}: BulkAssetConfigDialogProps) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);
  const [copyTemplateId, setCopyTemplateId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load current caps (self) + existing config cho target user, cho TỪNG asset,
  // để hiển thị "trần" ngay cạnh ô nhập — tránh lặp lại lỗi "exceeds parent cap"
  // mà không biết trần là bao nhiêu.
  useEffect(() => {
    if (!open || !targetUser) return;
    let cancelled = false;

    (async () => {
      setLoadingCaps(true);
      setGlobalError(null);
      try {
        const results = await Promise.all(
          assets.map(async (a) => {
            try {
              const data = await getConfigChildren(ownId, a.id);
              const existing = data.children.find((c) => c.userId === targetUser.id);
              return {
                assetId: a.id,
                capTotal: data.self.transferUnit != null ? Number(data.self.transferUnit) : null,
                transferUnit: existing?.transferUnit != null ? String(existing.transferUnit) : '',
                hadExisting: existing?.transferUnit != null,
              };
            } catch {
              return { assetId: a.id, capTotal: null, transferUnit: '', hadExisting: false };
            }
          }),
        );
        if (cancelled) return;
        setRows(results.map((r) => ({ ...r, status: 'idle' as const })));
      } catch (err: any) {
        if (!cancelled) setGlobalError(err?.message ?? 'Không tải được cap hiện tại');
      } finally {
        if (!cancelled) setLoadingCaps(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, targetUser, ownId, assets]);

  const assetLabel = useMemo(() => new Map(assets.map((a) => [a.id, `${a.code} — ${a.name}`])), [assets]);

  const updateRow = (assetId: string, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.assetId === assetId ? { ...r, ...patch, status: 'idle' } : r)));
  };

  const applyTemplateCopy = (templateId: string) => {
    setCopyTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setRows((prev) =>
      prev.map((r) => {
        const item = tpl.items.find((i) => i.assetId === r.assetId);
        if (!item) return r;
        const maxPips = Number(item.maxPips) || 0;
        if (maxPips === 0) return r; // placeholder — bỏ qua, giữ giá trị hiện tại
        return { ...r, transferUnit: String(maxPips), status: 'idle' };
      }),
    );
  };

  const dirtyRows = rows.filter((r) => r.transferUnit !== '');

  const handleSubmit = async () => {
    if (!targetUser) return;
    setSubmitting(true);
    setGlobalError(null);

    for (const row of dirtyRows) {
      updateRow(row.assetId, { status: 'saving' });
      try {
        await setConfigTotal({
          userId: targetUser.id,
          assetId: row.assetId,
          transferUnit: parseFloat(row.transferUnit) || 0,
        });
        updateRow(row.assetId, { status: 'saved' });
      } catch (err: any) {
        const message = err?.body?.message || err?.message || 'Lỗi không xác định';
        updateRow(row.assetId, { status: 'error', errorMessage: message });
        setGlobalError(
          `Dừng lại ở asset "${assetLabel.get(row.assetId) ?? row.assetId}": ${message}. Các asset đã lưu trước đó (đánh dấu ✓ xanh) vẫn giữ nguyên — sửa lại dòng lỗi rồi bấm "Lưu" lại để tiếp tục.`,
        );
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    onDone();
  };

  if (!targetUser) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Cấu hình nhiều Asset cho ${targetUser.email}`}
      description="Set MaxPips cho nhiều asset cùng lúc — giống Template, nhưng chỉ áp cho riêng user này."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingCaps || dirtyRows.length === 0}>
            {submitting ? 'Đang lưu...' : `Lưu ${dirtyRows.length || ''} asset`}
          </Button>
        </>
      }
    >
      {templates.length > 0 && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500 shrink-0">Sao chép giá trị từ Template:</span>
          <Select value={copyTemplateId} onChange={(e) => applyTemplateCopy(e.target.value)} className="max-w-xs">
            <option value="">-- Chọn để copy giá trị vào form --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <span className="text-xs text-slate-400">Bạn vẫn có thể sửa từng dòng sau khi copy.</span>
        </div>
      )}

      <FormError>{globalError}</FormError>

      {loadingCaps ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center">
          <Spinner /> Đang tải cap hiện tại cho từng asset...
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Asset</th>
                <th className="px-4 py-2.5">MaxPips</th>
                <th className="px-4 py-2.5">Trần của bạn</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.assetId} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {assetLabel.get(row.assetId)}
                    {row.hadExisting && (
                      <Badge tone="indigo" className="ml-2">
                        đã có config
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={row.transferUnit}
                      onChange={(e) => updateRow(row.assetId, { transferUnit: e.target.value })}
                      placeholder="—"
                      className="w-24 px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400 tabular-nums">
                    {row.capTotal ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {row.status === 'saving' && <Spinner className="text-indigo-500" />}
                    {row.status === 'saved' && <Badge tone="emerald">✓ Đã lưu</Badge>}
                    {row.status === 'error' && <Badge tone="rose">Lỗi</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Chỉ những dòng có nhập giá trị mới được lưu. Giá trị không được vượt "Trần của bạn" cho asset đó — backend sẽ chặn nếu vi phạm.
      </p>
    </Dialog>
  );
}