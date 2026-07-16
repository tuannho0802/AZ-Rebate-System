'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import CommissionManager from '../../components/commission-manager';

export default function IbPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

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
            <strong>Welcome, {user.email}</strong> — IB Dashboard
          </p>
          <p className="text-sm text-gray-500">
            * Quản lý (CRUD) tài khoản và cấu hình rebate/markup cho <strong>con trực tiếp</strong> của
            chính mình — đúng quy tắc "LvN CRUD cho LvN+1". Cấu hình của chính bạn chỉ được set bởi cấp
            cao hơn.
          </p>
        </div>

        {/* Account CRUD + Commission Config — chỉ áp dụng cho con trực tiếp */}
        <CommissionManager />
      </div>
    </div>
  );
}