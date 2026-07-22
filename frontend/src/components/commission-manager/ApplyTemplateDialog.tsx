'use client';

import { useState } from 'react';
import { Template } from '../../lib/api/template';
import { User } from '../../lib/api/user';
import { Dialog, FormError } from '../ui/Dialog';
import { Button, Field } from '../ui/primitives';
import SearchableSelect from '../ui/SearchableSelect';

export interface ApplyTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  templatesError: string | null;
  directChildren: User[];
  onApply: (templateId: string, targetUserId: string) => Promise<number>;
}

export default function ApplyTemplateDialog({
  open,
  onClose,
  templates,
  templatesError,
  directChildren,
  onApply,
}: ApplyTemplateDialogProps) {
  const [templateId, setTemplateId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!templateId || !targetUserId) {
      setError('Vui lòng chọn Template và User (con trực tiếp)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const count = await onApply(templateId, targetUserId);
      alert(`Áp dụng Template thành công cho ${count} asset!`);
      setTemplateId('');
      setTargetUserId('');
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Áp dụng thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Áp dụng Template cho con trực tiếp"
      description="Chạy trong 1 transaction ở backend — nếu 1 asset vượt cap, toàn bộ request rollback."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Đóng
          </Button>
          <Button variant="success" onClick={submit} disabled={loading}>
            {loading ? 'Đang áp dụng...' : 'Áp dụng Template'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {templatesError && (
          <p className="text-sm text-rose-600">
            Không tải được danh sách Template ({templatesError}) — có thể route <code>/admin/templates</code> đang
            chặn non-Admin.
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
      </div>
    </Dialog>
  );
}
