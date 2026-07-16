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

interface UpdateUserDto {
  fullName?: string;
  isActive?: boolean;
}

export default function IbPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [directChildren, setDirectChildren] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [updateForm, setUpdateForm] = useState<UpdateUserDto>({});

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
    // IB sees direct children only (scope enforced by backend)
    if (user?.sub) {
      api.get<User[]>('/users').then(setDirectChildren).catch(console.error);
    }
  }, [user]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updated = await api.patch<User>(`/users/${editingUser.id}`, updateForm);
      setDirectChildren(directChildren.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(updated);
      setUpdateForm({});
      alert('User updated successfully!');
    } catch (error: any) {
      alert(`Failed to update user: ${error.message}`);
    }
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as 'MIB' | 'IB';

    try {
      const created = await api.post<User>('/users', {
        email,
        password,
        fullName,
        role,
        parentId: user?.sub,
      });
      setDirectChildren([...directChildren, created]);
      (e.target as HTMLFormElement).reset();
      alert('Child created successfully!');
    } catch (error: any) {
      alert(`Failed to create child: ${error.message}`);
    }
  };

  if (!user || user.type === 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Rebate System — IB Dashboard</h1>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-gray-700">
            <strong>Welcome, {user.email}</strong> — IB Dashboard (Level {user.role === 'MIB' ? 'MIB' : 'IB'})
          </p>
          <p className="text-sm text-gray-500">
            * Xem danh sách con trực tiếp của chính mình. Có thể CRUD (sửa thông tin, tạo tài khoản mới) cho con trực tiếp.
          </p>
        </div>

        {/* Create Child Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Child</h2>
          <form onSubmit={handleCreateChild} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="email"
                name="email"
                placeholder="Email"
                required
                className="px-3 py-2 border rounded"
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                required
                className="px-3 py-2 border rounded"
              />
            </div>
            <input
              type="text"
              name="fullName"
              placeholder="Full Name (optional)"
              className="px-3 py-2 border rounded"
            />
            <select name="role" className="px-3 py-2 border rounded">
              <option value="MIB">MIB</option>
              <option value="IB">IB</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Create Child
            </button>
          </form>
        </div>

        {/* Direct Children List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Direct Children</h2>
          {directChildren.length === 0 ? (
            <p className="text-gray-500">No direct children yet.</p>
          ) : (
            <div className="space-y-4">
              {directChildren.map((child) => (
                <div key={child.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{child.email}</h3>
                      <p className="text-sm text-gray-600">
                        {child.fullName || 'No name'} — {child.role} — {child.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingUser(child);
                        setUpdateForm({ fullName: child.fullName, isActive: child.isActive });
                      }}
                      className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit User Modal/Section */}
        {editingUser && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-bold mb-4">Edit User: {editingUser.email}</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={updateForm.fullName || ''}
                  onChange={(e) => setUpdateForm({ ...updateForm, fullName: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={updateForm.isActive ?? true}
                    onChange={(e) => setUpdateForm({ ...updateForm, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="isActive">Is Active</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setUpdateForm({});
                  }}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Commission Config Section (Placeholder) */}
        <div className="bg-yellow-50 rounded-lg shadow-md p-6 mt-6">
          <h3 className="font-bold text-yellow-800 mb-2">Commission Config (Placeholder)</h3>
          <p className="text-sm text-yellow-700">
            * CHƯA CÓ API xác nhận cho commission config. Placeholder ở đây vì backend đã có
            <code> /commission-configs</code> route nhưng chưa được test trong phase này.
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            Khi backend có API rõ ràng cho commission config, UI sẽ được bổ sung.
          </p>
        </div>
      </div>
    </div>
  );
}
