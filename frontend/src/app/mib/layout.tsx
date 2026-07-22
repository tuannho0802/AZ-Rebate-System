'use client';

import RoleSidebarLayout, { RoleSidebarItem } from '../../components/layout/RoleSidebarLayout';

const MIB_ITEMS: RoleSidebarItem[] = [
  { href: '/mib/config', label: 'Commission Configs', icon: '⚙️' },
  { href: '/mib/tree', label: 'Cây con cháu', icon: '🌳' },
  { href: '/mib/templates', label: 'Template Apply', icon: '🗂️' },
  { href: '/mib/locks', label: 'Template Locks', icon: '🔒' },
  { href: '/mib/assets', label: 'Assets View', icon: '📦' },
];

export default function MibLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleSidebarLayout basePath="/mib" roleLabel="MIB" items={MIB_ITEMS}>
      {children}
    </RoleSidebarLayout>
  );
}
