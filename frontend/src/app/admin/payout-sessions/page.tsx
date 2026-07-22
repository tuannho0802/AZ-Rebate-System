'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  PayoutSession,
  LedgerEntry,
  listSessions,
  createSession,
  lockSession,
  completeSession,
  getSession,
} from '@/lib/api/payout-session';
import { listUsers, User } from '@/lib/api/user';
import { listAssets, Asset } from '@/lib/api/admin';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { IdDisplay, buildUserMap, buildAssetMap } from '@/components/ui/IdDisplay';
import {
  Card,
  Button,
  Field,
  Input,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
} from '@/components/ui/primitives';
import { FormError } from '@/components/ui/Dialog';

export default function AdminPayoutSessionsPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<PayoutSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PayoutSession | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [newSession, setNewSession] = useState({
    name: '',
    note: '',
    baseVolume: 0,
    sourceUserId: '',
    assetId: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, isLoading, router]);

  const loadSessionsList = () => {
    listSessions().then((data) => setSessions(data)).catch(console.error);
  };

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    Promise.all([
      listSessions().then((data) => setSessions(data)),
      listUsers().then((data) => setUsers(data)),
      listAssets().then((data) => setAssets(data)),
    ]).catch(console.error);
  }, [isLoading, user]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.sourceUserId || !newSession.assetId) {
      setFormError('Vui lòng điền đầy đủ Source User và Asset.');
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const created = await createSession(newSession);
      setSessions([...sessions, created]);
      setNewSession({ name: '', note: '', baseVolume: 0, sourceUserId: '', assetId: '' });
      alert('Payout session created successfully!');
    } catch (error: any) {
      setFormError(error?.body?.message || error.message || 'Lỗi tạo payout session');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLock = async (id: string) => {
    setActionLoading(true);
    try {
      await lockSession(id);
      loadSessionsList();
      await loadSessionDetails(id);
      alert('Session locked successfully!');
    } catch (error: any) {
      alert(`Failed to lock: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (id: string) => {
    setActionLoading(true);
    try {
      await completeSession(id);
      loadSessionsList();
      await loadSessionDetails(id);
      alert('Session completed successfully!');
    } catch (error: any) {
      alert(`Failed to complete: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const loadSessionDetails = async (id: string) => {
    try {
      const sessionData = await getSession(id);
      setSelectedSession(sessionData);
      setLedgerEntries(sessionData.ledgerEntries);
    } catch (error: any) {
      alert(`Failed to load session details: ${error.message}`);
    }
  };

  const getStatusBadgeTone = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'slate';
      case 'LOCKED':
        return 'indigo';
      case 'COMPLETED':
        return 'emerald';
      default:
        return 'slate';
    }
  };

  const userMap = buildUserMap(users);
  const assetMap = buildAssetMap(assets);

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <div className="space-y-6">
      {/* Create Session Form */}
      <Card title="Tạo Payout Session mới" description="Nhập thông tin giao dịch để bắt đầu quy trình đối chiếu và phân bổ hoa hồng (DRAFT).">
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tên Session" required>
              <Input
                type="text"
                placeholder="Ví dụ: Payout Session Tháng 07/2026"
                value={newSession.name}
                onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                required
                disabled={formLoading}
              />
            </Field>
            <Field label="Ghi chú (Note)">
              <Input
                type="text"
                placeholder="Thông tin thêm (optional)"
                value={newSession.note}
                onChange={(e) => setNewSession({ ...newSession, note: e.target.value })}
                disabled={formLoading}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Field label="Khối lượng giao dịch (Base Volume)" required>
              <Input
                type="number"
                placeholder="Volume giao dịch"
                value={newSession.baseVolume || ''}
                onChange={(e) => setNewSession({ ...newSession, baseVolume: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
                required
                disabled={formLoading}
              />
            </Field>
            <Field label="Tài khoản nguồn (Source User)" required>
              <SearchableSelect
                options={users.map((u) => ({
                  id: u.id,
                  label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
                  sublabel: u.email,
                  tag: u.role,
                }))}
                value={newSession.sourceUserId}
                onChange={(val) => setNewSession({ ...newSession, sourceUserId: val })}
                placeholder="Chọn Source User..."
              />
            </Field>
            <Field label="Sản phẩm (Asset)" required>
              <SearchableSelect
                options={assets.map((a) => ({
                  id: a.id,
                  label: `${a.code} — ${a.name}`,
                  sublabel: a.category,
                }))}
                value={newSession.assetId}
                onChange={(val) => setNewSession({ ...newSession, assetId: val })}
                placeholder="Chọn Asset..."
              />
            </Field>
          </div>
          <FormError>{formError}</FormError>
          <div className="flex justify-end mt-2">
            <Button type="submit" variant="success" disabled={formLoading}>
              {formLoading ? 'Đang tạo...' : 'Tạo Session (DRAFT)'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Sessions List */}
      <Card title="Danh sách Payout Sessions" description="Tổng hợp tất cả các phiên thanh toán đã tạo.">
        {sessions.length === 0 ? (
          <EmptyState icon="💸" title="Chưa có payout session nào" description="Nhập thông tin bên trên để tạo session đầu tiên." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tên Session</Th>
                <Th>Trạng thái</Th>
                <Th>Khối lượng Base</Th>
                <Th className="hidden md:table-cell">Ghi chú</Th>
                <Th className="hidden lg:table-cell">Ngày tạo</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <Td className="font-semibold text-slate-800">{s.name}</Td>
                  <Td>
                    <Badge tone={getStatusBadgeTone(s.status)}>{s.status}</Badge>
                  </Td>
                  <Td mono className="text-sm font-medium">
                    {s.baseVolume.toLocaleString()}
                  </Td>
                  <Td className="hidden md:table-cell text-slate-500">
                    {s.note ? s.note : <span className="text-slate-300">—</span>}
                  </Td>
                  <Td className="hidden lg:table-cell text-slate-400">
                    {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => loadSessionDetails(s.id)}>
                      Xem
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Session Details Panel */}
      {selectedSession && (
        <Card
          title={`Chi tiết Session: ${selectedSession.name}`}
          description="Thông tin phân phối chiết khấu và danh sách Ledger Entries liên quan."
          actions={
            <div className="flex gap-2">
              {selectedSession.status === 'DRAFT' && (
                <Button variant="success" size="sm" onClick={() => handleLock(selectedSession.id)} disabled={actionLoading}>
                  {actionLoading ? 'Đang khóa...' : 'Khóa Session (DRAFT → LOCKED)'}
                </Button>
              )}
              {selectedSession.status === 'LOCKED' && (
                <Button variant="primary" size="sm" onClick={() => handleComplete(selectedSession.id)} disabled={actionLoading}>
                  {actionLoading ? 'Đang hoàn tất...' : 'Hoàn tất Session (LOCKED → COMPLETED)'}
                </Button>
              )}
            </div>
          }
        >
          {/* Key-Value metadata info list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-slate-200/80 rounded-xl bg-slate-50 p-5 mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tên Phiên</span>
              <span className="text-sm font-semibold text-slate-800 mt-0.5">{selectedSession.name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái</span>
              <span className="mt-0.5">
                <Badge tone={getStatusBadgeTone(selectedSession.status)}>{selectedSession.status}</Badge>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Khối lượng (Base Volume)</span>
              <span className="text-sm font-semibold text-slate-800 mt-0.5 mono">{selectedSession.baseVolume.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tài khoản nguồn (Source)</span>
              <span className="text-sm font-semibold text-slate-800 mt-0.5">
                <IdDisplay id={selectedSession.sourceUserId} map={userMap} />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sản phẩm (Asset)</span>
              <span className="text-sm font-semibold text-slate-800 mt-0.5">
                <IdDisplay id={selectedSession.assetId} map={assetMap} />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ghi chú</span>
              <span className="text-sm text-slate-500 mt-0.5">
                {selectedSession.note ? selectedSession.note : <span className="text-slate-300">—</span>}
              </span>
            </div>
          </div>

          {selectedSession.status !== 'DRAFT' && ledgerEntries.length === 0 && (
            <EmptyState icon="📊" title="Không có Ledger Entries" description="Không phát hiện dòng hoa hồng kế thừa nào cho phiên này." />
          )}

          {/* Ledger Entries Table */}
          {ledgerEntries.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Ledger Entries (Sổ Cái Chi Tiết)</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>Người thụ hưởng (Beneficiary)</Th>
                    <Th className="text-right">Rebate nhận</Th>
                    <Th className="text-right">Markup nhận</Th>
                    <Th className="text-right">Transfer Unit</Th>
                    <Th className="text-right">Thành tiền (Calculated)</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <Td className="font-semibold text-slate-800">
                        <IdDisplay id={entry.beneficiaryId} map={userMap} />
                      </Td>
                      <Td mono className="text-right text-slate-600">
                        {entry.netRebate.toLocaleString()}
                      </Td>
                      <Td mono className="text-right text-slate-600">
                        {entry.netMarkup.toLocaleString()}
                      </Td>
                      <Td mono className="text-right text-slate-600">
                        {entry.netTransferUnit.toLocaleString()}
                      </Td>
                      <Td mono className="text-right font-semibold text-indigo-600 text-sm">
                        {entry.calculatedValue.toLocaleString()}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
