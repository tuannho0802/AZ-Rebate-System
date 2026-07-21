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
        Promise.all([listTemplates().then(setTemplates), listAssets().then(setAssets), listUsers().then(setUsers)])
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
                            <select
                                value={applyForm.templateId}
                                onChange={(e) => setApplyForm({ ...applyForm, templateId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            >
                                <option value="">-- Select Template --</option>
                                {templates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.items?.length ?? 0} asset)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">User (bất kỳ cấp nào)</label>
                            <select
                                value={applyForm.userId}
                                onChange={(e) => setApplyForm({ ...applyForm, userId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                            >
                                <option value="">-- Select User --</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.role} — {u.fullName ?? u.email} ({u.email})
                                    </option>
                                ))}
                            </select>
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
            </div>

            <TemplateFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} assets={assets} onSave={handleCreate} isLoading={saving} />
        </div>
    );
}