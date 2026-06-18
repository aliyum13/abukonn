'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFollow } from '@/hooks/useFollow';
import { Avatar, Button, Select, Skeleton, RoleBadge, PostContent } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const DEPARTMENTS = [
  'Computer Science', 'Software Engineering', 'Information Technology',
  'Electrical Engineering', 'Civil Engineering', 'Mechanical Engineering',
  'Medicine & Surgery', 'Law', 'Economics', 'Accounting',
  'Mass Communication', 'Political Science', 'Sociology',
  'Mathematics', 'Physics', 'Chemistry', 'Biochemistry',
  'Microbiology', 'Pharmacy', 'Nursing Science',
];

const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', 'Spill Over', 'Postgraduate'];

interface ProfilePost {
  id: number;
  content: string;
  image_url?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

interface FollowUser {
  id: number;
  full_name: string;
  username?: string;
  department: string;
  profile_photo_url: string | null;
}

type ModalType = 'none' | 'followers' | 'following';
type TabType = 'posts' | 'replies';

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="h-12 border-b border-border bg-white dark:bg-[#0a0a0a] dark:border-[#222]" />
      <div className="px-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-24 w-24 shrink-0" rounded="full" />
          <Skeleton className="mt-1 h-9 w-28 rounded-full" />
        </div>
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="mt-5 flex gap-6 border-b border-border pb-4">
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

function ModalUserRow({
  user,
  token,
  onNavigate,
}: {
  user: FollowUser;
  token: string | null;
  onNavigate: () => void;
}) {
  const { isFollowing, loading, toggle } = useFollow(user.id, false, 0, token);
  return (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-muted">
      <Link href={`/profile/${user.id}`} onClick={onNavigate}>
        <Avatar src={user.profile_photo_url} name={user.full_name} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${user.id}`} onClick={onNavigate}
          className="block truncate text-[14px] font-semibold text-ink hover:text-brand-600">
          {user.full_name}
        </Link>
        <p className="truncate text-[12px] text-ink-muted">
          {user.username ? `@${user.username}` : user.department}
        </p>
      </div>
      <Button
        variant={isFollowing ? 'outline' : 'primary'}
        size="sm"
        onClick={toggle}
        loading={loading}
        className={cn('shrink-0 min-w-[76px] rounded-full', isFollowing && 'hover:border-red-300 hover:text-red-600')}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, token, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ bio: '', department: '', level: '', username: '' });
  const [matricNumber, setMatricNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [modalType, setModalType] = useState<ModalType>('none');
  const [modalList, setModalList] = useState<FollowUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setForm({
            bio: data.user.bio || '',
            department: data.user.department || '',
            level: data.user.level || '',
            username: data.user.username || '',
          });
          setMatricNumber(data.user.matric_number || '');
          setPosts(data.posts || []);
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token || !user?.id) return;
    fetch(`${API_URL}/api/follows/${user.id}/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setFollowersCount(d.followers_count ?? 0); setFollowingCount(d.following_count ?? 0); })
      .catch(() => {});
  }, [token, user?.id]);

  const openModal = async (type: 'followers' | 'following') => {
    if (!token || !user) return;
    setModalType(type);
    setModalLoading(true);
    setModalList([]);
    setModalError('');
    try {
      const endpoint = type === 'followers'
        ? `/api/follows/${user.id}/followers`
        : `/api/follows/${user.id}/following`;
      const res = await fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setModalError(data.message || 'Failed to load list'); return; }
      setModalList(data[type] ?? []);
    } catch { setModalError('Network error'); }
    finally { setModalLoading(false); }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser(data.user);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      updateUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (authLoading || !user) return <ProfileSkeleton />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayUsername = (user as any).username || user.email?.split('@')[0] || '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileRole: string = (user as any).role || (user.is_admin ? 'admin' : 'user');

  return (
    <div className="mx-auto max-w-2xl bg-white dark:bg-[#0a0a0a] min-h-screen">
      {/* ── Top bar ── */}
      <div className="sticky top-14 z-10 flex h-12 items-center justify-between border-b border-border bg-white/95 dark:bg-[#0a0a0a]/95 dark:border-[#222] px-4 backdrop-blur-sm">
        <h2 className="font-semibold text-[15px] text-ink">{user.full_name}</h2>
        <button
          type="button"
          onClick={() => { setEditing(p => !p); setError(''); }}
          title="Settings / Edit profile"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 pt-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="flex items-start justify-between gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2.5px]">
              <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[2px]">
                <Avatar src={user.profile_photo_url} name={user.full_name} size="xl" className="h-full w-full" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white dark:ring-[#0a0a0a] transition hover:bg-brand-700 disabled:opacity-50"
              title="Change photo"
            >
              {uploading ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 18.63a4 4 0 010-5.656l8.486-8.486a4 4 0 015.656 5.656l-8.486 8.486a4 4 0 01-5.656 0z" />
                </svg>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
          </div>

          {/* Edit button */}
          <div className="pt-1">
            <Button
              variant={editing ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => { setEditing(p => !p); setError(''); }}
              className="rounded-full px-5"
            >
              {editing ? 'Cancel' : 'Edit profile'}
            </Button>
          </div>
        </div>

        {/* Name + badge */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-bold leading-tight text-ink">{user.full_name}</h1>
            <RoleBadge role={profileRole} />
          </div>
          <p className="mt-0.5 text-[14px] text-ink-muted">@{displayUsername}</p>

          {/* Bio */}
          {!editing && (
            user.bio
              ? <p className="mt-3 text-[15px] leading-relaxed text-ink">{user.bio}</p>
              : <p className="mt-3 text-[14px] italic text-ink-muted">No bio yet — tap ⚙ to add one.</p>
          )}

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {user.email}
            </span>
            {(user as { created_at?: string }).created_at && (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                </svg>
                Joined {new Date(String((user as { created_at?: string }).created_at)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </span>
            )}
            {matricNumber && (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                </svg>
                {matricNumber}
              </span>
            )}
          </div>

          {/* Dept + level pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700">{user.department}</span>
            <span className="rounded-full bg-gray-100 dark:bg-[#1a1a1a] px-3 py-1 text-[12px] font-medium text-gray-600 dark:text-gray-400">{user.level}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-5 flex gap-8 border-b border-border pb-4">
          <div>
            <p className="text-[17px] font-bold text-ink">{posts.length}</p>
            <p className="text-[12px] text-ink-muted">Posts</p>
          </div>
          <button type="button" onClick={() => openModal('followers')} className="text-left transition hover:opacity-70">
            <p className="text-[17px] font-bold text-ink">{followersCount}</p>
            <p className="text-[12px] text-ink-muted">Followers</p>
          </button>
          <button type="button" onClick={() => openModal('following')} className="text-left transition hover:opacity-70">
            <p className="text-[17px] font-bold text-ink">{followingCount}</p>
            <p className="text-[12px] text-ink-muted">Following</p>
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <form onSubmit={handleSave} className="mt-5 space-y-4 border-b border-border pb-6">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Username</label>
              <input
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="your_username"
                maxLength={30}
                className={cn(
                  'w-full rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-muted',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                )}
              />
              <p className="mt-1 text-[11px] text-ink-muted">Letters, numbers, and underscores only · max 30 chars</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                rows={3}
                placeholder="Tell others about yourself..."
                maxLength={200}
                className={cn(
                  'w-full resize-none rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-muted',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                )}
              />
            </div>
            <Select label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select label="Level" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
            <Button type="submit" loading={saving} className="w-full rounded-full">
              Save changes
            </Button>
          </form>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="sticky top-[104px] z-10 flex border-b border-border bg-white dark:bg-[#0a0a0a] dark:border-[#222]">
        {(['posts', 'replies'] as TabType[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 border-b-2 py-3 text-[14px] font-medium capitalize transition',
              activeTab === tab
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-muted hover:text-ink'
            )}>
            {tab === 'posts' ? `Posts${posts.length > 0 ? ` (${posts.length})` : ''}` : 'Replies'}
          </button>
        ))}
      </div>

      {/* ── Posts tab ── */}
      {activeTab === 'posts' && (
        loading ? (
          <><PostSkeleton /><PostSkeleton /></>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <svg className="mb-3 h-10 w-10 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="font-semibold text-[15px] text-ink">No posts yet</p>
            <p className="mt-1 text-[14px] text-ink-muted">Share something with the ABU community</p>
            <Link href="/feed">
              <Button className="mt-4 rounded-full px-6" size="sm">Write a post</Button>
            </Link>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="border-b border-border px-4 py-4 transition hover:bg-gray-50/40 dark:hover:bg-white/[0.03] dark:border-[#222]">
              <div className="flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
                  <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[1.5px]">
                    <Avatar src={user.profile_photo_url} name={user.full_name} size="md" className="h-full w-full" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-semibold text-ink">{user.full_name}</span>
                    <span className="text-[12px] text-ink-muted">{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                    <PostContent content={post.content} />
                  </p>
                  {post.image_url && (
                    <img src={post.image_url} alt="Post" className="mt-3 max-h-72 w-full rounded-2xl border border-border/60 object-cover" />
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

      {/* ── Replies tab ── */}
      {activeTab === 'replies' && (
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <svg className="mb-3 h-10 w-10 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
          </svg>
          <p className="font-semibold text-[15px] text-ink">No replies yet</p>
          <p className="mt-1 text-[14px] text-ink-muted">Your comments on posts will appear here</p>
        </div>
      )}

      {/* ── Followers / Following modal ── */}
      {modalType !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => { setModalType('none'); setModalError(''); }}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white dark:bg-[#111] dark:border dark:border-[#222] shadow-xl sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <h2 className="font-semibold capitalize text-ink">
                {modalType} ({modalType === 'followers' ? followersCount : followingCount})
              </h2>
              <button type="button" onClick={() => { setModalType('none'); setModalError(''); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {modalLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                  </div>
                ))
              ) : modalError ? (
                <div className="px-4 py-8 text-center text-sm text-red-600">{modalError}</div>
              ) : modalList.length === 0 ? (
                <div className="px-4 py-10 text-center text-[14px] text-ink-muted">
                  {modalType === 'followers' ? 'No followers yet' : "You're not following anyone yet"}
                </div>
              ) : (
                modalList.map(u => (
                  <ModalUserRow key={u.id} user={u} token={token} onNavigate={() => setModalType('none')} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
