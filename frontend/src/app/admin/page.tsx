'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { PageShell, TopNav, PageBody, Card, Button, cx } from '../../components/ui/primitives';
import { Asset, listAssets } from '../../lib/api/admin';

const TABS = [
  { key: 'users', label: 'Users', icon: '👥' },
  { key: 'assets', label: 'Assets', icon: '📦' },
  { key: 'templates', label: 'Templates', icon: '🗂️' },
  { key: 'integrity', label: 'Integrity Check', icon: '✓' },
  { key: 'config', label: 'Commission Configs', icon: '⚙️' },
  { key: 'sessions', label: 'Payout Sessions', icon: '💸' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const routeFor: Record<TabKey, string | null> = {
  users: '/admin/users',
  assets: '/admin/assets',
  templates: '/admin/templates',
  integrity: '/admin/integrity-check',
  config: '/config',
  sessions: '/sessions',
};

const descriptionFor: Record<TabKey, string> = {
  users: 'Tạo, tìm kiếm và quản lý toàn bộ tài khoản trong hệ thống.',
  assets: 'Danh mục tài sản dùng để cấu hình rebate/markup.',
  templates: 'Đóng gói sẵn 1 bộ rebate/markup, áp dụng nhanh cho nhiều IB.',
  integrity: 'Quét toàn bộ hệ thống để phát hiện vi phạm quy tắc "con ≤ cha".',
  config: 'Xem cây cấu hình hoa hồng theo user/asset, sửa trực tiếp.',
  sessions: 'Quản lý vòng đời payout: DRAFT → LOCKED → COMPLETED.',
};

export default function AdminPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('users');
  const [assets, setAssets] = useState<Asset[]>([]);

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

  const fetchAssets = useCallback(() => {
    return listAssets().then(setAssets).catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    if (activeTab === 'assets') fetchAssets();
  }, [activeTab, isLoading, user, fetchAssets]);

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  const tab = TABS.find((t) => t.key === activeTab)!;
  const route = routeFor[activeTab];

  return (
    <PageShell>
      <TopNav roleKind="admin" title="Rebate System" subtitle="Admin Console" userEmail={user.email} onLogout={logout} />

      <PageBody>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap transition-colors',
                activeTab === t.key
                  ? 'border-violet-600 text-violet-700 bg-violet-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100',
              )}
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <Card title={tab.label} description={descriptionFor[activeTab]}>
          {activeTab === 'assets' && assets.length > 0 && (
            <p className="text-sm text-slate-500 mb-4">
              Hiện có <strong className="text-slate-800">{assets.length}</strong> asset trong hệ thống.
            </p>
          )}
          <p className="text-sm text-slate-500 mb-5">
            Mục này đã tách sang route riêng để dùng chung component và giữ trang này gọn nhẹ.
          </p>
          {route && (
            <Button onClick={() => router.push(route)}>
              Mở {tab.label} →
            </Button>
          )}
        </Card>
      </PageBody>
    </PageShell>
  );
}
