import { api } from '../api-client';

// Shape FLAT, đã verify trực tiếp từ interface `ChainViolation` trong
// integrity.service.ts (backend) — KHÔNG lồng nhau như suy đoán ban đầu
// (xem API_REFERENCE.md mục Integrity Check).
export interface IntegrityViolation {
    assetCode: string;
    assetId: string;
    childEmail: string;
    childUserId: string;
    parentEmail: string;
    parentUserId: string;
    childRebate: number;
    childMarkup: number;
    parentRebate: number;
    parentMarkup: number;
    violatesRebate: boolean;
    violatesMarkup: boolean;
}

export async function listIntegrityViolations(): Promise<IntegrityViolation[]> {
    return api.get<IntegrityViolation[]>('/admin/integrity-check');
}