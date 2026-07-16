import { jwtDecode } from 'jwt-decode';
export interface JwtPayload {
  sub: string;
  email: string;
  type: 'admin' | 'user';
  role?: 'MIB' | 'IB';
}

export function decodeToken(token: string): JwtPayload {
  return jwtDecode(token);
}

export function getTokenFromStorage(): string | null {
  const cookieValue = document.cookie.match(/(^| )token=([^;]+)/);
  return cookieValue ? cookieValue[2] : null;
}

export function setTokenInCookie(token: string, expires: Date): void {
  document.cookie = `token=${token}; path=/; expires=${expires.toUTCString()}`;
}

export function clearTokenFromCookie(): void {
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
}
