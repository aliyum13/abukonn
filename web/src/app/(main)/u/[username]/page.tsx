'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function UsernameRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const [notFound, setNotFound] = useState(false);
  const username = params.username as string;

  useEffect(() => {
    if (!token || !username) return;
    fetch(`${API_URL}/api/users/username/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json() as { id: number };
        router.replace(`/profile/${data.id}`);
      })
      .catch(() => setNotFound(true));
  }, [token, username, router]);

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="font-semibold text-ink">User not found</p>
        <p className="mt-1 text-body-sm text-ink-muted">@{username} doesn&apos;t exist or is unavailable.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Skeleton className="h-24 w-24 rounded-full mb-4" />
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
