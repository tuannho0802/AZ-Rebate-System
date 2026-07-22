'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { User, listUsers, updateUser } from '../lib/api/user';
import { Asset, listAssets } from '../lib/api/admin';
import {
  getConfigChildren,
  setConfigTotal,
  updateConfigTotal,
  CommissionConfigSelf,
  CommissionConfigChild,
} from '../lib/api/commission-config';
import { Card, Field, Input, Select, Button, Badge } from './ui/primitives';
import { FormError } from './ui/Dialog';

export default function UserDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const targetUserId = params?.userId as string;

  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Section Account State
  const [fullName, setFullName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Section Asset Commission State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selfInfo, setSelfInfo] = useState<CommissionConfigSelf | null>(null);
  const [childConfig, setChildConfig] = useState<CommissionConfigChild | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [transferUnit, setTransferUnit] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const rolePath = user?.role === 'MIB' ? 'mib' : 'ib';

  // Load user info, verify authorization and load assets
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
      return;
    }

    setLoadingUser(true);
    listUsers({ parentId: user.sub, limit: 100 })
      .then((users) => {
        const found = users.find((u) => u.id === targetUserId);
        if (found) {
          setTargetUser(found);
          setFullName(found.fullName ?? '');
          setIsActive(found.isActive);
        } else {
          setAccountError('Tài khoản con không tồn tại hoặc không thuộc quyền quản lý của bạn.');
        }
      })
      .catch((err) => setAccountError(err.message))
      .finally(() => setLoadingUser(false));

    listAssets()
      .then((res) => {
        setAssets(res || []);
        if (res && res.length > 0) {
          setSelectedAssetId(res[0].id);
        }
      })
      .catch(console.error);
  }, [user, targetUserId, router]);

  // Load config & cap for selected asset
  useEffect(() => {
    if (!user || !targetUserId || !selectedAssetId) return;

    const loadConfig = async () => {
      setLoadingConfig(true);
      setConfigError(null);
      try {
        const data = await getConfigChildren(user.sub, selectedAssetId);
        setSelfInfo(data.self);
        const config = data.children.find((c) => c.userId === targetUserId) || null;
        setChildConfig(config);
        setTransferUnit(config?.transferUnit != null ? String(config.transferUnit) : '');
      } catch (err: any) {
        setConfigError(err?.message || 'Không thể tải cấu hình asset');
      } finally {
        setLoadingConfig(false);
      }
    };

    loadConfig();
  }, [user, targetUserId, selectedAssetId]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setSavingAccount(true);
    setAccountError(null);
    try {
      await updateUser(targetUser.id, { fullName, isActive });
      alert('Cập nhật tài khoản thành công!');
    } catch (err: any) {
      setAccountError(err?.body?.message || err?.message || 'Lỗi cập nhật tài khoản');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !selectedAssetId) return;
    setSavingConfig(true);
    setConfigError(null);
    try {
      const value = parseFloat(transferUnit) || 0;
      if (childConfig?.version != null) {
        await updateConfigTotal(targetUser.id, selectedAssetId, {
          transferUnit: value,
          version: childConfig.version,
        });
      } else {
        await setConfigTotal({
          userId: targetUser.id,
          assetId: selectedAssetId,
          transferUnit: value,
        });
      }
      alert('Cập nhật MaxPips thành công!');
      // Reload config state to refresh version
      const data = await getConfigChildren(user!.sub, selectedAssetId);
      const config = data.children.find((c) => c.userId === targetUserId) || null;
      setChildConfig(config);
    } catch (err: any) {
      if (err.status === 409) {
        setConfigError('Dữ liệu đã bị thay đổi bởi người khác. Vui lòng chọn lại asset hoặc tải lại trang để lấy version mới.');
      } else {
        setConfigError(err?.body?.message || err?.message || 'Lỗi cập nhật cấu hình');
      }
    } finally {
      setSavingConfig(false);
    }
  };

  if (!user || !targetUserId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Chi tiết tài khoản con</h1>
          <p className="text-sm text-slate-500">Xem và cấu hình thông tin cho: {targetUser?.email || '...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.push(`/${rolePath}/config/${targetUserId}/assets`)}>
            Cấu hình nhiều Asset
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/${rolePath}/config`)}>
            Quay lại danh sách
          </Button>
        </div>
      </div>

      {loadingUser ? (
        <div className="py-8 text-center text-sm text-slate-400">Đang tải thông tin tài khoản...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section: Sửa Tài Khoản */}
          <Card title="Thông tin tài khoản" description="Cập nhật họ tên hoặc trạng thái kích hoạt của tài khoản con.">
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <Field label="Email">
                <Input value={targetUser?.email || ''} readOnly disabled />
              </Field>
              <Field label="Họ tên">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={savingAccount} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 select-none py-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={savingAccount}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Tài khoản đang hoạt động
              </label>

              <FormError>{accountError}</FormError>

              <Button type="submit" variant="success" disabled={savingAccount} className="w-full justify-center">
                {savingAccount ? 'Đang lưu...' : 'Cập nhật thông tin'}
              </Button>
            </form>
          </Card>

          {/* Section: Cấu hình Commission 1 Asset */}
          <Card title="Cấu hình Asset đơn lẻ" description="Cập nhật MaxPips cho một asset được chọn cụ thể.">
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <Field label="Chọn Asset">
                <Select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.name})
                    </option>
                  ))}
                </Select>
              </Field>

              {loadingConfig ? (
                <div className="py-4 text-center text-xs text-slate-400">Đang tải cấu hình asset...</div>
              ) : (
                <>
                  {selfInfo && (
                    <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 flex items-center justify-between">
                      <span>Trần của bạn (MaxPips):</span>
                      <span className="font-semibold text-slate-700">{selfInfo.transferUnit ?? 'Chưa set'}</span>
                    </div>
                  )}

                  <Field label="MaxPips (tổng nhận)" required>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={transferUnit}
                      onChange={(e) => setTransferUnit(e.target.value)}
                      placeholder={childConfig?.transferUnit != null ? String(childConfig.transferUnit) : 'Chưa thiết lập'}
                      disabled={savingConfig}
                      required
                    />
                  </Field>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    Trạng thái:
                    {childConfig?.version != null ? (
                      <Badge tone="indigo">Đã có cấu hình (phiên bản {childConfig.version})</Badge>
                    ) : (
                      <Badge tone="slate">Chưa có cấu hình (tạo mới)</Badge>
                    )}
                  </div>
                </>
              )}

              <FormError>{configError}</FormError>

              <Button
                type="submit"
                variant="success"
                disabled={savingConfig || loadingConfig}
                className="w-full justify-center"
              >
                {savingConfig ? 'Đang lưu...' : childConfig?.version != null ? 'Cập nhật MaxPips' : 'Tạo cấu hình mới'}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
