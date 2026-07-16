const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function apiCall<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  const token = typeof window !== 'undefined' ? document.cookie.match(/(^| )token=([^;]+)/)?.[2] : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorBody: any = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { message: response.statusText };
    }
    const error = new Error(errorBody.message || 'API error') as Error & { status?: number; body?: any };
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, init?: RequestOptions) => apiCall<T>(endpoint, { ...init, method: 'GET' }),
  post: <T>(endpoint: string, body?: any, init?: RequestOptions) => apiCall<T>(endpoint, { ...init, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: any, init?: RequestOptions) => apiCall<T>(endpoint, { ...init, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string, init?: RequestOptions) => apiCall<T>(endpoint, { ...init, method: 'DELETE' }),
};
