// MOCK — backend chưa có GET/PATCH/DELETE /admin/assets
// MOCK — backend chưa có GET/PATCH/DELETE /admin/templates

const ASSETS_KEY = 'mock:assets';
const TEMPLATES_KEY = 'mock:templates';

export interface MockAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

export interface MockTemplate {
  id: string;
  name: string;
  description?: string;
  items: Array<{
    assetId: string;
    rebateUnit: number;
    markupPips: number;
  }>;
  createdAt: string;
}

function load<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Asset mocks
export function getMockAssets(): MockAsset[] {
  return load<MockAsset>(ASSETS_KEY);
}

export function addMockAsset(asset: MockAsset): void {
  const assets = getMockAssets();
  assets.push({ ...asset, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  save(ASSETS_KEY, assets);
}

export function updateMockAsset(id: string, updates: Partial<MockAsset>): void {
  const assets = getMockAssets();
  const idx = assets.findIndex((a) => a.id === id);
  if (idx !== -1) {
    assets[idx] = { ...assets[idx], ...updates };
    save(ASSETS_KEY, assets);
  }
}

export function deleteMockAsset(id: string): void {
  const assets = getMockAssets();
  save(ASSETS_KEY, assets.filter((a) => a.id !== id));
}

// Template mocks
export function getMockTemplates(): MockTemplate[] {
  return load<MockTemplate>(TEMPLATES_KEY);
}

export function addMockTemplate(template: MockTemplate): void {
  const templates = getMockTemplates();
  templates.push({ ...template, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  save(TEMPLATES_KEY, templates);
}

export function updateMockTemplate(id: string, updates: Partial<MockTemplate>): void {
  const templates = getMockTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    templates[idx] = { ...templates[idx], ...updates };
    save(TEMPLATES_KEY, templates);
  }
}

export function deleteMockTemplate(id: string): void {
  const templates = getMockTemplates();
  save(TEMPLATES_KEY, templates.filter((t) => t.id !== id));
}

// Reset mock data
export function resetMockStore(): void {
  localStorage.removeItem(ASSETS_KEY);
  localStorage.removeItem(TEMPLATES_KEY);
}
