'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IbPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ib/config');
  }, [router]);

  return null;
}
