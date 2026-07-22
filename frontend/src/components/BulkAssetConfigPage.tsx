'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { getConfigChildren, setConfigTotal } from '../lib/api/commission-config';
import { Template, listVisibleTemplates } from '../lib/api/template';
import { User, listUsers } from '../lib/api/user';
import { Asset, listAssets } from '../lib/api/admin';
import { Card, Badge, Button, Select, Spinner, EmptyState } from './ui/primitives';
import { FormError } from './ui/Dialog';

interface RowState {
  assetId: string;
  transferUnit: string;
  capTotal: number | null;
  hadExisting: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  errorMessage?: string;
}

export default function BulkAssetConfigPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const targetUserId = params?.userId as string;

  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);
  const [copyTemplateId, setCopyTemplateId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Authenticate & load basic lookups
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
      return;
    }

    // Load target user details
    listUsers({ parentId: user.sub, limit: 100 })
      .then((users) => {
        const found = users.find((u) => u.id === targetUserId);
        if (found) {
          setTargetUser(found);
        } else {
          setGlobalError('Không tìm thấy tài khoản con hoặc tài khoản không thuộc quyền quản lý trực tiếp của bạn.');
        }
      })
      .catch(console.error);

    listAssets().then(setAssets).catch(console.error);
    listVisibleTemplates().then(setTemplates).catch(console.error);
  }, [user, targetUserId, router]);

  // Load parent cap values & existing configs
  useEffect(() => {
    if (!user || !targetUserId || assets.length === 0) return;
    let cancelled = false;

    (async () => {
      setLoadingCaps(true);
      setGlobalError(null);
      try {
        const results = await Promise.all(
          assets.map(async (a) => {
            try {
              const data = await getConfigChildren(user.sub, a.id);
              const existing = data.children.find((c) => c.userId === targetUserId);
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
  }, [user, targetUserId, assets]);

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
        if (maxPips === 0) return r;
        return { ...r, transferUnit: String(maxPips), status: 'idle' };
      }),
    );
  };

  const dirtyRows = rows.filter((r) => r.transferUnit !== '');

  const handleSubmit = async () => {
    if (!user || !targetUserId) return;
    setSubmitting(true);
    setGlobalError(null);

    const assetMap = new Map(assets.map((a) => [a.id, `${a.code} — ${a.name}`]));

    for (const row of dirtyRows) {
      updateRow(row.assetId, { status: 'saving' });
      try {
        await setConfigTotal({
          userId: targetUserId,
          assetId: row.assetId,
          transferUnit: parseFloat(row.transferUnit) || 0,
        });
        updateRow(row.assetId, { status: 'saved' });
      } catch (err: any) {
        const message = err?.body?.message || err?.message || 'Lỗi không xác định';
        updateRow(row.assetId, { status: 'error', errorMessage: message });
        setGlobalError(
          `Dừng lại ở asset "${assetMap.get(row.assetId) ?? row.assetId}": ${message}. Các asset đã lưu thành công trước đó (✓ Đã lưu) vẫn giữ nguyên.`,
        );
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    alert('Đã cập nhật các asset thành công!');
  };

  const rolePath = user?.role === 'MIB' ? 'mib' : 'ib';

  if (!user || !targetUserId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cấu hình nhiều Asset</h1>
          <p className="text-sm text-slate-500">
            Set MaxPips cho nhiều asset cùng lúc cho tài khoản: {targetUser?.email || '...'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push(`/${rolePath}/config`)}>
          Quay lại danh sách
        </Button>
      </div>

      <Card title="Cấu hình MaxPips hàng loạt" description="Điền cấu hình MaxPips hoặc sao chép giá trị từ template.">
        {templates.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 pb-6 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-600 shrink-0">Sao chép giá trị từ Template:</span>
            <Select value={copyTemplateId} onChange={(e) => applyTemplateCopy(e.target.value)} className="max-w-xs">
              <option value="">-- Chọn để copy giá trị vào form --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (cấp {t.level})
                </option>
              ))}
            </Select>
            <span className="text-xs text-slate-400">Giá trị (0,0) đại diện cho asset chưa cấu hình sẽ được tự động bỏ qua.</span>
          </div>
        )}

        <FormError>{globalError}</FormError>

        {loadingCaps ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center">
            <Spinner /> Đang tải trần MaxPips cho từng asset...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Không có asset nào để hiển thị" />
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 max-w-4xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">MaxPips (tổng nhận)</th>
                  <th className="px-4 py-3">Trần của bạn</th>
                  <th className="px-4 py-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const label = assets.find((a) => a.id === row.assetId);
                  return (
                    <tr key={row.assetId} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {label ? `${label.code} — ${label.name}` : row.assetId}
                        {row.hadExisting && (
                          <Badge tone="indigo" className="ml-2">
                            đã có config
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={row.transferUnit}
                          onChange={(e) => updateRow(row.assetId, { transferUnit: e.target.value })}
                          placeholder="Chưa cấu hình"
                          className="w-36 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-400 tabular-nums">
                        {row.capTotal ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {row.status === 'saving' && <Spinner className="text-indigo-500 inline-block" />}
                        {row.status === 'saved' && <Badge tone="emerald">✓ Đã lưu</Badge>}
                        {row.status === 'error' && <Badge tone="rose">Lỗi</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
          <Button variant="secondary" onClick={() => router.push(`/${rolePath}/config`)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingCaps || dirtyRows.length === 0} variant="success">
            {submitting ? 'Đang lưu...' : `Lưu tất cả (${dirtyRows.length} asset)`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
