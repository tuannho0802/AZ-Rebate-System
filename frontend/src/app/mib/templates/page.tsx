'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/auth-context';
import { Template, listVisibleTemplates, applyTemplate } from '../../../lib/api/template';
import { User, listUsers } from '../../../lib/api/user';
import { Card, Field, Button } from '../../../components/ui/primitives';
import { FormError } from '../../../components/ui/Dialog';
import SearchableSelect from '../../../components/ui/SearchableSelect';

export default function MibTemplatesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [directChildren, setDirectChildren] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.type !== 'user') {
      router.push('/admin');
      return;
    }

    listVisibleTemplates()
      .then(setTemplates)
      .catch((err) => setTemplatesError(err.message || 'Không thể tải templates'));

    listUsers({ parentId: user.sub, limit: 100 })
      .then(setDirectChildren)
      .catch(console.error);
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId || !targetUserId) {
      setError('Vui lòng chọn Template và User (con trực tiếp)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const applied = await applyTemplate(templateId, targetUserId);
      alert(`Áp dụng Template thành công cho ${applied.length} asset!`);
      setTemplateId('');
      setTargetUserId('');
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Áp dụng thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.type === 'admin') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Template Apply</h1>
        <p className="text-sm text-slate-500">Áp dụng một template cấu hình hoa hồng cho con trực tiếp của bạn.</p>
      </div>

      <Card title="Cấu hình áp dụng" description="Chọn template và tài khoản con trực tiếp của bạn để thực hiện.">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          {templatesError && (
            <p className="text-sm text-rose-600">
              Không tải được danh sách Template ({templatesError}) — vui lòng kiểm tra lại quyền truy cập.
            </p>
          )}
          <Field label="Template" required>
            <SearchableSelect
              options={[...templates]
                .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                .map((t) => ({
                  id: t.id,
                  label: t.name,
                  sublabel: `${t.items?.length ?? 0} asset`,
                  ...(t.level !== undefined && t.level !== null ? { tag: `Cấp ${t.level}` } : {}),
                }))}
              value={templateId}
              onChange={setTemplateId}
              placeholder="Chọn Template..."
            />
          </Field>
          <Field label="Con trực tiếp" required>
            <SearchableSelect
              options={directChildren.map((c) => ({
                id: c.id,
                label: c.fullName ? `${c.fullName} (${c.email})` : c.email,
                sublabel: c.email,
              }))}
              value={targetUserId}
              onChange={setTargetUserId}
              placeholder="Chọn con trực tiếp..."
            />
          </Field>
          <FormError>{error}</FormError>

          <Button type="submit" variant="success" disabled={loading} className="mt-2">
            {loading ? 'Đang áp dụng...' : 'Áp dụng Template'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
