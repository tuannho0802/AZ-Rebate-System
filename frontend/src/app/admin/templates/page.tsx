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
import {
    PageShell,
    PageBody,
    Card,
    Button,
    Field,
    Loading,
    Badge,
    Table,
    Th,
    Td,
} from '../../../components/ui/primitives';
import { FormError } from '../../../components/ui/Dialog';

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
        <PageShell>
            <PageBody>
                <Card
                    title="Template List"
                    description={`${templates.length} template trong hệ thống`}
                    actions={
                        <Button onClick={() => setDialogOpen(true)}>+ Tạo Template mới</Button>
                    }
                >
                    {loadingList ? (
                        <Loading label="Đang tải danh sách template..." />
                    ) : (
                        <TemplateTable
                            templates={templates}
                            onEditDescription={handleEditDescription}
                            onDeleteTemplate={handleDelete}
                            onUpdateItem={handleUpdateItem}
                        />
                    )}
                </Card>

                {/* Áp dụng Template — dời từ tab "Commission Configs" của /admin sang đây,
                    vì đây là hành động gắn liền với Template, không phải Commission Config. */}
                <Card
                    title="Áp dụng Template"
                    description="Admin có thể áp Template cho bất kỳ user nào, kể cả MIB (root) — không bị chặn bởi cap/orphan check. Dùng để mồi config gốc cho MIB trước."
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Field label="Template" required>
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
                        </Field>
                        <Field label="User (bất kỳ cấp nào)" required>
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
                        </Field>
                        <div className="flex justify-end">
                            <Button
                                onClick={handleApply}
                                disabled={applying}
                                variant="success"
                            >
                                {applying ? 'Đang áp dụng...' : 'Áp dụng Template'}
                            </Button>
                        </div>
                    </div>
                    {templates.length === 0 && <p className="text-sm text-slate-400 mt-2">Chưa có template nào — tạo ở trên trước.</p>}
                    {users.length === 0 && <p className="text-sm text-slate-400 mt-2">Chưa có user nào.</p>}
                </Card>

                {/* Khóa / Mở khóa Template cho User (Admin) */}
                <AdminTemplateLockCard users={users} />
            </PageBody>

            <TemplateFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} assets={assets} onSave={handleCreate} isLoading={saving} />
        </PageShell>
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
        <Card
            title="Khóa / Mở khóa Template cho User"
            description="Admin có thể xem & quản lý trạng thái khóa template của bất kỳ User nào (kể cả MIB root). Khi bị khóa, user sẽ không thấy template đó để áp dụng."
        >
            <div className="max-w-md">
                <Field label="Chọn User (bất kỳ cấp nào)">
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
                </Field>
            </div>

            {targetUserId && loadingStatuses && (
                <Loading label="Đang tải trạng thái lock..." />
            )}

            {targetUserId && !loadingStatuses && lockStatuses.length === 0 && !error && (
                <p className="text-sm text-slate-400 py-2">
                    Không tìm thấy template nào phù hợp level của {selectedUser?.email ?? 'user này'}.
                </p>
            )}

            {targetUserId && !loadingStatuses && lockStatuses.length > 0 && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                        <span className="text-slate-600">
                            Tổng <strong className="text-slate-900">{lockStatuses.length}</strong> template (Cấp {lockStatuses[0]?.level ?? 0})
                        </span>
                        <Badge tone="emerald">🔓 {unlockedCount} đang mở</Badge>
                        <Badge tone="slate">🔒 {lockedCount} đang khóa</Badge>
                    </div>

                    <Table>
                        <thead>
                            <tr>
                                <Th>Tên Template</Th>
                                <Th>Mô tả</Th>
                                <Th>Trạng thái</Th>
                                <Th className="text-right">Thao tác</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {lockStatuses.map((t) => {
                                const isToggling = togglingId === t.id;
                                return (
                                    <tr key={t.id} className="hover:bg-slate-50/70">
                                        <Td className="font-medium text-slate-900">{t.name}</Td>
                                        <Td className="text-slate-500 max-w-[250px] truncate">
                                            {t.description || <span className="text-slate-300">—</span>}
                                        </Td>
                                        <Td>
                                            {t.isLocked ? (
                                                <Badge tone="rose">🔒 Đang khóa</Badge>
                                            ) : (
                                                <Badge tone="emerald">🔓 Đang mở</Badge>
                                            )}
                                        </Td>
                                        <Td className="text-right">
                                            <Button
                                                size="sm"
                                                variant={t.isLocked ? 'success' : 'danger'}
                                                onClick={() => handleToggle(t.id, t.isLocked)}
                                                disabled={isToggling}
                                            >
                                                {isToggling
                                                    ? 'Đang xử lý...'
                                                    : t.isLocked
                                                    ? '🔓 Mở khóa'
                                                    : '🔒 Khóa'}
                                            </Button>
                                        </Td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}

            <FormError>{error}</FormError>
        </Card>
    );
}