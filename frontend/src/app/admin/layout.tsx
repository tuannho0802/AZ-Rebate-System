'use client';

import RoleSidebarLayout, { RoleSidebarItem } from '../../components/layout/RoleSidebarLayout';

const ADMIN_ITEMS: RoleSidebarItem[] = [
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/assets', label: 'Assets', icon: '📦' },
  { href: '/admin/templates', label: 'Templates', icon: '🗂️' },
  { href: '/admin/commission-configs', label: 'Commission Configs', icon: '⚙️' },
  { href: '/admin/payout-sessions', label: 'Payout Sessions', icon: '💸' },
  { href: '/admin/integrity-check', label: 'Integrity Check', icon: '✓' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleSidebarLayout basePath="/admin" roleLabel="Admin" items={ADMIN_ITEMS}>
      {children}
    </RoleSidebarLayout>
  );
}
