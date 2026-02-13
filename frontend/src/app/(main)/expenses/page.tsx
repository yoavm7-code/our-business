'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function ExpensesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/income?tab=expenses'); }, [router]);
  return null;
}
