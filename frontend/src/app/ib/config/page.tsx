'use client';

import CommissionManager from '../../../components/CommissionManager';
import { PageShell, PageBody } from '../../../components/ui/primitives';

export default function IbConfigPage() {
  return (
    <PageShell>
      <PageBody>
        <CommissionManager />
      </PageBody>
    </PageShell>
  );
}
