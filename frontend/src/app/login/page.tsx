'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';

const testAccounts: { type: 'admin' | 'user'; email: string; role: string }[] = [
  { type: 'admin', email: 'admin_test@azrebate.com', role: 'Admin' },
  { type: 'user', email: 'mib@test.com', role: 'MIB' },
  { type: 'user', email: 'lv1-a@test.com', role: 'IB' },
];

export default function LoginPage() {
  const [loginType, setLoginType] = useState<'admin' | 'user'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password, loginType);
    // Redirect after successful login (handled by auth context state change in parent)
    router.push(loginType === 'admin' ? '/admin' : loginType === 'user' ? '/mib' : '/');
  };

  const handleQuickFill = (account: typeof testAccounts[0]) => {
    setEmail(account.email);
    setPassword('Test@1234');
    setLoginType(account.type);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Rebate System</h1>
          <p className="text-gray-600 mt-2">Manual QA MVP</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Login Type Tabs */}
          <div className="flex mb-6">
            <button
              type="button"
              className={`flex-1 py-2 px-4 text-center font-medium rounded-l-lg ${loginType === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              onClick={() => setLoginType('admin')}
            >
              Admin
            </button>
            <button
              type="button"
              className={`flex-1 py-2 px-4 text-center font-medium rounded-r-lg ${loginType === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              onClick={() => setLoginType('user')}
            >
              User (MIB/IB)
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin_test@azrebate.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Test@1234"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Quick Fill Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Fill Test Accounts:</h3>
            <div className="space-y-2">
              {testAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickFill(acc)}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md text-sm text-gray-700 transition-colors"
                >
                  <span className="font-medium">{acc.role}</span>: {acc.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
