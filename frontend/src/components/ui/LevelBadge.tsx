'use client';

import { Badge } from './primitives';

/**
 * LevelBadge — hiển thị tag cấp của Template (Cấp 0, Cấp 1, Cấp 2...)
 * 0: dành cho MIB (root) cấp cho Lv1 IB
 * 1: dành cho Lv1 IB cấp cho Lv2 IB
 * ...
 */
export function LevelBadge({ level }: { level: number }) {
  const tones: Record<number, 'indigo' | 'blue' | 'teal' | 'slate'> = {
    0: 'indigo',
    1: 'blue',
    2: 'teal',
  };
  const tone = tones[level] ?? 'slate';

  return (
    <Badge tone={tone} className="font-semibold">
      Cấp {level}
    </Badge>
  );
}
