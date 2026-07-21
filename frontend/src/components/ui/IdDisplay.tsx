'use client';

import { ReactNode } from 'react';

/**
 * IdDisplay — resolve userId/assetId sang tên hiển thị.
 *
 * KHÔNG BAO GIỜ hiện UUID thô trong text hiển thị chính.
 * ID gốc chỉ nằm trong `title` attribute (tooltip hover) cho debug.
 *
 * Dùng cùng với 1 Map<string, {label, sublabel?}> đã tải sẵn.
 */

export interface IdDisplayMap {
  [id: string]: { label: string; sublabel?: string };
}

export function resolveId(
  id: string | null | undefined,
  map: IdDisplayMap,
  fallback = 'Không xác định',
): { label: string; sublabel?: string; resolved: boolean } {
  if (!id) return { label: fallback, resolved: false };
  const entry = map[id];
  if (entry) return { ...entry, resolved: true };
  return { label: fallback, resolved: false };
}

/**
 * Inline component: hiển thị tên/email thay vì UUID.
 * Khi hover, tooltip hiện UUID gốc cho mục đích debug.
 */
export function IdDisplay({
  id,
  map,
  fallback = 'Không xác định',
  className,
}: {
  id: string | null | undefined;
  map: IdDisplayMap;
  fallback?: string;
  className?: string;
}) {
  const { label, sublabel, resolved } = resolveId(id, map, fallback);

  return (
    <span
      title={id ?? undefined}
      className={className}
      style={!resolved ? { fontStyle: 'italic', opacity: 0.6 } : undefined}
    >
      {label}
      {sublabel && <span className="text-slate-400 ml-1 text-xs">({sublabel})</span>}
    </span>
  );
}

/**
 * Helper: Tạo IdDisplayMap từ danh sách User
 */
export function buildUserMap(
  users: Array<{ id: string; email: string; fullName?: string | null; role?: string }>,
): IdDisplayMap {
  const map: IdDisplayMap = {};
  for (const u of users) {
    map[u.id] = {
      label: u.fullName || u.email,
      sublabel: u.fullName ? u.email : undefined,
    };
  }
  return map;
}

/**
 * Helper: Tạo IdDisplayMap từ danh sách Asset
 */
export function buildAssetMap(
  assets: Array<{ id: string; code: string; name: string }>,
): IdDisplayMap {
  const map: IdDisplayMap = {};
  for (const a of assets) {
    map[a.id] = {
      label: `${a.code} — ${a.name}`,
    };
  }
  return map;
}
