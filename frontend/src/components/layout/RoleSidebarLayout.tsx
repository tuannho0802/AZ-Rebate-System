'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { cx, roleTheme, RoleKind } from '../ui/primitives';

export interface RoleSidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export interface RoleSidebarLayoutProps {
  basePath: string; // '/admin' | '/mib' | '/ib'
  roleLabel: string; // 'Admin' | 'MIB' | 'IB'
  items: RoleSidebarItem[];
  children: ReactNode;
}

export default function RoleSidebarLayout({
  basePath,
  roleLabel,
  items,
  children,
}: RoleSidebarLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const roleKey: RoleKind =
    roleLabel.toLowerCase() === 'admin'
      ? 'admin'
      : roleLabel === 'MIB'
        ? 'MIB'
        : 'IB';
  const theme = roleTheme[roleKey] ?? roleTheme.admin;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0">
        <div>
          {/* Header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className={cx(
                  'h-7 w-7 rounded-md flex items-center justify-center font-bold text-xs text-white bg-gradient-to-r',
                  theme.grad,
                )}
              >
                {roleLabel === 'Admin' ? 'AD' : roleLabel}
              </div>
              <span className="font-bold text-slate-900">{roleLabel} Console</span>
            </div>
            {user?.email && (
              <p className="text-xs text-slate-500 truncate mt-1" title={user.email}>
                {user.email}
              </p>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                  )}
                >
                  {item.icon && <span className="text-base shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-w-0 p-8">{children}</main>
    </div>
  );
}
