import { api } from '../api-client';

export interface PayoutSession {
  id: string;
  name: string;
  note?: string;
  baseVolume: number;
  status: 'DRAFT' | 'LOCKED' | 'COMPLETED';
  sourceUserId: string;
  assetId: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  payoutSessionId: string;
  beneficiaryId: string;
  assetId: string;
  netRebate: number;
  netMarkup: number;
  netTransferUnit: number;
  calculatedValue: number;
}

export interface CreatePayoutSessionDto {
  name: string;
  note?: string;
  baseVolume: number;
  sourceUserId: string;
  assetId: string;
}

// Helper: baseVolume / netRebate / netMarkup / netTransferUnit / calculatedValue are all
// Prisma Decimal fields — backend always serializes them as STRING over JSON, even though
// they display like plain numbers. Must cast with Number(...) before using .toLocaleString()
// or any arithmetic, otherwise values render wrong or silently stay as strings.
export function normalizeSession(s: any): PayoutSession {
  return { ...s, baseVolume: Number(s.baseVolume) };
}

export function normalizeLedgerEntry(e: any): LedgerEntry {
  return {
    ...e,
    netRebate: Number(e.netRebate),
    netMarkup: Number(e.netMarkup),
    netTransferUnit: Number(e.netTransferUnit),
    calculatedValue: Number(e.calculatedValue),
  };
}

export async function listSessions(status?: 'DRAFT' | 'LOCKED' | 'COMPLETED'): Promise<PayoutSession[]> {
  const url = status ? `/payout-sessions?status=${status}` : '/payout-sessions';
  const data = await api.get<any[]>(url);
  return (data ?? []).map(normalizeSession);
}

export async function createSession(dto: CreatePayoutSessionDto): Promise<PayoutSession> {
  const data = await api.post<any>('/payout-sessions', dto);
  return normalizeSession(data);
}

export async function lockSession(id: string): Promise<void> {
  await api.post<void>(`/payout-sessions/${id}/lock`, {});
}

export async function completeSession(id: string): Promise<void> {
  await api.post<void>(`/payout-sessions/${id}/complete`, {});
}
export async function getSession(id: string): Promise<PayoutSession> {
  const data = await api.get<any>(`/payout-sessions/${id}`);
  return normalizeSession(data);
}

export async function getSessionLedger(id: string): Promise<LedgerEntry[]> {
  const data = await api.get<any[]>(`/payout-sessions/${id}/ledger`);
  return (data ?? []).map(normalizeLedgerEntry);
}
