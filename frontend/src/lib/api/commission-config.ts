import { api } from '../api-client';

// ============================================================================
// Types — khớp response thật từ backend (CommissionConfigService), đối chiếu
// với API_REFERENCE.md mục Commission Config + shape thật đang dùng trong
// config/page.tsx (tab Tree/Children) và CommissionManager.tsx (MIB/IB).
//
// [SUA — theo phuong an A (MaxPips) da audit trong commission-config.service.ts thật]:
// rebateUnit/markupPips giờ CHỈ xuất hiện trong response khi actor là Admin — với
// MIB/IB, 2 field này bị mask hoàn toàn (không phải null, mà KHÔNG TỒN TẠI trong
// object trả về). `transferUnit` là field DUY NHẤT luôn có mặt cho MỌI actor, ở
// MỌI endpoint (POST/PATCH/children/tree) — đây là field AN TOÀN NHẤT để FE dùng
// khi hiển thị cho MIB/IB.
//
// LƯU Ý PHÂN BIỆT 2 endpoint nhóm khác nhau (đã verify trực tiếp từ source thật):
//   - GET .../children/:userId (getDirectChildren) và GET .../tree/:userId (getFullTree):
//     Non-admin CHỈ có `transferUnit`, KHÔNG có field `maxPips` nào cả.
//   - POST /commission-configs, PATCH .../:userId/:assetId, POST /templates/:id/apply/:userId:
//     đi qua maskConfigForActor() → non-admin có CẢ `transferUnit` LẪN `maxPips`
//     (cùng giá trị, dư thừa) — nhưng vẫn ưu tiên đọc `transferUnit` cho nhất quán
//     với endpoint kia, tránh phải nhớ 2 tên field khác nhau tuỳ endpoint.
// ============================================================================

export interface CommissionConfig {
    id: string;
    userId: string;
    assetId: string;
    rebateUnit?: number;   // chỉ có nếu actor là Admin
    markupPips?: number;   // chỉ có nếu actor là Admin
    maxPips?: number;      // chỉ có ở response POST/PATCH/apply-template khi actor KHÔNG phải Admin (dư thừa với transferUnit, tránh dùng — xem comment trên)
    transferUnit: number;
    version: number;
    createdAt: string;
}

// Node trong cây trả về bởi GET .../tree/:userId — đệ quy qua `children`.
// Endpoint này ADMIN-ONLY (AdminOnlyGuard chặn ở controller) nên LUÔN có đủ
// rebateUnit/markupPips, không bị mask — không cần optional ở đây.
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
// rebateUnit/markupPips CHỈ có khi actor là Admin (getDirectChildren spread có điều
// kiện `...(isAdmin && {...})`) — với MIB/IB tự xem chính mình, 2 field này KHÔNG
// TỒN TẠI trong response, dùng transferUnit thay thế.
export interface CommissionConfigSelf {
    userId: string;
    email: string;
    fullName?: string | null;
    role?: string;
    isActive?: boolean;
    rebateUnit?: number | null;
    markupPips?: number | null;
    transferUnit: number | null;
    version: number | null;
}

// 1 con trực tiếp trong mảng "children" của response GET .../children/:userId.
// [SUA] bổ sung transferUnit (backend LUÔN trả field này, type cũ bị thiếu) và
// đổi rebateUnit/markupPips thành optional (chỉ Admin mới thấy).
export interface CommissionConfigChild {
    userId: string;
    email: string;
    role: string;
    isActive: boolean;
    rebateUnit?: number | null;
    markupPips?: number | null;
    transferUnit: number | null;
    version: number | null;
}

export interface CommissionConfigChildrenResponse {
    self: CommissionConfigSelf;
    children: CommissionConfigChild[];
}

// Admin-only DTO — Admin vẫn nhập/sửa rebate+markup riêng lẻ (đặc quyền kiểm
// tra/thay đổi breakdown). Dùng ở admin/commission-configs/page.tsx.
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

// [MOI] DTO cho MIB/IB (non-admin) — CHỈ được nhập 1 số tổng duy nhất, backend
// tự split rebate/markup nội bộ theo splitByPriority (ưu tiên rebate trước).
// Gửi rebateUnit/markupPips riêng lẻ ở đây sẽ bị 403 (ForbiddenException) —
// xem commission-config.service.ts dòng ~214.
export interface SetCommissionTotalDto {
    userId: string;
    assetId: string;
    transferUnit: number;
}

export interface UpdateCommissionTotalDto {
    transferUnit: number;
    version: number; // BẮT BUỘC — optimistic lock, sai → 409
}

// ============================================================================
// API calls
// ============================================================================

// Actor phải là chính mình (MIB/IB) hoặc Admin. assetId BẮT BUỘC — thiếu → 400.
export async function getConfigTree(userId: string, assetId: string): Promise<CommissionConfigTreeNode> {
    const data = await api.get<CommissionConfigTreeNode>(`/commission-configs/tree/${userId}?assetId=${assetId}`);
    return { ...data, children: data.children ?? [] };
}

export async function getConfigChildren(userId: string, assetId: string): Promise<CommissionConfigChildrenResponse> {
    return api.get<CommissionConfigChildrenResponse>(`/commission-configs/children/${userId}?assetId=${assetId}`);
}

// Root (MIB): chỉ Admin gọi được. Non-root: Admin hoặc cha TRỰC TIẾP của user đó.
// Backend tự chặn vượt trần cha + orphan check (BUSINESS_RULES.md mục 2.1).
// ADMIN-ONLY về mặt thực tế: MIB/IB gửi rebateUnit/markupPips ở đây sẽ bị 403 —
// dùng setConfigTotal() bên dưới cho MIB/IB.
export async function upsertConfig(dto: UpsertCommissionConfigDto): Promise<CommissionConfig> {
    return api.post<CommissionConfig>('/commission-configs', dto);
}

// version BẮT BUỘC trong dto — optimistic lock, sai → 409 (VersionConflict).
// ADMIN-ONLY về mặt thực tế — xem ghi chú ở upsertConfig().
export async function updateConfig(
    userId: string,
    assetId: string,
    dto: UpdateCommissionConfigDto
): Promise<CommissionConfig> {
    return api.patch<CommissionConfig>(`/commission-configs/${userId}/${assetId}`, dto);
}

// [MOI] Dành cho MIB/IB (non-admin): chỉ nhập 1 số tổng (transferUnit), backend
// tự split rebate/markup nội bộ. Response bị mask — không có rebateUnit/markupPips,
// đọc `transferUnit` (luôn có) để hiển thị.
export async function setConfigTotal(dto: SetCommissionTotalDto): Promise<CommissionConfig> {
    return api.post<CommissionConfig>('/commission-configs', dto);
}

// [MOI] Dành cho MIB/IB (non-admin) — version BẮT BUỘC, sai → 409.
export async function updateConfigTotal(
    userId: string,
    assetId: string,
    dto: UpdateCommissionTotalDto
): Promise<CommissionConfig> {
    return api.patch<CommissionConfig>(`/commission-configs/${userId}/${assetId}`, dto);
}