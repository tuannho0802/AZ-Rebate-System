'use client';

import RoleSidebarLayout, { RoleSidebarItem } from '../../components/layout/RoleSidebarLayout';

const IB_ITEMS: RoleSidebarItem[] = [
  { href: '/ib/config', label: 'Commission Configs', icon: '⚙️' },
  { href: '/ib/templates', label: 'Template Apply', icon: '🗂️' },
  { href: '/ib/locks', label: 'Template Locks', icon: '🔒' },
  { href: '/ib/assets', label: 'Assets View', icon: '📦' },
];

export default function IbLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleSidebarLayout basePath="/ib" roleLabel="IB" items={IB_ITEMS}>
      {children}
    </RoleSidebarLayout>
  );
}
