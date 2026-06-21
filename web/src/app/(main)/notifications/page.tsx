'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Button, Card, CardContent, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type NotifType = 'like' | 'comment' | 'follow' | 'connect_request' | 'connect_accepted';

interface Actor {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
}

interface GroupedNotification {
  id: string;
  notification_ids: number[];
  type: NotifType;
  post_id: number | null;
  actors: Actor[];
  actor_count: number;
  is_read: boolean;
  latest_at: string;
}

function notifVerb(type: NotifType): string {
  if (type === 'like') return 'liked your post';
  if (type === 'comment') return 'commented on your post';
  if (type === 'follow') return 'started following you';
  if (type === 'connect_request') return 'sent you a connect request';
  if (type === 'connect_accepted') return 'accepted your connect request';
  return 'interacted with you';
}

function notifHref(n: GroupedNotification): string {
  if (n.type === 'connect_request') return '/connect/requests';
  if (n.type === 'follow' || n.type === 'connect_accepted') return `/profile/${n.actors[0]?.id ?? ''}`;
  if (n.post_id) return `/post/${n.post_id}`;
  return '/feed';
}

function NotifIcon({ type }: { type: NotifType }) {
  if (type === 'like') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      </span>
    );
  }
  if (type === 'comment') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
        </svg>
      </span>
    );
  }
  if (type === 'follow') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    </span>
  );
}

function ActorAvatars({ actors, actorCount }: { actors: Actor[]; actorCount: number }) {
  const shown = actors.slice(0, 2);
  const extra = actorCount - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((a, i) => (
        <Avatar
          key={a.id}
          src={a.profile_photo_url}
          name={a.full_name}
          size="md"
          className={cn('ring-2 ring-white dark:ring-[#0a0a0a]', i > 0 && '-ml-3')}
        />
      ))}
      {extra > 0 && (
        <div className={cn(
          '-ml-3 flex h-10 w-10 items-center justify-center rounded-full',
          'bg-surface-muted text-[11px] font-semibold text-ink-muted',
          'ring-2 ring-white dark:ring-[#0a0a0a] dark:bg-[#1a1a1a]'
        )}>
          +{extra}
        </div>
      )}
    </div>
  );
}

function NotifSkeleton() {
  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<GroupedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (token) fetchNotifications();
  }, [token, fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!token) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) fetchNotifications();
    } catch {
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotifClick = async (n: GroupedNotification) => {
    if (!token) return;
    if (!n.is_read) {
      setNotifications(prev => prev.map(g => g.id === n.id ? { ...g, is_read: true } : g));
      fetch(`${API_URL}/api/notifications/read-many`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: n.notification_ids }),
      }).catch(() => {});
    }
    router.push(notifHref(n));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (authLoading) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Notifications</h1>
          {!loading && unreadCount > 0 && (
            <p className="mt-0.5 text-body-sm text-ink-muted">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} loading={markingAll}>
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="divide-y divide-border">
            <NotifSkeleton /><NotifSkeleton /><NotifSkeleton /><NotifSkeleton />
          </div>
        ) : notifications.length === 0 ? (
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
              <svg className="h-8 w-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h3 className="font-semibold text-ink">No notifications yet</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              When someone likes your post, comments, or follows you, it will appear here.
            </p>
            <Link href="/feed" className="mt-4">
              <Button variant="outline" size="sm">Go to feed</Button>
            </Link>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotifClick(n)}
                className={cn(
                  'flex w-full items-start gap-4 px-6 py-4 text-left transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]',
                  !n.is_read && 'bg-brand-50/60 dark:bg-brand-950/20'
                )}
              >
                {/* Stacked avatars with type icon overlay */}
                <div className="relative shrink-0">
                  <ActorAvatars actors={n.actors} actorCount={n.actor_count} />
                  <div className="absolute -bottom-1 -right-1">
                    <NotifIcon type={n.type} />
                  </div>
                </div>

                {/* Message */}
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm text-ink leading-snug">
                    {n.actor_count === 1 ? (
                      <>
                        <span className="font-semibold">{n.actors[0]?.full_name}</span>
                        {' '}{notifVerb(n.type)}
                      </>
                    ) : n.actor_count === 2 ? (
                      <>
                        <span className="font-semibold">{n.actors[0]?.full_name}</span>
                        {' and '}
                        <span className="font-semibold">{n.actors[1]?.full_name}</span>
                        {' '}{notifVerb(n.type)}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{n.actors[0]?.full_name}</span>
                        {', '}
                        <span className="font-semibold">{n.actors[1]?.full_name}</span>
                        {' and '}
                        {n.actor_count - 2}{' other'}{n.actor_count - 2 > 1 ? 's' : ''}
                        {' '}{notifVerb(n.type)}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">{timeAgo(n.latest_at)}</p>
                </div>

                {/* Unread dot */}
                {!n.is_read && (
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
