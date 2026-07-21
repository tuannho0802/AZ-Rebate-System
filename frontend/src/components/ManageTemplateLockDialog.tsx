'use client';

import { useState } from 'react';
import { Template, lockTemplate, unlockTemplate } from '../lib/api/template';
import { User } from '../lib/api/user';
import { Dialog, FormError } from './ui/Dialog';
import { Button, Field } from './ui/primitives';
import SearchableSelect from './ui/SearchableSelect';

interface ManageTemplateLockDialogProps {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  directChildren: User[];
}

/**
 * ManageTemplateLockDialog — Dialog Lock / Unlock Template cho con trực tiếp.
 * API: lockTemplate(templateId, userId), unlockTemplate(templateId, userId).
 * Rule: Chỉ cha TRỰC TIẾP mới lock/unlock được cho con trực tiếp của mình.
 */
export default function ManageTemplateLockDialog({
  open,
  onClose,
  templates,
  directChildren,
}: ManageTemplateLockDialogProps) {
  const [templateId, setTemplateId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAction = async (action: 'lock' | 'unlock') => {
    if (!templateId || !targetUserId) {
      setError('Vui lòng chọn Template và Con trực tiếp');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (action === 'lock') {
        await lockTemplate(templateId, targetUserId);
        setSuccessMessage('Đã KHOÁ Template thành công cho user được chọn.');
      } else {
        await unlockTemplate(templateId, targetUserId);
        setSuccessMessage('Đã MỞ KHOÁ Template thành công cho user được chọn.');
      }
    } catch (err: any) {
      setError(err?.body?.message || err?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Khóa / Mở khóa Template cho con"
      description="Khi bị Khóa, user được chọn sẽ KHÔNG thấy Template này trong danh sách áp dụng."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Đóng
          </Button>
          <Button
            variant="danger"
            onClick={() => handleAction('lock')}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : '🔒 Khóa Template'}
          </Button>
          <Button
            variant="success"
            onClick={() => handleAction('unlock')}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : '🔓 Mở khóa Template'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Template" required>
          <SearchableSelect
            options={templates.map((t) => ({
              id: t.id,
              label: t.name,
              sublabel: `${t.items?.length ?? 0} asset`,
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

        {successMessage && (
          <p className="text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            ✓ {successMessage}
          </p>
        )}
        <FormError>{error}</FormError>
      </div>
    </Dialog>
  );
}
