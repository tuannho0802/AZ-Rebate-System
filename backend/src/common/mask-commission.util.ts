/**
 * Loại bỏ rebateUnit + markupPips khỏi response trả cho non-admin,
 * thay bằng 1 con số tổng duy nhất: maxPips = rebateUnit + markupPips.
 *
 * Admin luôn thấy đầy đủ cả 2 field gốc — hàm trả về object nguyên vẹn.
 */
export function maskConfigForActor<
  T extends { rebateUnit: any; markupPips: any },
>(cfg: T, actor: { type: 'ADMIN' | 'USER' }): any {
  if (actor.type === 'ADMIN') return cfg;
  const { rebateUnit, markupPips, ...rest } = cfg;
  return { ...rest, maxPips: Number(rebateUnit) + Number(markupPips) };
}
