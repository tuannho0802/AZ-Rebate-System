'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api-client';

interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'MIB' | 'IB';
  isActive: boolean;
  parentId?: string;
  createdAt: string;
}

interface SubtreeNode {
  id: string;
  depth: number;
}

export default function MibPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [userList, setUserList] = useState<User[]>([]);
  const [subtree, setSubtree] = useState<SubtreeNode[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      // Redirect admin to admin page
      router.push('/admin');
    }
  }, [user, router]);

  useEffect(() => {
    // MIB sees all users in their subtree (recursive)
    if (user?.sub) {
      api.get<User[]>('/users').then(setUserList).catch(console.error);
    }
  }, [user]);

  const loadSubtree = async (userId: string) => {
    try {
      const nodes = await api.get<SubtreeNode[]>(`/users/${userId}/subtree`);
      setSubtree(nodes);
    } catch (error: any) {
      alert(`Failed to load subtree: ${error.message}`);
    }
  };

  if (!user || user.type === 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Rebate System — MIB Dashboard</h1>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-gray-700">
            <strong>Welcome, {user.email}</strong> — MIB Dashboard (Read-Only)
          </p>
          <p className="text-sm text-gray-500">
            * Xem toàn bộ cây con cháu của chính mình qua subtree. Không có nút sửa/xoá ở đây.
          </p>
        </div>

        {/* Subtree Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Your Subtree (Recursive)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Click vào một user để xem toàn bộ cây con của họ:
          </p>

          {userList.length === 0 ? (
            <p className="text-gray-500">Loading users...</p>
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700">Users in your subtree:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {userList.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => loadSubtree(u.id)}
                    className="text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                  >
                    <div className="font-medium">{u.email}</div>
                    <div className="text-sm text-gray-600">
                      {u.fullName || 'No name'} — {u.role} — {u.isActive ? 'Active' : 'Inactive'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">ID: {u.id.slice(0, 8)}...</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {subtree.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-700 mb-4">Subtree View:</h3>
              <div className="space-y-1">
                {subtree.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center"
                    style={{ paddingLeft: `${node.depth * 24}px` }}
                  >
                    <span className="w-6 h-6 flex items-center justify-center text-gray-400">
                      {node.depth === 0 ? '👤' : node.depth === 1 ? '👶' : ' ➡'}
                    </span>
                    <span>{node.id.slice(0, 8)}... (depth: {node.depth})</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                * This shows the recursive subtree for the selected user. Depth 0 = the user themselves.
              </p>
            </div>
          )}
        </div>

        {/* Commission Config Section (Placeholder) */}
        <div className="bg-yellow-50 rounded-lg shadow-md p-6 mt-6">
          <h3 className="font-bold text-yellow-800 mb-2">Commission Config (Placeholder)</h3>
          <p className="text-sm text-yellow-700">
            * CHƯA CÓ API xác nhận cho commission config. Placeholder ở đây vì backend đã có
            <code> /commission-configs</code> route nhưng chưa được test trong phase này.
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            Khi backend có API rõ ràng chocommission config, UI sẽ được bổ sung.
          </p>
        </div>
      </div>
    </div>
  );
}
