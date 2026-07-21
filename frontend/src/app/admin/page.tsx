'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
      return;
    }
    // Phương án A: Redirect tự động sang route con đầu tiên /admin/users
    router.replace('/admin/users');
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
      Đang chuyển hướng đến Admin Console...
    </div>
  );
}
