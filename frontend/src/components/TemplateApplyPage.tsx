'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Template, listVisibleTemplates, applyTemplate } from '@/lib/api/template';
import { User, listUsers } from '@/lib/api/user';
import { PageShell, PageBody, Card, Field, Button, EmptyState, Badge } from '@/components/ui/primitives';
import { FormError } from '@/components/ui/Dialog';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function TemplateApplyPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [directChildren, setDirectChildren] = useState<User[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
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
  }, [user, isLoading, router]);

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

  if (isLoading) return null;
  if (!user || user.type === 'admin') return null;

  return (
    <PageShell>
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Overview Direct Children List */}
        <div className="lg:col-span-1">
          <Card title="Danh sách con trực tiếp" description="Bấm chọn một user để áp dụng template.">
            {directChildren.length === 0 ? (
              <EmptyState title="Chưa có con trực tiếp nào" />
            ) : (
              <div className="space-y-2">
                {directChildren.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTargetUserId(c.id)}
                    className={
                      'w-full text-left px-4 py-3 rounded-lg border transition-all ' +
                      (targetUserId === c.id
                        ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50')
                    }
                  >
                    <div className="font-semibold text-slate-800 text-sm truncate">
                      {c.fullName || c.email}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate">{c.email}</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge tone={c.isActive ? 'emerald' : 'slate'} className="text-[10px] px-1.5 py-0.5">
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-[10px] text-slate-400">cấp {c.level}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Form selection & apply */}
        <div className="lg:col-span-2">
          <Card title="Cấu hình áp dụng" description="Chọn template tương ứng để áp cấu hình cho user đang chọn.">
            {targetUserId ? (
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
                <FormError>{error}</FormError>

                <Button type="submit" variant="success" disabled={loading} className="mt-2">
                  {loading ? 'Đang áp dụng...' : 'Áp dụng Template'}
                </Button>
              </form>
            ) : (
              <EmptyState title="Chưa chọn tài khoản con" description="Vui lòng bấm chọn một tài khoản con ở danh sách bên trái để tiến hành áp dụng template." />
            )}
          </Card>
        </div>
        </div>
      </PageBody>
    </PageShell>
  );
}
