'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api-client';

interface UserRecord {
  id: string;
  email: string;
  fullName?: string | null;
  role: 'MIB' | 'IB';
  isActive: boolean;
  parentId?: string | null;
  createdAt: string;
}

interface Asset {
  id: string;
  code: string;
  name: string;
}

interface TemplateItem {
  assetId: string;
  rebateUnit: number | string;
  markupPips: number | string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  items: TemplateItem[];
}

interface ChildConfigInfo {
  userId: string;
  email: string;
  role: string;
  isActive: boolean;
  rebateUnit: number | null;
  markupPips: number | null;
  version?: number | null;
}

interface UpsertConfigForm {
  userId: string;
  rebateUnit: string;
  markupPips: string;
}

interface UpdateConfigForm {
  userId: string;
  version: string;
  rebateUnit: string;
  markupPips: string;
}

const emptyUpsertForm: UpsertConfigForm = { userId: '', rebateUnit: '', markupPips: '' };
const emptyUpdateForm: UpdateConfigForm = { userId: '', version: '', rebateUnit: '', markupPips: '' };

/**
 * Dùng chung cho cả MIB và IB. Quy tắc vàng (đã enforce ở backend, component
 * này chỉ cung cấp UI đúng luồng, KHÔNG tự ý nới quyền):
 *   - Chỉ CHA TRỰC TIẾP (chính actor) mới CRUD được tài khoản / commission
 *     config của CON TRỰC TIẾP (LvN+1). Không "quản lý hộ" cháu/chắt.
 *   - Actor KHÔNG tự sửa được tài khoản hoặc config của chính mình — nếu cần,
 *     phải nhờ cấp cao hơn (Admin, hoặc cha trực tiếp của actor).
 */
export default function CommissionManager() {
  const { user } = useAuth();
  const ownId = (user as any)?.sub as string | undefined;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [directChildren, setDirectChildren] = useState<UserRecord[]>([]);
  const [selfInfo, setSelfInfo] = useState<{ email: string; rebateUnit: number | null; markupPips: number | null } | null>(null);
  const [childrenConfig, setChildrenConfig] = useState<Map<string, ChildConfigInfo>>(new Map());
  const [loadingChildren, setLoadingChildren] = useState(false);

  const [createChildForm, setCreateChildForm] = useState({ email: '', password: '', fullName: '' });
  const [editingAccount, setEditingAccount] = useState<UserRecord | null>(null);
  const [editAccountForm, setEditAccountForm] = useState<{ fullName: string; isActive: boolean }>({
    fullName: '',
    isActive: true,
  });

  const [upsertForm, setUpsertForm] = useState<UpsertConfigForm>(emptyUpsertForm);
  const [updateForm, setUpdateForm] = useState<UpdateConfigForm>(emptyUpdateForm);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applyTargetUserId, setApplyTargetUserId] = useState('');
  const [applying, setApplying] = useState(false);

  // ---- Load Assets + Templates (created by Admin, reused here) ----
  useEffect(() => {
    if (!ownId) return;
    let cancelled = false;

    const loadLookups = async () => {
      setLoadingLookups(true);
      try {
        const res = await api.get<Asset[] | { data: Asset[] }>('/admin/assets');
        const list = Array.isArray(res) ? res : res.data;
        if (!cancelled) setAssets(list ?? []);
      } catch (error: any) {
        if (!cancelled) setAssetsError(error.message ?? 'Failed to load assets');
      }

      try {
        const res = await api.get<Template[] | { data: Template[] }>('/admin/templates');
        const list = Array.isArray(res) ? res : res.data;
        if (!cancelled) setTemplates(list ?? []);
      } catch (error: any) {
        if (!cancelled) setTemplatesError(error.message ?? 'Failed to load templates');
      }

      if (!cancelled) setLoadingLookups(false);
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [ownId]);

  // Auto-pick the first asset once loaded, so the tables aren't empty on arrival
  useEffect(() => {
    if (!selectedAssetId && assets.length > 0) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // ---- Load direct children account list (asset-independent) ----
  const loadDirectChildrenAccounts = async () => {
    if (!ownId) return;
    try {
      // Backend lọc trực tiếp qua ?parentId= — không còn tự lọc client-side từ
      // 1 trang /users giới hạn (an toàn hơn khi subtree có >100 user, tránh
      // thiếu con trực tiếp âm thầm nếu chỉ lấy đúng 1 trang rồi filter tay).
      const res = await api.get<UserRecord[] | { data: UserRecord[] }>(`/users?parentId=${ownId}&limit=100`);
      const list = Array.isArray(res) ? res : res.data;
      setDirectChildren(list ?? []);
    } catch (error) {
      console.error('Failed to load direct children accounts:', error);
    }
  };

  useEffect(() => {
    loadDirectChildrenAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownId]);

  // ---- Load commission config (self + direct children) for selected asset ----
  const loadChildrenConfig = async (assetId: string) => {
    if (!ownId || !assetId) return;
    setLoadingChildren(true);
    try {
      const data = await api.get<{
        self: { userId: string; email: string; rebateUnit: number | null; markupPips: number | null };
        children: ChildConfigInfo[];
      }>(`/commission-configs/children/${ownId}?assetId=${assetId}`);
      setSelfInfo({ email: data.self.email, rebateUnit: data.self.rebateUnit, markupPips: data.self.markupPips });
      const map = new Map<string, ChildConfigInfo>();
      for (const c of data.children) map.set(c.userId, c);
      setChildrenConfig(map);
    } catch (error: any) {
      alert(`Failed to load commission config: ${error.message}`);
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    if (selectedAssetId) loadChildrenConfig(selectedAssetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId, ownId]);

  const refreshAll = () => {
    loadDirectChildrenAccounts();
    if (selectedAssetId) loadChildrenConfig(selectedAssetId);
  };

  // ---- Account CRUD (direct children only) ----
  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownId) return;
    try {
      await api.post<UserRecord>('/users', {
        email: createChildForm.email,
        password: createChildForm.password,
        fullName: createChildForm.fullName || undefined,
        role: 'IB', // Rule vàng: LvN chỉ tạo được LvN+1 = IB, không được tạo MIB (root) khác
        parentId: ownId,
      });
      setCreateChildForm({ email: '', password: '', fullName: '' });
      alert('Tạo tài khoản con thành công!');
      refreshAll();
    } catch (error: any) {
      alert(`Tạo thất bại: ${error.message}`);
    }
  };

  const handleEditAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await api.patch(`/users/${editingAccount.id}`, editAccountForm);
      alert('Cập nhật tài khoản thành công!');
      setEditingAccount(null);
      refreshAll();
    } catch (error: any) {
      alert(`Cập nhật thất bại: ${error.message}`);
    }
  };

  // ---- Commission config CRUD (direct children only, backend enforces cap + parent-only) ----
  const handleUpsertConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upsertForm.userId || !selectedAssetId) {
      alert('Vui lòng chọn User (con trực tiếp) và Asset');
      return;
    }
    try {
      await api.post('/commission-configs', {
        userId: upsertForm.userId,
        assetId: selectedAssetId,
        rebateUnit: parseFloat(upsertForm.rebateUnit) || 0,
        markupPips: parseFloat(upsertForm.markupPips) || 0,
      });
      alert('Set config thành công!');
      setUpsertForm(emptyUpsertForm);
      loadChildrenConfig(selectedAssetId);
    } catch (error: any) {
      alert(`Thất bại: ${error.message}`);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateForm.userId || !selectedAssetId || !updateForm.version) {
      alert('Vui lòng chọn User, đảm bảo đã chọn Asset, và nhập Version hiện tại');
      return;
    }
    try {
      await api.patch(`/commission-configs/${updateForm.userId}/${selectedAssetId}`, {
        rebateUnit: updateForm.rebateUnit ? parseFloat(updateForm.rebateUnit) : undefined,
        markupPips: updateForm.markupPips ? parseFloat(updateForm.markupPips) : undefined,
        version: parseInt(updateForm.version, 10),
      });
      alert('Update config thành công!');
      setUpdateForm(emptyUpdateForm);
      loadChildrenConfig(selectedAssetId);
    } catch (error: any) {
      if (error.status === 409) {
        alert('Version conflict — dữ liệu đã bị đổi bởi người khác. Tải lại rồi thử lại.');
      } else {
        alert(`Thất bại: ${error.message}`);
      }
    }
  };

  const prefillConfigForms = (childUserId: string) => {
    const cfg = childrenConfig.get(childUserId);
    setUpsertForm({
      userId: childUserId,
      rebateUnit: cfg?.rebateUnit != null ? String(cfg.rebateUnit) : '',
      markupPips: cfg?.markupPips != null ? String(cfg.markupPips) : '',
    });
    setUpdateForm({
      userId: childUserId,
      version: cfg?.version != null ? String(cfg.version) : '',
      rebateUnit: cfg?.rebateUnit != null ? String(cfg.rebateUnit) : '',
      markupPips: cfg?.markupPips != null ? String(cfg.markupPips) : '',
    });
    document.getElementById('config-forms')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Dùng endpoint thật POST /templates/:templateId/apply/:userId — chạy
  // trong 1 transaction ở backend (xem template-apply.service.ts), rollback
  // toàn bộ nếu 1 asset lỗi (vd vượt cap). An toàn hơn hẳn cách cũ là tự lặp
  // gọi POST /commission-configs từng asset ở client (dễ áp dở dang nếu giữa
  // chừng có asset lỗi).
  const handleApplyTemplate = async () => {
    if (!selectedTemplateId || !applyTargetUserId) {
      alert('Vui lòng chọn Template và User (con trực tiếp) để áp dụng');
      return;
    }
    setApplying(true);
    try {
      const applied = await api.post<any[]>(`/templates/${selectedTemplateId}/apply/${applyTargetUserId}`, {});
      alert(`Áp dụng Template thành công cho ${applied.length} asset!`);
      if (selectedAssetId) loadChildrenConfig(selectedAssetId);
    } catch (error: any) {
      // Backend rollback toàn bộ nếu 1 item lỗi — message đã kèm rõ assetId nào gây lỗi
      alert(`Áp dụng thất bại: ${error.message}`);
    } finally {
      setApplying(false);
    }
  };

  if (!ownId) return null;

  return (
    <div className="space-y-6 mt-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Quy tắc:</strong> bạn chỉ CRUD được tài khoản và cấu hình rebate/markup cho{' '}
          <strong>con trực tiếp</strong> của chính mình (không quản lý hộ cháu/chắt). Cấu hình của{' '}
          <strong>chính bạn</strong> chỉ được set bởi cấp cao hơn (Admin hoặc cha trực tiếp của bạn) — vì
          vậy không có nút sửa ở dòng "Cấu hình của bạn" bên dưới.
        </p>
      </div>

      {/* Asset selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Chọn Asset</h2>
        {loadingLookups && <p className="text-sm text-gray-500 mb-2">Đang tải danh sách asset/template...</p>}
        {assetsError && (
          <p className="text-sm text-red-600 mb-2">
            Không tải được danh sách Asset ({assetsError}) — có thể route <code>/admin/assets</code> đang
            chặn non-Admin, cần backend mở quyền đọc (GET) cho MIB/IB.
          </p>
        )}
        <select
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          className="w-full md:w-1/2 px-3 py-2 border rounded"
        >
          <option value="">-- Select Asset --</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} ({a.name})
            </option>
          ))}
        </select>

        {selfInfo && (
          <div className="mt-4 border p-4 rounded bg-gray-50">
            <h3 className="font-medium">Cấu hình của bạn ({selfInfo.email}):</h3>
            <p className="text-sm text-gray-600">
              Rebate: {selfInfo.rebateUnit ?? 'N/A'} — Markup: {selfInfo.markupPips ?? 'N/A'}
            </p>
          </div>
        )}
      </div>

      {/* Direct children table: account info + commission config combined */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Con trực tiếp của bạn</h2>
        {loadingChildren && <p className="text-sm text-gray-500 mb-2">Đang tải cấu hình...</p>}
        {directChildren.length === 0 ? (
          <p className="text-gray-500">Chưa có con trực tiếp nào. Tạo mới bên dưới.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Full Name</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Active</th>
                <th className="px-4 py-2 text-left">Rebate</th>
                <th className="px-4 py-2 text-left">Markup</th>
                <th className="px-4 py-2 text-left">Version</th>
                <th className="px-4 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {directChildren.map((child) => {
                const cfg = childrenConfig.get(child.id);
                return (
                  <tr key={child.id} className="border-t">
                    <td className="px-4 py-2">{child.email}</td>
                    <td className="px-4 py-2">{child.fullName || 'N/A'}</td>
                    <td className="px-4 py-2">{child.role}</td>
                    <td className="px-4 py-2">{child.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{cfg?.rebateUnit ?? 'N/A'}</td>
                    <td className="px-4 py-2">{cfg?.markupPips ?? 'N/A'}</td>
                    <td className="px-4 py-2">{cfg?.version ?? 'N/A'}</td>
                    <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingAccount(child);
                          setEditAccountForm({ fullName: child.fullName ?? '', isActive: child.isActive });
                        }}
                        className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                      >
                        Sửa TK
                      </button>
                      <button
                        onClick={() => prefillConfigForms(child.id)}
                        className="bg-blue-200 hover:bg-blue-300 px-3 py-1 rounded text-sm"
                        disabled={!selectedAssetId}
                        title={!selectedAssetId ? 'Chọn Asset trước' : ''}
                      >
                        Sửa Config
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit account form */}
      {editingAccount && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Sửa tài khoản: {editingAccount.email}</h2>
          <form onSubmit={handleEditAccountSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Full Name"
                value={editAccountForm.fullName}
                onChange={(e) => setEditAccountForm({ ...editAccountForm, fullName: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editAccountForm.isActive}
                  onChange={(e) => setEditAccountForm({ ...editAccountForm, isActive: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="editIsActive">Active</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create new direct child */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Tạo tài khoản con mới (IB)</h2>
        <form onSubmit={handleCreateChild} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Email"
              value={createChildForm.email}
              onChange={(e) => setCreateChildForm({ ...createChildForm, email: e.target.value })}
              required
              className="px-3 py-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={createChildForm.password}
              onChange={(e) => setCreateChildForm({ ...createChildForm, password: e.target.value })}
              required
              className="px-3 py-2 border rounded"
            />
          </div>
          <input
            type="text"
            placeholder="Full Name (optional)"
            value={createChildForm.fullName}
            onChange={(e) => setCreateChildForm({ ...createChildForm, fullName: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Tạo con trực tiếp
          </button>
        </form>
      </div>

      {/* Create/Update commission config forms */}
      <div id="config-forms" className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <h2 className="text-xl font-bold">Set Commission Config cho con trực tiếp</h2>
        <p className="text-sm text-gray-500">
          Bấm "Sửa Config" ở bảng trên để tự điền — hoặc chọn tay bên dưới. Giá trị Rebate/Markup không
          được vượt quá giá trị hiện tại của chính bạn cho asset này (backend tự chặn nếu vi phạm).
        </p>

        <form onSubmit={handleUpsertConfig} className="space-y-4">
          <h3 className="font-medium">Create / Set Config</h3>
          <div className="grid grid-cols-3 gap-4">
            <select
              value={upsertForm.userId}
              onChange={(e) => setUpsertForm({ ...upsertForm, userId: e.target.value })}
              required
              className="px-3 py-2 border rounded"
            >
              <option value="">-- Select con trực tiếp --</option>
              {directChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Rebate Unit"
              value={upsertForm.rebateUnit}
              onChange={(e) => setUpsertForm({ ...upsertForm, rebateUnit: e.target.value })}
              min="0"
              step="0.0001"
              required
              className="px-3 py-2 border rounded"
            />
            <input
              type="number"
              placeholder="Markup Pips"
              value={upsertForm.markupPips}
              onChange={(e) => setUpsertForm({ ...upsertForm, markupPips: e.target.value })}
              min="0"
              step="0.0001"
              required
              className="px-3 py-2 border rounded"
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Set Config
          </button>
        </form>

        <form onSubmit={handleUpdateConfig} className="space-y-4 pt-6 border-t">
          <h3 className="font-medium">Update Existing (optimistic lock qua version)</h3>
          <div className="grid grid-cols-4 gap-4">
            <select
              value={updateForm.userId}
              onChange={(e) => setUpdateForm({ ...updateForm, userId: e.target.value })}
              required
              className="px-3 py-2 border rounded"
            >
              <option value="">-- Select con trực tiếp --</option>
              {directChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Current Version"
              value={updateForm.version}
              onChange={(e) => setUpdateForm({ ...updateForm, version: e.target.value })}
              required
              className="px-3 py-2 border rounded"
            />
            <input
              type="number"
              placeholder="New Rebate (optional)"
              value={updateForm.rebateUnit}
              onChange={(e) => setUpdateForm({ ...updateForm, rebateUnit: e.target.value })}
              min="0"
              step="0.0001"
              className="px-3 py-2 border rounded"
            />
            <input
              type="number"
              placeholder="New Markup (optional)"
              value={updateForm.markupPips}
              onChange={(e) => setUpdateForm({ ...updateForm, markupPips: e.target.value })}
              min="0"
              step="0.0001"
              className="px-3 py-2 border rounded"
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Update Config
          </button>
        </form>
      </div>

      {/* Apply Template */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Áp dụng Template (do Admin tạo) cho con trực tiếp</h2>
        {templatesError && (
          <p className="text-sm text-red-600 mb-2">
            Không tải được danh sách Template ({templatesError}) — có thể route{' '}
            <code>/admin/templates</code> đang chặn non-Admin, cần backend mở quyền đọc (GET) cho MIB/IB.
          </p>
        )}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">-- Select Template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.items?.length ?? 0} asset)
              </option>
            ))}
          </select>
          <select
            value={applyTargetUserId}
            onChange={(e) => setApplyTargetUserId(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">-- Select con trực tiếp --</option>
            {directChildren.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </select>
          <button
            onClick={handleApplyTemplate}
            disabled={applying}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {applying ? 'Đang áp dụng...' : 'Áp dụng Template'}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Gọi <code>POST /templates/:templateId/apply/:userId</code> — chạy trong 1 transaction ở
          backend. Nếu bất kỳ asset nào trong template vượt cap (giá trị hiện tại của bạn), TOÀN BỘ
          request bị rollback và không asset nào được áp dụng — không còn tình trạng áp dở dang.
        </p>
      </div>
    </div>
  );
}