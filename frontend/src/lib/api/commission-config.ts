import { api } from '../api-client';

// ============================================================================
// Types — khớp response thật từ backend (CommissionConfigService), đối chiếu
// với API_REFERENCE.md mục Commission Config + shape thật đang dùng trong
// config/page.tsx (tab Tree/Children) và CommissionManager.tsx (MIB/IB).
// ============================================================================

export interface CommissionConfig {
    id: string;
    userId: string;
    assetId: string;
    rebateUnit: number;
    markupPips: number;
    transferUnit: number;
    version: number;
    createdAt: string;
}

// Node trong cây trả về bởi GET .../tree/:userId — đệ quy qua `children`.
export interface CommissionConfigTreeNode {
    userId: string;
    email: string;
    fullName: string | null;
    role: string;
    isActive: boolean;
    rebateUnit: number | null;
    markupPips: number | null;
    transferUnit: number | null;
    version: number | null;
    children: CommissionConfigTreeNode[];
}

// "self" trong response GET .../children/:userId — bản thân actor/node gốc được xem.
export interface CommissionConfigSelf {
    userId: string;
    email: string;
    fullName?: string | null;
    role?: string;
    isActive?: boolean;
    rebateUnit: number | null;
    markupPips: number | null;
    transferUnit?: number | null;
    version: number | null;
}

// 1 con trực tiếp trong mảng "children" của response GET .../children/:userId.
export interface CommissionConfigChild {
    userId: string;
    email: string;
    role: string;
    isActive: boolean;
    rebateUnit: number | null;
    markupPips: number | null;
    version: number | null;
}

export interface CommissionConfigChildrenResponse {
    self: CommissionConfigSelf;
    children: CommissionConfigChild[];
}

export interface UpsertCommissionConfigDto {
    userId: string;
    assetId: string;
    rebateUnit: number;
    markupPips: number;
}

export interface UpdateCommissionConfigDto {
    rebateUnit?: number;
    markupPips?: number;
    version: number; // BẮT BUỘC — optimistic lock, sai → 409
}

// ============================================================================
// API calls
// ============================================================================

// Admin-only (AdminOnlyGuard). assetId là query param — theo API_REFERENCE.md
// mục Commission Config, route này dùng CÙNG pattern query với
// GET .../children/:userId, nơi đã xác nhận assetId BẮT BUỘC qua log thật ở
// Flow 04. Áp dụng cùng giả định ở đây; nếu chạy thực tế cho thấy optional,
// cập nhật lại comment này + API_REFERENCE.md, đừng chỉ sửa lặng lẽ.
export async function getConfigTree(userId: string, assetId: string): Promise<CommissionConfigTreeNode> {
    const data = await api.get<CommissionConfigTreeNode>(`/commission-configs/tree/${userId}?assetId=${assetId}`);
    return { ...data, children: data.children ?? [] };
}

// Actor phải là chính mình (MIB/IB) hoặc Admin. assetId BẮT BUỘC — thiếu → 400.
export async function getConfigChildren(userId: string, assetId: string): Promise<CommissionConfigChildrenResponse> {
    return api.get<CommissionConfigChildrenResponse>(`/commission-configs/children/${userId}?assetId=${assetId}`);
}

// Root (MIB): chỉ Admin gọi được. Non-root: Admin hoặc cha TRỰC TIẾP của user đó.
// Backend tự chặn vượt trần cha + orphan check (BUSINESS_RULES.md mục 2.1).
export async function upsertConfig(dto: UpsertCommissionConfigDto): Promise<CommissionConfig> {
    return api.post<CommissionConfig>('/commission-configs', dto);
}

// version BẮT BUỘC trong dto — optimistic lock, sai → 409 (VersionConflict).
export async function updateConfig(
    userId: string,
    assetId: string,
    dto: UpdateCommissionConfigDto
): Promise<CommissionConfig> {
    return api.patch<CommissionConfig>(`/commission-configs/${userId}/${assetId}`, dto);
}