'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { optimizedImage } from '@/lib/image';
import ReportModal from '@/components/ReportModal';
import { cn } from '@/lib/utils';
import { useFollow } from '@/hooks/useFollow';
import { Avatar, Button, Skeleton, RoleBadge, usesFollowSystem, PostContent } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface UserProfile {
  id: number;
  full_name: string;
  username?: string;
  email: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  bio: string | null;
  is_admin?: boolean;
  role?: string;
  created_at: string;
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

interface Post {
  id: number;
  user_id: number;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  post_subtype?: 'post' | 'discussion' | 'poll' | 'question' | 'event';
  discussion_title?: string | null;
  poll_options?: Array<{ id: number; option_text: string; vote_count: number }> | null;
  voted_option_id?: number | null;
  event_title?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  event_rsvp_count?: number;
}

interface ProfileReply {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  post_content: string;
  post_subtype?: string;
  post_title?: string | null;
  post_author_name: string;
}

type TabType = 'posts' | 'replies';

type ConnectStatus =
  | { status: 'none' }
  | { status: 'pending'; request_id: number; initiated_by_me: boolean }
  | { status: 'connected' };

// ── Skeletons ──────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl bg-white dark:bg-[#0a0a0a]">
      <div className="h-12 border-b border-border" />
      <div className="px-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-24 w-24 shrink-0" rounded="full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="mt-5 flex gap-8 border-b border-border pb-4">
          <Skeleton className="h-10 w-14" />
          <Skeleton className="h-10 w-14" />
          <Skeleton className="h-10 w-14" />
        </div>
      </div>
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

// ── Follow button (for verified/BOD/Influencer/Admin profiles) ─────────────────

function FollowBtn({
  userId, initialIsFollowing, initialFollowersCount, token,
}: {
  userId: number; initialIsFollowing: boolean; initialFollowersCount: number; token: string | null;
}) {
  const { isFollowing, loading, toggle } = useFollow(userId, initialIsFollowing, initialFollowersCount, token);
  const [hovered, setHovered] = useState(false);

  // Notification bell — opt in to be notified of this person's posts, events
  // and stories. Only meaningful while following (the setting lives on the
  // follow relationship), so it's hidden otherwise.
  const [bellOn, setBellOn] = useState(false);
  const [bellBusy, setBellBusy] = useState(false);

  useEffect(() => {
    if (!token || !isFollowing) { setBellOn(false); return; }
    fetch(`${API_URL}/api/follows/${userId}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setBellOn(!!d.notify_on_post))
      .catch(() => {});
  }, [token, userId, isFollowing]);

  const toggleBell = async () => {
    if (!token || bellBusy) return;
    const next = !bellOn;
    setBellOn(next); // optimistic
    setBellBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/follows/${userId}/notifications`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setBellOn(!next); // revert
    } catch {
      setBellOn(!next);
    } finally {
      setBellBusy(false);
    }
  };

  const label = isFollowing
    ? (hovered ? 'Unfollow' : 'Following')
    : 'Follow';

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isFollowing ? 'outline' : 'primary'}
        size="sm"
        onClick={toggle}
        loading={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'rounded-full px-5 min-w-[90px] transition-colors',
          isFollowing && hovered
            ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
            : isFollowing
            ? 'border-border'
            : ''
        )}
      >
        {label}
      </Button>

      {isFollowing && (
        <button
          type="button"
          onClick={toggleBell}
          disabled={bellBusy}
          aria-label={bellOn ? 'Turn off post notifications' : 'Turn on post notifications'}
          title={bellOn ? 'You get notified about their posts' : 'Get notified about their posts'}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-60',
            bellOn
              ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400'
              : 'border-border text-ink-muted hover:text-ink'
          )}
        >
          {bellOn ? (
            // Bell with a check — notifications on
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a6 6 0 00-6 6v2.6c0 .5-.2 1-.5 1.4L4 14h16l-1.5-2a2.3 2.3 0 01-.5-1.4V8a6 6 0 00-6-6zM9.5 18a2.5 2.5 0 005 0h-5z" />
            </svg>
          ) : (
            // Outline bell — notifications off
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// ── Connect button (for regular user profiles) ─────────────────────────────────

function ConnectBtn({ targetId, token }: { targetId: number; token: string | null }) {
  const [status, setStatus] = useState<ConnectStatus>({ status: 'none' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !targetId) return;
    fetch(`${API_URL}/api/connect/${targetId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {});
  }, [token, targetId]);

  async function sendRequest() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/connect/${targetId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus({ status: 'pending', request_id: data.request.id, initiated_by_me: true });
      }
    } finally { setBusy(false); }
  }

  async function cancelRequest() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/connect/${targetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus({ status: 'none' });
    } finally { setBusy(false); }
  }

  async function acceptRequest() {
    if (!token || status.status !== 'pending') return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/connect/${status.request_id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus({ status: 'connected' });
    } finally { setBusy(false); }
  }

  async function declineRequest() {
    if (!token || status.status !== 'pending') return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/connect/${status.request_id}/decline`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus({ status: 'none' });
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/connect/${targetId}/remove`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus({ status: 'none' });
    } finally { setBusy(false); }
  }

  if (status.status === 'connected') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={disconnect}
        loading={busy}
        className="rounded-full px-5 border-brand-300 text-brand-700 hover:border-red-300 hover:text-red-600 dark:border-brand-700 dark:text-brand-400"
      >
        ✓ Connected
      </Button>
    );
  }

  if (status.status === 'pending' && status.initiated_by_me) {
    return (
      <Button variant="outline" size="sm" onClick={cancelRequest} loading={busy}
        className="rounded-full px-5 text-ink-muted hover:border-red-300 hover:text-red-600">
        Pending…
      </Button>
    );
  }

  if (status.status === 'pending' && !status.initiated_by_me) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={acceptRequest} loading={busy} className="rounded-full px-4">
          Accept
        </Button>
        <Button variant="outline" size="sm" onClick={declineRequest} disabled={busy}
          className="rounded-full px-4">
          Decline
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={sendRequest} loading={busy} className="rounded-full px-5">
      Connect
    </Button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const { token, user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<ProfileReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileReportOpen, setProfileReportOpen] = useState(false);
  const [profileBlockOpen, setProfileBlockOpen] = useState(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('posts');

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (currentUser && userId === String(currentUser.id)) router.replace('/profile');
  }, [currentUser, userId, router]);

  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        // Debug: log role to help diagnose Follow vs Connect display
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Profile] user data from API:', {
            id: data.user?.id,
            role: data.user?.role,
            is_admin: data.user?.is_admin,
          });
        }
        setProfile(data.user);
        setPosts(data.posts);
        setReplies(data.replies || []);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, userId]);

  if (authLoading || loading) return (<><ProfileSkeleton /><PostSkeleton /><PostSkeleton /></>);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <svg className="mx-auto mb-4 h-12 w-12 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <p className="font-semibold text-[16px] text-ink">User not found</p>
        <p className="mt-1 text-[14px] text-ink-muted">This profile doesn&apos;t exist or may have been removed.</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-5 rounded-full px-6" size="sm">
          ← Go back
        </Button>
      </div>
    );
  }

  if (!profile) return null;

  const displayUsername = profile.username || profile.email?.split('@')[0] || '';
  const profileRole = profile.role || (profile.is_admin ? 'admin' : 'user');
  const showFollowBtn = usesFollowSystem(profileRole);

  return (
    <div className="mx-auto max-w-2xl bg-white dark:bg-[#0a0a0a] min-h-screen">
      {/* ── Top bar ── */}
      <div className="sticky top-14 z-10 flex h-12 items-center gap-3 border-b border-border bg-white/95 dark:bg-[#0a0a0a]/95 dark:border-[#222] px-4 backdrop-blur-sm">
        <button type="button" onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          aria-label="Go back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h2 className="font-semibold text-[15px] text-ink">{profile.full_name}</h2>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          {/* Avatar */}
          <div className="h-24 w-24 shrink-0 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2.5px]">
            <button
              type="button"
              onClick={() => profile.profile_photo_url && setPhotoLightboxOpen(true)}
              disabled={!profile.profile_photo_url}
              className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[2px] disabled:cursor-default"
              aria-label={profile.profile_photo_url ? 'View profile photo' : undefined}
            >
              <Avatar src={profile.profile_photo_url} name={profile.full_name} size="xl" className="h-full w-full" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link href={`/messages?userId=${profile.id}`}>
              <Button variant="outline" size="sm" className="rounded-full px-4 flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span className="hidden sm:inline">Message</span>
              </Button>
            </Link>

            {showFollowBtn ? (
              <FollowBtn
                userId={profile.id}
                initialIsFollowing={profile.is_following}
                initialFollowersCount={profile.followers_count}
                token={token}
              />
            ) : (
              <ConnectBtn targetId={profile.id} token={token} />
            )}

            {/* Report / Block three-dot */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(o => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted transition hover:bg-surface-muted dark:border-[#333]"
                aria-label="More options"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:bg-[#111] dark:border-[#222]">
                  <button type="button"
                    onClick={() => { setProfileMenuOpen(false); setProfileReportOpen(true); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-ink-secondary hover:bg-surface-muted transition">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                    Report user
                  </button>
                  <button type="button"
                    onClick={() => { setProfileMenuOpen(false); setProfileBlockOpen(true); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    Block user
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Name + role badge + handle */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-bold leading-tight text-ink">{profile.full_name}</h1>
            <RoleBadge role={profileRole} />
          </div>
          <p className="mt-0.5 text-[14px] text-ink-muted">@{displayUsername}</p>

          {profile.bio && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink">{profile.bio}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
              Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-50 dark:bg-brand-950 px-3 py-1 text-[12px] font-medium text-brand-700 dark:text-brand-400">{profile.department}</span>
            <span className="rounded-full bg-gray-100 dark:bg-[#1a1a1a] px-3 py-1 text-[12px] font-medium text-gray-600 dark:text-gray-400">{profile.level}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-5 flex gap-8 border-b border-border pb-4 dark:border-[#222]">
          <div>
            <p className="text-[17px] font-bold text-ink">{posts.length}</p>
            <p className="text-[12px] text-ink-muted">Posts</p>
          </div>
          <div>
            <p className="text-[17px] font-bold text-ink">{profile.followers_count}</p>
            <p className="text-[12px] text-ink-muted">Followers</p>
          </div>
          <div>
            <p className="text-[17px] font-bold text-ink">{profile.following_count}</p>
            <p className="text-[12px] text-ink-muted">Following</p>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="sticky top-[104px] z-10 flex border-b border-border bg-white dark:bg-[#0a0a0a] dark:border-[#222]">
        {(['posts', 'replies'] as TabType[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 border-b-2 py-3 text-[14px] font-medium capitalize transition',
              activeTab === tab ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-muted hover:text-ink'
            )}>
            {tab === 'posts' ? `Posts${posts.length > 0 ? ` (${posts.length})` : ''}` : `Replies${replies.length > 0 ? ` (${replies.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Posts ── */}
      {activeTab === 'posts' && (
        posts.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <svg className="mb-3 h-10 w-10 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <p className="font-semibold text-[15px] text-ink">No posts yet</p>
            <p className="mt-1 text-[14px] text-ink-muted">{profile.full_name} hasn&apos;t posted anything yet.</p>
          </div>
        ) : (
          posts.map(post => (
            <div
              key={post.id}
              onClick={() => router.push(`/post/${post.id}`)}
              className="cursor-pointer border-b border-border px-4 py-4 transition hover:bg-gray-50/40 dark:hover:bg-white/[0.03] dark:border-[#222]"
            >
              <div className="flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
                  <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[1.5px]">
                    <Avatar src={profile.profile_photo_url} name={profile.full_name} size="md" className="h-full w-full" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[14px] font-semibold text-ink">{profile.full_name}</span>
                    <RoleBadge role={profileRole} iconOnly />
                    <span className="text-[12px] text-ink-muted">{timeAgo(post.created_at)}</span>
                    {post.post_subtype && post.post_subtype !== 'post' && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                        {post.post_subtype}
                      </span>
                    )}
                  </div>

                  {(post.post_subtype === 'discussion' || post.post_subtype === 'question') && post.discussion_title && (
                    <p className="mt-1.5 text-[15px] font-bold text-ink">{post.discussion_title}</p>
                  )}

                  {post.content && (
                    <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                      <PostContent content={post.content} />
                    </p>
                  )}

                  {post.image_url && (
                    <img src={optimizedImage(post.image_url)} alt="Post" className="mt-3 max-h-96 w-full rounded-2xl border border-border/60 bg-black/5 object-contain dark:bg-white/5" />
                  )}

                  {/* Poll */}
                  {post.post_subtype === 'poll' && post.poll_options && post.poll_options.length > 0 && (() => {
                    const totalVotes = post.poll_options.reduce((s, o) => s + o.vote_count, 0);
                    return (
                      <div className="mt-3 space-y-2">
                        {post.poll_options.map(opt => {
                          const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
                          const isVoted = post.voted_option_id === opt.id;
                          return (
                            <div key={opt.id} className="relative overflow-hidden rounded-xl border border-border dark:border-[#222]">
                              <div className={cn('absolute inset-y-0 left-0', isVoted ? 'bg-brand-100 dark:bg-brand-950' : 'bg-surface-muted dark:bg-white/[0.04]')} style={{ width: `${pct}%` }} />
                              <div className="relative flex items-center justify-between px-3 py-2">
                                <span className={cn('text-[13px]', isVoted ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-ink')}>
                                  {opt.option_text}{isVoted ? ' ✓' : ''}
                                </span>
                                <span className="text-[12px] font-medium text-ink-muted">{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[12px] text-ink-muted">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
                      </div>
                    );
                  })()}

                  {/* Event */}
                  {post.post_subtype === 'event' && post.event_title && (
                    <div className="mt-3 rounded-2xl border border-border p-3 dark:border-[#222]">
                      <p className="font-bold text-[15px] text-ink">{post.event_title}</p>
                      {post.event_date && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                          </svg>
                          {new Date(post.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                      {post.event_location && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {post.event_location}
                        </p>
                      )}
                      {typeof post.event_rsvp_count === 'number' && (
                        <p className="mt-2 text-[12px] font-medium text-brand-600 dark:text-brand-400">{post.event_rsvp_count} attending</p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-5 text-[13px] text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} fill="none">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                      {post.likes_count}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                      </svg>
                      {post.comments_count}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )
      )}

      {/* ── Replies ── */}
      {activeTab === 'replies' && (
        replies.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <svg className="mb-3 h-10 w-10 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
            </svg>
            <p className="font-semibold text-[15px] text-ink">No replies yet</p>
            <p className="mt-1 text-[14px] text-ink-muted">{profile.full_name} hasn&apos;t replied to any posts yet.</p>
          </div>
        ) : (
          replies.map(reply => (
            <div
              key={reply.id}
              onClick={() => router.push(`/post/${reply.post_id}`)}
              className="cursor-pointer border-b border-border px-4 py-4 transition hover:bg-gray-50/40 dark:hover:bg-white/[0.03] dark:border-[#222]"
            >
              <div className="mb-2 rounded-xl border border-border/70 bg-surface-muted/50 px-3 py-2 dark:border-[#222] dark:bg-white/[0.02]">
                <p className="text-[12px] text-ink-muted">
                  Replying to <span className="font-medium text-ink">{reply.post_author_name}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-secondary">
                  {reply.post_title || reply.post_content || '(post)'}
                </p>
              </div>
              <div className="flex gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
                  <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[1.5px]">
                    <Avatar src={profile.profile_photo_url} name={profile.full_name} size="sm" className="h-full w-full" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-semibold text-ink">{profile.full_name}</span>
                    <span className="text-[12px] text-ink-muted">{timeAgo(reply.created_at)}</span>
                  </div>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">
                    <PostContent content={reply.content} />
                  </p>
                </div>
              </div>
            </div>
          ))
        )
      )}

      {/* Profile photo lightbox */}
      {photoLightboxOpen && profile.profile_photo_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPhotoLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setPhotoLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={profile.profile_photo_url}
            alt={profile.full_name}
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Report modal */}
      {profileReportOpen && (
        <ReportModal
          target={{ type: 'user', id: profile.id, name: profile.full_name }}
          token={token}
          apiUrl={API_URL}
          onClose={() => setProfileReportOpen(false)}
          onSuccess={(msg) => { setProfileReportOpen(false); setProfileToast(msg); setTimeout(() => setProfileToast(null), 3000); }}
        />
      )}

      {/* Block confirmation */}
      {profileBlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setProfileBlockOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#111] dark:border dark:border-[#222]" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-ink">Block {profile.full_name}?</h3>
            <p className="mt-2 text-body-sm text-ink-muted">
              They won't be able to see your posts or message you, and their content won't appear in your feed.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setProfileBlockOpen(false)}>Cancel</Button>
              <Button
                className="flex-1 !bg-red-600 !text-white hover:!bg-red-700"
                onClick={async () => {
                  try {
                    await fetch(`${API_URL}/api/moderation/block/${profile.id}`, {
                      method: 'POST', headers: { Authorization: `Bearer ${token}` },
                    });
                    setProfileBlockOpen(false);
                    setProfileToast(`${profile.full_name} has been blocked.`);
                    setTimeout(() => setProfileToast(null), 3000);
                  } catch { setProfileBlockOpen(false); }
                }}
              >
                Block
              </Button>
            </div>
          </div>
        </div>
      )}

      {profileToast && (
        <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-caption font-medium text-white shadow-lg dark:bg-[#222] sm:bottom-6">
          {profileToast}
        </div>
      )}
    </div>
  );
}
