'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { Asset, listAssets } from '../../../lib/api/admin';
import { User, listUsers } from '../../../lib/api/user';
import {
    Template,
    TemplateItem,
    CreateTemplateDto,
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
} from '../../../lib/api/template';
import TemplateTable from '../../../components/TemplateTable';
import TemplateFormDialog from '../../../components/TemplateFormDialog';
import SearchableSelect from '../../../components/ui/SearchableSelect';

export default function AdminTemplatesPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [templates, setTemplates] = useState<Template[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingList, setLoadingList] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [applyForm, setApplyForm] = useState({ templateId: '', userId: '' });
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (isLoading) return; // Đang kiểm tra cookie/token — chưa biết user thật hay chưa, đừng redirect vội
        if (!user) {
            router.push('/login');
            return;
        }
        if (user.type !== 'admin') {
            router.push(user.role === 'MIB' ? '/mib' : '/ib');
        }
    }, [user, isLoading, router]);

    const fetchTemplates = useCallback(() => {
        return listTemplates().then(setTemplates).catch(console.error);
    }, []);

    useEffect(() => {
        if (isLoading || !user || user.type !== 'admin') return;
        setLoadingList(true);
        // Template picker cần Asset (item form) + User (form Apply) — load cả 3 song song.
        // Không truyền limit sẽ dùng page size mặc định của backend (nhỏ hơn 100),
        // khiến dropdown "Áp dụng Template" âm thầm thiếu user khi hệ thống có
        // nhiều hơn 1 trang. Truyền limit=100 (giới hạn tối đa cho phép — xem
        // validator @Max(100)) để tránh mất user trong danh sách chọn.
        Promise.all([listTemplates().then(setTemplates), listAssets().then(setAssets), listUsers({ limit: 100 }).then(setUsers)])
            .catch(console.error)
            .finally(() => setLoadingList(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, user]);

    const handleCreate = async (dto: CreateTemplateDto) => {
        setSaving(true);
        try {
            await createTemplate(dto);
            await fetchTemplates();
        } finally {
            setSaving(false);
        }
    };

    const handleEditDescription = async (template: Template) => {
        const newDescription = window.prompt('Mô tả mới:', template.description ?? '');
        if (newDescription === null || newDescription === template.description) return;
        try {
            // Chỉ gửi description, KHÔNG gửi items -> backend giữ nguyên toàn bộ items hiện có
            await updateTemplate(template.id, { description: newDescription });
            await fetchTemplates();
        } catch (error: any) {
            alert(`Failed to update template: ${error?.body?.message || error.message}`);
        }
    };

    const handleUpdateItem = async (template: Template, item: TemplateItem, field: 'rebateUnit' | 'markupPips', value: number) => {
        try {
            // QUAN TRỌNG: rebateUnit/markupPips trong schema là kiểu Prisma `Decimal`.
            // Backend luôn serialize Decimal thành STRING (vd "1.0000") trong JSON response,
            // dù input hiển thị trông như số bình thường. Nếu gửi thẳng item.rebateUnit/
            // item.markupPips (đọc từ response GET) lên PATCH mà không ép kiểu lại, backend
            // sẽ từ chối 400 vì @IsNumber() thấy string, không phải number. Luôn Number(...)
            // cả 2 field trước khi gửi.
            const rebateUnit = Number(field === 'rebateUnit' ? value : item.rebateUnit);
            const markupPips = Number(field === 'markupPips' ? value : item.markupPips);

            if (Number.isNaN(rebateUnit) || Number.isNaN(markupPips)) {
                alert('Giá trị không hợp lệ, vui lòng nhập số.');
                return;
            }

            // Chỉ gửi đúng 1 item vừa sửa — backend chỉ upsert item này, các item khác
            // trong template giữ nguyên giá trị cũ.
            await updateTemplate(template.id, { items: [{ assetId: item.assetId, rebateUnit, markupPips }] });
            await fetchTemplates();
        } catch (error: any) {
            alert(`Failed to update template item: ${error?.body?.message || error.message}`);
        }
    };

    const handleDelete = async (template: Template) => {
        if (!window.confirm(`Xoá template "${template.name}"?`)) return;
        try {
            await deleteTemplate(template.id);
            await fetchTemplates();
        } catch (error: any) {
            alert(`Failed to delete template: ${error?.body?.message || error.message}`);
        }
    };

    // Admin áp Template cho BẤT KỲ user nào, kể cả MIB root — actor là Admin nên
    // bypass hoàn toàn cap/orphan check (BUSINESS_RULES.md mục 3). Dùng để "mồi"
    // config gốc cho MIB, để MIB sau đó tự áp Template được cho con trực tiếp
    // của mình (orphan check yêu cầu cha trực tiếp phải có config trước).
    const handleApply = async () => {
        if (!applyForm.templateId || !applyForm.userId) {
            alert('Vui lòng chọn Template và User');
            return;
        }
        setApplying(true);
        try {
            const applied = await applyTemplate(applyForm.templateId, applyForm.userId);
            alert(`Áp dụng Template thành công cho ${applied.length} asset!`);
            setApplyForm({ templateId: '', userId: '' });
        } catch (error: any) {
            alert(`Áp dụng thất bại: ${error?.body?.message || error.message}`);
        } finally {
            setApplying(false);
        }
    };

    if (isLoading) return null;
    if (!user || user.type !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-blue-600 text-white px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Rebate System — Template Management</h1>
                    <a href="/admin" className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
                        ← Quay lại Admin
                    </a>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Template List</h2>
                    <button onClick={() => setDialogOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        + Tạo Template mới
                    </button>
                </div>

                {loadingList ? (
                    <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">Đang tải...</div>
                ) : (
                    <TemplateTable
                        templates={templates}
                        onEditDescription={handleEditDescription}
                        onDeleteTemplate={handleDelete}
                        onUpdateItem={handleUpdateItem}
                    />
                )}

                {/* Áp dụng Template — dời từ tab "Commission Configs" của /admin sang đây,
            vì đây là hành động gắn liền với Template, không phải Commission Config. */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">Áp dụng Template</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Admin có thể áp Template cho <strong>bất kỳ user nào, kể cả MIB (root)</strong> — không bị chặn
                        bởi cap/orphan check (chỉ áp dụng khi MIB/IB tự áp cho con trực tiếp của họ). Dùng để mồi config
                        gốc cho MIB trước, để MIB sau đó tự áp Template được cho con của mình.
                    </p>
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                            <SearchableSelect
                                options={templates.map((t) => ({
                                    id: t.id,
                                    label: t.name,
                                    sublabel: `${t.items?.length ?? 0} asset`,
                                    tag: `Cấp ${t.level}`,
                                }))}
                                value={applyForm.templateId}
                                onChange={(val) => setApplyForm({ ...applyForm, templateId: val })}
                                placeholder="Chọn Template..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">User (bất kỳ cấp nào)</label>
                            <SearchableSelect
                                options={users.map((u) => ({
                                    id: u.id,
                                    label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
                                    sublabel: u.email,
                                    tag: u.role,
                                }))}
                                value={applyForm.userId}
                                onChange={(val) => setApplyForm({ ...applyForm, userId: val })}
                                placeholder="Chọn User..."
                            />
                        </div>
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            {applying ? 'Đang áp dụng...' : 'Áp dụng Template'}
                        </button>
                    </div>
                    {templates.length === 0 && <p className="text-sm text-gray-400 mt-2">Chưa có template nào — tạo ở trên trước.</p>}
                    {users.length === 0 && <p className="text-sm text-gray-400 mt-2">Chưa có user nào.</p>}
                </div>

                {/* Khóa / Mở khóa Template cho User (Admin) */}
                <AdminTemplateLockCard users={users} />
            </div>

            <TemplateFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} assets={assets} onSave={handleCreate} isLoading={saving} />
        </div>
    );
}

function AdminTemplateLockCard({ users }: { users: User[] }) {
    const [targetUserId, setTargetUserId] = useState('');
    const [lockStatuses, setLockStatuses] = useState<import('../../../lib/api/template').TemplateLockStatus[]>([]);
    const [loadingStatuses, setLoadingStatuses] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStatuses = useCallback(async (userId: string) => {
        if (!userId) {
            setLockStatuses([]);
            return;
        }
        setLoadingStatuses(true);
        setError(null);
        try {
            const { getTemplateLockStatus } = await import('../../../lib/api/template');
            const statuses = await getTemplateLockStatus(userId);
            setLockStatuses(statuses);
        } catch (err: any) {
            setError(err?.body?.message || err?.message || 'Không thể tải trạng thái lock');
            setLockStatuses([]);
        } finally {
            setLoadingStatuses(false);
        }
    }, []);

    useEffect(() => {
        if (targetUserId) {
            loadStatuses(targetUserId);
        } else {
            setLockStatuses([]);
            setError(null);
        }
    }, [targetUserId, loadStatuses]);

    const handleToggle = async (templateId: string, currentlyLocked: boolean) => {
        if (!targetUserId) return;
        setTogglingId(templateId);
        setError(null);
        try {
            const { lockTemplate, unlockTemplate } = await import('../../../lib/api/template');
            if (currentlyLocked) {
                await unlockTemplate(templateId, targetUserId);
            } else {
                await lockTemplate(templateId, targetUserId);
            }
            await loadStatuses(targetUserId);
        } catch (err: any) {
            setError(err?.body?.message || err?.message || 'Thao tác thất bại');
        } finally {
            setTogglingId(null);
        }
    };

    const selectedUser = users.find((u) => u.id === targetUserId);
    const lockedCount = lockStatuses.filter((t) => t.isLocked).length;
    const unlockedCount = lockStatuses.filter((t) => !t.isLocked).length;

    return (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Khóa / Mở khóa Template cho User</h2>
            <p className="text-sm text-gray-500">
                Admin có thể xem & quản lý trạng thái khóa template của <strong>bất kỳ User nào (kể cả MIB root)</strong>. Khi bị khóa, user sẽ không thấy template đó để áp dụng.
            </p>

            <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn User (bất kỳ cấp nào)</label>
                <SearchableSelect
                    options={users.map((u) => ({
                        id: u.id,
                        label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
                        sublabel: u.email,
                        tag: u.role,
                    }))}
                    value={targetUserId}
                    onChange={setTargetUserId}
                    placeholder="Chọn User..."
                />
            </div>

            {targetUserId && loadingStatuses && (
                <p className="text-sm text-gray-500 py-4">Đang tải trạng thái lock...</p>
            )}

            {targetUserId && !loadingStatuses && lockStatuses.length === 0 && !error && (
                <p className="text-sm text-gray-400 py-2">
                    Không tìm thấy template nào phù hợp level của {selectedUser?.email ?? 'user này'}.
                </p>
            )}

            {targetUserId && !loadingStatuses && lockStatuses.length > 0 && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        <span className="text-gray-600">
                            Tổng <strong className="text-gray-900">{lockStatuses.length}</strong> template (Cấp {lockStatuses[0]?.level ?? 0})
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            🔓 {unlockedCount} đang mở
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            🔒 {lockedCount} đang khóa
                        </span>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Tên Template</th>
                                    <th className="px-4 py-3">Mô tả</th>
                                    <th className="px-4 py-3">Trạng thái</th>
                                    <th className="px-4 py-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lockStatuses.map((t) => {
                                    const isToggling = togglingId === t.id;
                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50/70">
                                            <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                                            <td className="px-4 py-3 text-gray-500 text-sm max-w-[250px] truncate">
                                                {t.description || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {t.isLocked ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                        🔒 Đang khóa
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        🔓 Đang mở
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleToggle(t.id, t.isLocked)}
                                                    disabled={isToggling}
                                                    className={`px-3 py-1.5 rounded text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                                                        t.isLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                                    }`}
                                                >
                                                    {isToggling
                                                        ? 'Đang xử lý...'
                                                        : t.isLocked
                                                        ? '🔓 Mở khóa'
                                                        : '🔒 Khóa'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    ⚠ {error}
                </p>
            )}
        </div>
    );
}