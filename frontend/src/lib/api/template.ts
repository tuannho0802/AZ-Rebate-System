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