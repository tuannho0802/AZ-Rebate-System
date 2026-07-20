import { api } from '../api-client';

export interface TemplateItem {
    id?: string;
    assetId: string;
    rebateUnit: number;
    markupPips: number;
    asset?: { id: string; code: string; name: string };
}

// Khớp đúng response thật từ backend (AdminService.listTemplates/createTemplate/updateTemplate)
export interface Template {
    id: string;
    name: string;
    description?: string;
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
    items: CreateTemplateItemDto[];
}

export interface UpdateTemplateDto {
    name?: string;
    description?: string;
    // Chỉ gửi (các) item cần đổi — backend upsert đúng item được liệt kê,
    // các item khác trong template giữ nguyên giá trị cũ (xem admin/page.tsx cũ).
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

// Admin áp Template cho BẤT KỲ user nào, kể cả MIB root — actor Admin bypass
// toàn bộ cap/orphan check (xem BUSINESS_RULES.md mục 3). Item (0,0) placeholder
// bị backend tự lọc bỏ, không áp dụng.
export async function applyTemplateAsAdmin(templateId: string, userId: string): Promise<unknown[]> {
    return api.post<unknown[]>(`/templates/${templateId}/apply/${userId}`, {});
}