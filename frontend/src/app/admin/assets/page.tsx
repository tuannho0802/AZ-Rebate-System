'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { Asset, listAssets, createAsset, updateAsset, deleteAsset } from '../../../lib/api/admin';
import AssetTable from '../../../components/AssetTable';
import AssetFormDialog from '../../../components/AssetFormDialog';
import { PageShell, PageBody, Card, Button } from '../../../components/ui/primitives';

export default function AdminAssetsPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isLoadingSave, setIsLoadingSave] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'admin') {
      router.push(user.role === 'MIB' ? '/mib' : '/ib');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !user || user.type !== 'admin') return;
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  const loadAssets = async () => {
    try {
      const data = await listAssets();
      setAssets(data);
    } catch (error: any) {
      console.error('Failed to load assets:', error);
    }
  };

  const handleCreate = async (dto: any) => {
    setIsLoadingSave(true);
    try {
      await createAsset(dto);
      await loadAssets();
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handleUpdate = async (dto: any) => {
    setIsLoadingSave(true);
    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, dto);
        await loadAssets();
      }
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Xoá asset "${asset.code}"?`)) return;
    try {
      await deleteAsset(asset.id);
      await loadAssets();
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`);
    }
  };

  const openCreateDialog = () => {
    setDialogMode('create');
    setEditingAsset(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setDialogMode('edit');
    setEditingAsset(asset);
    setIsDialogOpen(true);
  };

  const handleSave = async (dto: any) => {
    if (dialogMode === 'create') {
      await handleCreate(dto);
    } else if (editingAsset) {
      await handleUpdate(dto);
    }
    setIsDialogOpen(false);
  };

  if (isLoading) return null;
  if (!user || user.type !== 'admin') return null;

  return (
    <PageShell>


      <PageBody>
        <Card
          title="Danh sách Asset"
          description={`${assets.length} asset trong hệ thống`}
          actions={
            <>
              <Button variant="secondary" onClick={loadAssets}>
                ↻ Refresh
              </Button>
              <Button onClick={openCreateDialog}>+ Tạo Asset mới</Button>
            </>
          }
        >
          <AssetTable assets={assets} onEditName={openEditDialog} onToggleActive={openEditDialog} onDelete={handleDelete} />
        </Card>

        <AssetFormDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          mode={dialogMode}
          initialData={editingAsset || undefined}
          onSave={handleSave}
          isLoading={isLoadingSave}
        />
      </PageBody>
    </PageShell>
  );
}
