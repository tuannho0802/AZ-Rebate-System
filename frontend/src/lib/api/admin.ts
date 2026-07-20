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
