'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface GroupPreview {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
  invite_code: string;
  invite_enabled: boolean;
  require_approval: boolean;
  is_member: boolean;
}

export default function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [result, setResult] = useState<{ pending?: boolean; already?: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push(`/login?redirect=/join/${inviteCode}`);
      return;
    }
    fetch(`${API_URL}/api/groups/join/${inviteCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.group) setGroup(d.group);
        else setError(d.message || 'Invalid invite link');
      })
      .catch(() => setError('Could not load group'))
      .finally(() => setPageLoading(false));
  }, [token, authLoading, inviteCode, router]);

  const handleJoin = async () => {
    if (!token || !group) return;
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/groups/join/${inviteCode}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { message?: string; pending?: boolean; already_member?: boolean; group?: GroupPreview };
      if (!res.ok) throw new Error(data.message || 'Failed to join');
      setResult({ pending: data.pending, already: data.already_member });
      if (data.group) setGroup(data.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted dark:bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        {pageLoading ? (
          <Card>
            <CardContent className="p-8 space-y-4">
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </CardContent>
          </Card>
        ) : error && !group ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-2xl mb-3">🔗</p>
              <h2 className="font-semibold text-ink">Link expired or invalid</h2>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
              <Link href="/messages" className="mt-4 block">
                <Button variant="outline" fullWidth>Go to messages</Button>
              </Link>
            </CardContent>
          </Card>
        ) : group ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-2xl mx-auto">
                💬
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">{group.name}</h2>
                {group.description && (
                  <p className="mt-1 text-sm text-ink-muted">{group.description}</p>
                )}
                <p className="mt-1 text-sm text-ink-muted">{group.member_count} member{group.member_count !== 1 ? 's' : ''}</p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              {result?.already || group.is_member ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-brand-600">You are already a member of this group.</p>
                  <Link href="/messages">
                    <Button fullWidth>Open in Messages</Button>
                  </Link>
                </div>
              ) : result?.pending ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-amber-600">Your request to join is pending admin approval.</p>
                  <Link href="/messages">
                    <Button variant="outline" fullWidth>Back to Messages</Button>
                  </Link>
                </div>
              ) : result ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-brand-600">You joined the group!</p>
                  <Link href="/messages">
                    <Button fullWidth>Open in Messages</Button>
                  </Link>
                </div>
              ) : (
                <Button
                  fullWidth
                  loading={joining}
                  onClick={handleJoin}
                >
                  {group.require_approval ? 'Request to Join' : 'Join Group'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
