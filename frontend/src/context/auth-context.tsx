'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { decodeToken, JwtPayload, getTokenFromStorage, setTokenInCookie, clearTokenFromCookie } from '../lib/jwt';
import { api } from '../lib/api-client';

interface AuthContextType {
  user: JwtPayload | null;
  login: (email: string, password: string, type: 'admin' | 'user') => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in via cookie
    const storedToken = getTokenFromStorage();
    if (storedToken) {
      try {
        const decoded = decodeToken(storedToken);
        setUser(decoded);
      } catch {
        clearTokenFromCookie();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, type: 'admin' | 'user') => {
    setIsLoading(true);
    try {
      const endpoint = type === 'admin' ? '/auth/admin/login' : '/auth/user/login';
      const response: { accessToken: string } = await api.post(endpoint, { email, password });
      
      const decoded = decodeToken(response.accessToken);
      setUser(decoded);
      
      // Set cookie expires in 1 day
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setTokenInCookie(response.accessToken, expires);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    clearTokenFromCookie();
    // Redirect immediately to clear all context state and avoid page hangs
    window.location.href = '/login';
  };

  return (
    <AuthContext value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
