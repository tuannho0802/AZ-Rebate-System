'use client';

import CommissionManager from '../../../components/CommissionManager';
import { PageShell, PageBody } from '../../../components/ui/primitives';

export default function MibConfigPage() {
  return (
    <PageShell>
      <PageBody>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Commission Configs</h1>
          <p className="text-sm text-slate-500">Quản lý MaxPips và tài khoản con trực tiếp của bạn.</p>
        </div>
        <CommissionManager />
      </PageBody>
    </PageShell>
  );
}
