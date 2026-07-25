'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Shareable profile links: abukonn.com/u/<username> (a leading @ is accepted and
 * stripped, so /u/@name works too). Resolves the username to a user id via the
 * PUBLIC resolver, then forwards to the profile page.
 *
 * Deliberately does NOT require a login token — a shared link has to open for
 * anyone. (It used to early-return unless a token was present, so logged-out
 * visitors clicking a shared link just saw an endless skeleton.)
 */
export default function UsernameRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const raw = (params.username as string) || '';
  const username = decodeURIComponent(raw).replace(/^@/, '').trim();

  useEffect(() => {
    if (!username) { setNotFound(true); return; }
    let cancelled = false;
    fetch(`${API_URL}/api/users/username/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) { setNotFound(true); return; }
        const data = (await res.json()) as { id: number };
        if (data?.id) router.replace(`/profile/${data.id}`);
        else setNotFound(true);
      })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [username, router]);

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="font-semibold text-ink">User not found</p>
        <p className="mt-1 text-body-sm text-ink-muted">@{username} doesn&apos;t exist or is unavailable.</p>
        <a href="/feed" className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-body-sm font-semibold text-white">Go to feed</a>
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
