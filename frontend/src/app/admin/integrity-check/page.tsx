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


            <div className="max-w-7xl mx-auto px-6 py-8">
                <IntegrityCheckPanel violations={violations} loading={loadingList} onRefresh={fetchViolations} />
            </div>
        </div>
    );
}