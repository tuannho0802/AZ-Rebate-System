'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MibPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/mib/config');
  }, [router]);

  return null;
}