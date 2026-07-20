import { api } from '../api-client';

export type AssetCategory = 'FOREX' | 'METAL' | 'ENERGY' | 'COMMODITY' | 'INDEX' | 'SHARES' | 'CRYPTO' | 'OTHER';

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: AssetCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  templateItems?: unknown[];
}

export interface CreateAssetDto {
  code: string;
  name: string;
  category: AssetCategory;
}

export interface UpdateAssetDto {
  code?: string;
  name?: string;
  category?: AssetCategory;
  isActive?: boolean;
}

export async function listAssets(): Promise<Asset[]> {
  return api.get<Asset[]>('/admin/assets');
}

export async function createAsset(dto: CreateAssetDto): Promise<Asset> {
  return api.post<Asset>('/admin/assets', dto);
}

export async function updateAsset(id: string, dto: UpdateAssetDto): Promise<Asset> {
  return api.patch<Asset>(`/admin/assets/${id}`, dto);
}

export async function deleteAsset(id: string): Promise<void> {
  await api.delete(`/admin/assets/${id}`);
}

// ============================================================================
// User API
// ============================================================================

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'MIB' | 'IB';
  parentId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  fullName?: string;
  role: 'MIB' | 'IB';
  parentId?: string;
}

// GET /users tra ve mang User[] thang, KHONG co total/page/limit trong response
// (da xac nhan qua test-flow03-users.js goi API that - xem log ngay 20/7/2026)
export async function listUsers(params?: { page?: number; limit?: number; parentId?: string; sort?: string }): Promise<User[]> {
  const url = params
    ? `/users?page=${params.page ?? 1}&limit=${params.limit ?? 20}${params.parentId ? `&parentId=${params.parentId}` : ''}${params.sort ? `&sort=${params.sort}` : ''}`
    : '/users';
  return api.get<User[]>(url);
}

export async function createUser(dto: CreateUserDto): Promise<User> {
  return api.post<User>('/admin/users', dto);
}