import { api } from '../api-client';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'MIB' | 'IB';
  parentId?: string;
  isActive: boolean;
  createdAt: string;
  level: number; // Thêm level để chuẩn hóa
}

export interface CreateUserDto {
  email: string;
  password: string;
  fullName?: string;
  role: 'MIB' | 'IB';
  parentId?: string;
}

export interface CreateDirectChildDto {
  email: string;
  password: string;
  fullName?: string;
  parentId: string; // bắt buộc đối với IB/MIB khi tự tạo con
}

export interface UpdateUserDto {
  fullName?: string;
  isActive?: boolean;
}

export interface SubtreeNode {
  id: string;
  depth: number;
}

export async function listUsers(params?: { page?: number; limit?: number; parentId?: string; sort?: string }): Promise<User[]> {
  const url = params
    ? `/users?page=${params.page ?? 1}&limit=${params.limit ?? 20}${params.parentId ? `&parentId=${params.parentId}` : ''}${params.sort ? `&sort=${params.sort}` : ''}`
    : '/users';
  return api.get<User[]>(url);
}

// Admin create user
export async function createUser(dto: CreateUserDto): Promise<User> {
  return api.post<User>('/admin/users', dto);
}

// GET /users/:id
export async function getUser(id: string): Promise<User> {
  return api.get<User>(`/users/${id}`);
}

// PATCH /users/:id
export async function updateUser(id: string, dto: UpdateUserDto): Promise<User> {
  return api.patch<User>(`/users/${id}`, dto);
}

// GET /users/:id/subtree
export async function getSubtree(id: string): Promise<SubtreeNode[]> {
  return api.get<SubtreeNode[]>(`/users/${id}/subtree`);
}

// IB/MIB tự tạo con trực tiếp (POST /users)
export async function createDirectChild(dto: CreateDirectChildDto): Promise<User> {
  return api.post<User>('/users', dto);
}
