'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { IntegrityViolation, listIntegrityViolations } from '../../../lib/api/integrity';
import IntegrityCheckPanel from '../../../components/IntegrityCheckPanel';

export default function AdminIntegrityCheckPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [violations, setViolations] = useState<IntegrityViolation[]>([]);
    const [loadingList, setLoadingList] = useState(true);

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

    const fetchViolations = useCallback(() => {
        setLoadingList(true);
        return listIntegrityViolations()
            .then(setViolations)
            .catch(console.error)
            .finally(() => setLoadingList(false));
    }, []);

    useEffect(() => {
        if (isLoading || !user || user.type !== 'admin') return;
        fetchViolations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, user]);

    if (isLoading) return null;
    if (!user || user.type !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-blue-600 text-white px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Rebate System — Integrity Check</h1>
                    <a href="/admin" className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded">
                        ← Quay lại Admin
                    </a>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <IntegrityCheckPanel violations={violations} loading={loadingList} onRefresh={fetchViolations} />
            </div>
        </div>
    );
}