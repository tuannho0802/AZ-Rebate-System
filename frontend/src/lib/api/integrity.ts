import { api } from '../api-client';

export interface TemplateItem {
    id?: string;
    assetId: string;
    // [SUA] Admin (qua GET /admin/templates) luôn thấy đủ 2 field này.
    // Non-admin / MIB-IB (qua GET /templates/visible) bị backend mask —
    // rebateUnit/markupPips sẽ KHÔNG có mặt trong response, thay bằng maxPips.
    // Do đó cả 3 field đều optional ở type response; đừng giả định field nào
    // luôn tồn tại — kiểm tra actor đang gọi API nào trước khi đọc.
    rebateUnit?: number;
    markupPips?: number;
    maxPips?: number;
    asset?: { id: string; code: string; name: string };
}

// Khớp đúng response thật từ backend (AdminService.listTemplates/createTemplate/updateTemplate)
export interface Template {
    id: string;
    name: string;
    description?: string;
    level: number; // level bắt buộc của template
    items: TemplateItem[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateTemplateItemDto {
    assetId: string;
    rebateUnit: number;
    markupPips: number;
}

export interface CreateTemplateDto {
    name: string;
    description?: string;
    level: number; // Bắt buộc khi tạo
    items: CreateTemplateItemDto[];
}

export interface UpdateTemplateDto {
    name?: string;
    description?: string;
    level?: number;
    // Chỉ gửi (các) item cần đổi — backend upsert đúng item được liệt kê,
    // các item khác trong template giữ nguyên giá trị cũ.
    items?: CreateTemplateItemDto[];
}

export async function listTemplates(): Promise<Template[]> {
    return api.get<Template[]>('/admin/templates');
}

export async function createTemplate(dto: CreateTemplateDto): Promise<Template> {
    return api.post<Template>('/admin/templates', dto);
}

export async function updateTemplate(id: string, dto: UpdateTemplateDto): Promise<Template> {
    return api.patch<Template>(`/admin/templates/${id}`, dto);
}

export async function deleteTemplate(id: string): Promise<void> {
    await api.delete(`/admin/templates/${id}`);
}

// Áp Template cho user. Actor thực tế có thể là Admin (bypass toàn bộ cap/orphan check)
// HOẶC cha trực tiếp (bắt buộc check cap tổng của cha).
export async function applyTemplate(templateId: string, userId: string): Promise<unknown[]> {
    return api.post<unknown[]>(`/templates/${templateId}/apply/${userId}`, {});
}

// Lock template không cho user sử dụng (Chỉ Admin hoặc cha trực tiếp)
export async function lockTemplate(templateId: string, userId: string): Promise<unknown> {
    return api.post<unknown>(`/templates/${templateId}/lock/${userId}`, {});
}

// Mở khóa template cho user sử dụng (Chỉ Admin hoặc cha trực tiếp)
export async function unlockTemplate(templateId: string, userId: string): Promise<unknown> {
    return api.post<unknown>(`/templates/${templateId}/unlock/${userId}`, {});
}

// Lấy danh sách các template được phép xem/sử dụng của actor
export async function listVisibleTemplates(): Promise<Template[]> {
    return api.get<Template[]>('/templates/visible');
}

// Trạng thái lock của từng template cho 1 user cụ thể
export interface TemplateLockStatus {
    id: string;
    name: string;
    description?: string;
    level: number;
    isLocked: boolean;
}

// Lấy trạng thái lock tất cả template (cùng level) cho 1 user con trực tiếp
export async function getTemplateLockStatus(userId: string): Promise<TemplateLockStatus[]> {
    return api.get<TemplateLockStatus[]>(`/templates/locks/${userId}`);
}

export interface IntegrityViolation {
    assetId: string;
    assetCode: string;
    childUserId: string;
    childEmail: string;
    parentUserId: string;
    parentEmail: string;
    childRebate: number;
    childMarkup: number;
    parentRebate: number;
    parentMarkup: number;
    childTotal: number;
    parentTotal: number;
    violatesTotal: boolean;
    violatesRebate?: boolean;
    violatesMarkup?: boolean;
}

export async function listIntegrityViolations(): Promise<IntegrityViolation[]> {
    return api.get<IntegrityViolation[]>('/admin/integrity-check');
}