'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import {
  PayoutSession,
  LedgerEntry,
  listSessions,
  createSession,
  lockSession,
  completeSession,
  getSession,
} from '../../lib/api/payout-session';

export default function SessionsPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<PayoutSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PayoutSession | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  const [newSession, setNewSession] = useState({
    name: '',
    note: '',
    baseVolume: 0,
    sourceUserId: '',
    assetId: '',
  });

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

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    // Load sessions on mount
    listSessions()
      .then((data) => setSessions(data))
      .catch(console.error);
  }, [isLoading, user]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createSession(newSession);
      setSessions([...sessions, created]);
      setNewSession({ name: '', note: '', baseVolume: 0, sourceUserId: '', assetId: '' });
      alert('Payout session created successfully!');
    } catch (error: any) {
      alert(`Failed to create session: ${error.message}`);
    }
  };

  const handleLock = async (id: string) => {
    try {
      await lockSession(id);
      setSessions(sessions.map((s) => (s.id === id ? { ...s, status: 'LOCKED' } : s)));
      loadSessionDetails(id);
      alert('Session locked successfully!');
    } catch (error: any) {
      alert(`Failed to lock: ${error.message}`);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeSession(id);
      setSessions(sessions.map((s) => (s.id === id ? { ...s, status: 'COMPLETED' } : s)));
      loadSessionDetails(id);
      alert('Session completed successfully!');
    } catch (error: any) {
      alert(`Failed to complete: ${error.message}`);
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

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Payout Sessions</h1>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Create Session Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Session</h2>
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={newSession.name}
                onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                required
                className="px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={newSession.note}
                onChange={(e) => setNewSession({ ...newSession, note: e.target.value })}
                className="px-3 py-2 border rounded"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <input
                type="number"
                placeholder="Base Volume"
                value={newSession.baseVolume}
                onChange={(e) => setNewSession({ ...newSession, baseVolume: parseFloat(e.target.value) || 0 })}
                min="0"
                required
                className="px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Source User ID"
                value={newSession.sourceUserId}
                onChange={(e) => setNewSession({ ...newSession, sourceUserId: e.target.value })}
                required
                className="px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Asset ID"
                value={newSession.assetId}
                onChange={(e) => setNewSession({ ...newSession, assetId: e.target.value })}
                required
                className="px-3 py-2 border rounded"
              />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Create Session (DRAFT)
            </button>
          </form>
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Sessions List</h2>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-sm text-gray-600">
                    {s.note || 'No note'} • {s.baseVolume.toLocaleString()} • {s.status}
                  </p>
                </div>
                <button
                  onClick={() => loadSessionDetails(s.id)}
                  className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Session Details Modal/Panel */}
        {selectedSession && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Session Details: {selectedSession.name}</h2>
            <div className="mb-4">
              <p>Name: {selectedSession.name}</p>
              <p>Note: {selectedSession.note || 'N/A'}</p>
              <p>Base Volume: {selectedSession.baseVolume.toLocaleString()}</p>
              <p>Status: {selectedSession.status}</p>
              <p>Source User: {selectedSession.sourceUserId}</p>
              <p>Asset: {selectedSession.assetId}</p>
            </div>

            {/* State-based buttons */}
            {selectedSession.status === 'DRAFT' && (
              <button
                onClick={() => handleLock(selectedSession.id)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Lock (DRAFT → LOCKED)
              </button>
            )}

            {selectedSession.status === 'LOCKED' && (
              <button
                onClick={() => handleComplete(selectedSession.id)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Complete (LOCKED → COMPLETED)
              </button>
            )}

            {(selectedSession.status === 'LOCKED' || selectedSession.status === 'COMPLETED') && (
              <div className="text-yellow-600 text-sm mt-2">
                * Session đã khóa hoặc hoàn tất, không thể lock/complete lại.
              </div>
            )}

            {/* Ledger Entries Table */}
            {ledgerEntries.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-bold mb-2">Ledger Entries</h3>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2">Beneficiary</th>
                      <th className="px-4 py-2">Net Rebate</th>
                      <th className="px-4 py-2">Net Markup</th>
                      <th className="px-4 py-2">Net Transfer</th>
                      <th className="px-4 py-2">Calculated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2">{entry.beneficiaryId}</td>
                        <td className="px-4 py-2">{entry.netRebate.toLocaleString()}</td>
                        <td className="px-4 py-2">{entry.netMarkup.toLocaleString()}</td>
                        <td className="px-4 py-2">{entry.netTransferUnit.toLocaleString()}</td>
                        <td className="px-4 py-2">{entry.calculatedValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}