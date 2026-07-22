'use client';

import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, forwardRef } from 'react';

/**
 * Shared design system for the Rebate System console.
 *
 * Palette (intentional, not Tailwind defaults left as-is):
 *  - Canvas:      slate-50  (#F8FAFC)
 *  - Surface:     white, hairline border slate-200 — NOT heavy drop shadows
 *  - Primary:     indigo-600 (#4F46E5) — actions, focus rings
 *  - Role colors: ADMIN = violet, MIB = blue, IB = teal — used consistently
 *    everywhere (nav, badges, avatars) so which hierarchy level you're
 *    looking at is always legible at a glance.
 *  - Status:      emerald = active/ok, rose = inactive/danger, amber = pending/placeholder
 *  - Numerics:    tabular-nums + slate-900, everything else slate-600/500
 */

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ----------------------------- Layout shell ----------------------------- */

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}

const roleTheme = {
  admin: { grad: 'from-violet-600 to-violet-500', ring: 'ring-violet-200', text: 'text-violet-700', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  MIB: { grad: 'from-blue-600 to-blue-500', ring: 'ring-blue-200', text: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  IB: { grad: 'from-teal-600 to-teal-500', ring: 'ring-teal-200', text: 'text-teal-700', bg: 'bg-teal-50', dot: 'bg-teal-500' },
} as const;

export type RoleKind = keyof typeof roleTheme;
export { roleTheme };



export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(' mx-auto space-y-6', className)}>{children}</div>;
}

/* -------------------------------- Cards -------------------------------- */

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx('bg-white rounded-xl border border-slate-200', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-6 pt-4' : ''}>{children}</div>
    </section>
  );
}

export function InfoBanner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  const styles =
    tone === 'info'
      ? 'bg-indigo-50 border-indigo-100 text-indigo-900'
      : 'bg-amber-50 border-amber-100 text-amber-900';
  return <div className={cx('rounded-xl border px-4 py-3 text-sm leading-relaxed', styles)}>{children}</div>;
}

/* ------------------------------- Buttons -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:hover:bg-indigo-600 shadow-sm shadow-indigo-600/10',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/10',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}>(function Button({ variant = 'primary', size = 'md', className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/* -------------------------------- Badges -------------------------------- */

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode;
  tone?: 'slate' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'violet' | 'blue' | 'teal';
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    violet: 'bg-violet-100 text-violet-700',
    blue: 'bg-blue-100 text-blue-700',
    teal: 'bg-teal-100 text-teal-700',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: 'MIB' | 'IB' | 'admin' }) {
  const map = {
    MIB: <Badge tone="blue">MIB · Root</Badge>,
    IB: <Badge tone="teal">IB · Con</Badge>,
    admin: <Badge tone="violet">Admin</Badge>,
  } as const;
  return map[role];
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="emerald">● Active</Badge>
  ) : (
    <Badge tone="rose">● Ngừng hoạt động</Badge>
  );
}

/* -------------------------------- Inputs --------------------------------- */

const fieldBase =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 transition-shadow';

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </span>
      )}
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx(fieldBase, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cx(fieldBase, 'appearance-none bg-no-repeat bg-right pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, HTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props }: any,
  ref,
) {
  return <textarea ref={ref} className={cx(fieldBase, className)} rows={3} {...props} />;
});

/* -------------------------------- Table --------------------------------- */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm border-separate border-spacing-0">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        'sticky top-0 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 border-b border-slate-200 bg-slate-50/80',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, mono }: { children?: ReactNode; className?: string; mono?: boolean }) {
  return (
    <td className={cx('px-4 py-3 border-b border-slate-100 text-slate-700', mono && 'font-mono tabular-nums text-slate-900', className)}>
      {children}
    </td>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="mb-3 text-slate-300 text-3xl">{icon}</div>}
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin h-4 w-4', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Loading({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
      <Spinner /> {label}
    </div>
  );
}
