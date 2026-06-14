'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(token ? '/feed' : '/login');
    }
  }, [loading, token, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400">Redirecting...</div>
    </div>
  );
}
