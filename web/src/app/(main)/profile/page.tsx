'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFollow } from '@/hooks/useFollow';
import { Avatar, Button, Skeleton, RoleBadge, PostContent } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
  is_following?: boolean;
}

type ModalType = 'none' | 'followers' | 'following';
type TabType = 'posts' | 'replies';

interface ProfileStory {
  id: number;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  story_type: 'image' | 'video' | 'text';
  text_content: string | null;
  bg_color: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
}

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
  const { isFollowing, loading, toggle } = useFollow(user.id, user.is_following ?? false, 0, token);
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
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [modalType, setModalType] = useState<ModalType>('none');
  const [modalList, setModalList] = useState<FollowUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Stories
  const [myStories, setMyStories] = useState<ProfileStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [viewingStory, setViewingStory] = useState<ProfileStory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Story upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<'media' | 'text'>('media');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadText, setUploadText] = useState('');
  const [uploadBgColor, setUploadBgColor] = useState('#16a34a');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
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

  // Fetch own stories
  useEffect(() => {
    if (!token) return;
    setStoriesLoading(true);
    fetch(`${API_URL}/api/stories/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMyStories(d.stories || []))
      .catch(() => {})
      .finally(() => setStoriesLoading(false));
  }, [token]);

  const refreshStories = () => {
    if (!token) return;
    fetch(`${API_URL}/api/stories/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMyStories(d.stories || []))
      .catch(() => {});
  };

  const handleDeleteStory = async (storyId: number) => {
    if (!token) return;
    setDeletingId(storyId);
    try {
      await fetch(`${API_URL}/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyStories(prev => prev.filter(s => s.id !== storyId));
      if (viewingStory?.id === storyId) setViewingStory(null);
    } finally {
      setDeletingId(null);
    }
  };

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadText('');
    setUploadBgColor('#16a34a');
    setUploadCaption('');
    setUploadTab('media');
    setUploadError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    if (isVideo && file.size > 10 * 1024 * 1024) {
      setUploadError('Video must be under 10MB');
      return;
    }
    if (!isVideo && file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB');
      return;
    }
    setUploadError('');
    setUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadStory = async () => {
    if (!token) return;
    setUploading(true);
    setUploadError('');
    try {
      if (uploadTab === 'text') {
        if (!uploadText.trim()) { setUploadError('Please enter some text'); setUploading(false); return; }
        const res = await fetch(`${API_URL}/api/stories`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ story_type: 'text', text_content: uploadText.trim(), bg_color: uploadBgColor }),
        });
        if (!res.ok) throw new Error('Failed to share story');
      } else if (uploadFile) {
        const isVideo = uploadFile.type.startsWith('video/');

        if (isVideo) {
          // Direct-to-Cloudinary upload — bypasses Railway's 30 s proxy timeout
          const sigRes = await fetch(`${API_URL}/api/stories/upload-signature`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!sigRes.ok) throw new Error('Failed to get upload signature');
          const { signature, timestamp, api_key, cloud_name, folder } = await sigRes.json() as {
            signature: string; timestamp: number; api_key: string; cloud_name: string; folder: string;
          };

          const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const tid = setTimeout(() => xhr.abort(), 300000);
            xhr.onload = () => {
              clearTimeout(tid);
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url); }
                catch { reject(new Error('Invalid Cloudinary response')); }
              } else {
                try { reject(new Error((JSON.parse(xhr.responseText) as { error?: { message: string } }).error?.message || 'Cloudinary upload failed')); }
                catch { reject(new Error('Cloudinary upload failed')); }
              }
            };
            xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error')); };
            xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out')); };
            const fd = new FormData();
            fd.append('file', uploadFile);
            fd.append('api_key', api_key);
            fd.append('timestamp', String(timestamp));
            fd.append('signature', signature);
            fd.append('folder', folder);
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`);
            xhr.send(fd);
          });

          const saveRes = await fetch(`${API_URL}/api/stories`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              story_type: 'video',
              media_url: cloudinaryUrl,
              direct_upload: true,
              caption: uploadCaption.trim() || undefined,
            }),
          });
          if (!saveRes.ok) {
            const d = await saveRes.json().catch(() => ({})) as { message?: string };
            throw new Error(d.message || 'Failed to save story');
          }
        } else {
          // Images go through Railway — small enough to complete in < 30 s
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const tid = setTimeout(() => xhr.abort(), 30000);
            xhr.onload = () => { clearTimeout(tid); xhr.status < 300 ? resolve() : reject(new Error('Upload failed')); };
            xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error')); };
            xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out')); };
            const fd = new FormData();
            fd.append('media', uploadFile);
            if (uploadCaption.trim()) fd.append('caption', uploadCaption.trim());
            xhr.open('POST', `${API_URL}/api/stories`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(fd);
          });
        }
      } else {
        setUploadError('Please select a photo or video');
        setUploading(false);
        return;
      }
      refreshStories();
      closeUploadModal();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

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
        <Link
          href="/settings"
          title="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 pt-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="relative shrink-0">
            <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2.5px]">
              <button
                type="button"
                onClick={() => user.profile_photo_url && setPhotoLightboxOpen(true)}
                disabled={!user.profile_photo_url}
                className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[2px] disabled:cursor-default"
                aria-label={user.profile_photo_url ? 'View profile photo' : undefined}
              >
                <Avatar src={user.profile_photo_url} name={user.full_name} size="xl" className="h-full w-full" />
              </button>
            </div>
          </div>

          <div className="pt-1">
            <Link href="/settings#account">
              <Button variant="secondary" size="sm" className="rounded-full px-5">
                Edit profile
              </Button>
            </Link>
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
          {user.bio
            ? <p className="mt-3 text-[15px] leading-relaxed text-ink">{user.bio}</p>
            : (
              <p className="mt-3 text-[14px] italic text-ink-muted">
                No bio yet —{' '}
                <Link href="/settings#account" className="text-brand-600 hover:underline dark:text-brand-400">
                  add one in Settings
                </Link>
              </p>
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
      </div>

      {/* ── My Status ── */}
      <div className="border-b border-border px-4 py-4 dark:border-[#222]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">My Status</p>
          <Link href="/mystories" className="text-[12px] font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-400">
            Manage all →
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {/* Add button */}
          <button type="button" onClick={() => setShowUpload(true)}
            className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-brand-400 bg-brand-50 transition hover:bg-brand-100 dark:bg-brand-950/30 dark:border-brand-700 dark:hover:bg-brand-950/50">
              <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-[11px] font-medium text-ink-muted">Add</span>
          </button>

          {/* Story thumbnails */}
          {storiesLoading && !myStories.length && [1, 2].map(i => (
            <div key={i} className="flex shrink-0 flex-col items-center gap-1.5">
              <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200 dark:bg-[#2a2a2a]" />
              <div className="h-2 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-[#2a2a2a]" />
            </div>
          ))}

          {myStories.map(story => (
            <div key={story.id} className="relative flex shrink-0 flex-col items-center gap-1.5">
              <button type="button" onClick={() => setViewingStory(story)}
                className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-[#0a0a0a] transition hover:opacity-90">
                {story.story_type === 'text' ? (
                  <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: story.bg_color || '#16a34a' }}>
                    <p className="text-center text-[8px] font-semibold leading-tight text-white px-1 line-clamp-3">{story.text_content}</p>
                  </div>
                ) : story.story_type === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center bg-black">
                    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                ) : (
                  <img src={story.media_url!} alt="Story" className="h-full w-full object-cover" />
                )}
              </button>
              {/* Delete button */}
              <button type="button" disabled={deletingId === story.id}
                onClick={() => handleDeleteStory(story.id)}
                className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-white dark:ring-[#0a0a0a] transition hover:bg-red-600 disabled:opacity-50">
                {deletingId === story.id
                  ? <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                }
              </button>
              <span className="text-[10px] text-ink-muted">{timeAgo(story.created_at)}</span>
            </div>
          ))}
        </div>

        <p className="mt-2.5 text-[11px] text-ink-muted">Stories disappear after 24 hours</p>
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

      {/* ── Story viewer ── */}
      {viewingStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewingStory(null)}>
          <div className="relative w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setViewingStory(null)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {viewingStory.story_type === 'text' ? (
              <div className="flex min-h-[60vh] items-center justify-center rounded-2xl px-8"
                style={{ backgroundColor: viewingStory.bg_color || '#16a34a' }}>
                <p className="text-center text-3xl font-bold leading-snug text-white break-words">
                  {viewingStory.text_content}
                </p>
              </div>
            ) : viewingStory.story_type === 'video' ? (
              <div className="relative">
                <video src={viewingStory.media_url!} autoPlay controls playsInline
                  className="max-h-[80vh] w-full rounded-2xl object-contain" />
                {viewingStory.caption && (
                  <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 pointer-events-none">
                    <p className="text-sm font-medium text-white/95 leading-snug line-clamp-2">{viewingStory.caption}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <img src={viewingStory.media_url!} alt="Story"
                  className="max-h-[80vh] w-full rounded-2xl object-contain" />
                {viewingStory.caption && (
                  <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 pointer-events-none">
                    <p className="text-sm font-medium text-white/95 leading-snug line-clamp-2">{viewingStory.caption}</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 text-center text-[12px] text-white/60">{timeAgo(viewingStory.created_at)}</div>
          </div>
        </div>
      )}

      {/* ── Story upload modal ── */}
      {showUpload && (() => {
        const BG_PRESETS = ['#16a34a','#1d4ed8','#7c3aed','#dc2626','#ea580c','#0891b2','#111827','#be185d'];
        const canShare = uploadTab === 'text' ? uploadText.trim().length > 0 : !!uploadFile;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
            onClick={e => { if (e.target === e.currentTarget) closeUploadModal(); }}>
            <div className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-[#111] sm:rounded-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5 dark:border-[#222]">
                <h3 className="font-semibold text-ink">Add Status</h3>
                <button type="button" onClick={closeUploadModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border dark:border-[#222]">
                {(['media', 'text'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => { setUploadTab(t); setUploadError(''); }}
                    className={cn('flex-1 py-2.5 text-sm font-medium transition',
                      uploadTab === t ? 'border-b-2 border-brand-600 text-brand-600' : 'text-ink-muted hover:text-ink')}>
                    {t === 'media' ? 'Photo / Video' : 'Text'}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-4">
                {uploadError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{uploadError}</div>
                )}

                {uploadTab === 'media' ? (
                  <>
                    <input ref={uploadInputRef} type="file" accept="image/*,video/*"
                      onChange={handleFileSelect} className="hidden" />
                    {uploadPreview ? (
                      <>
                        <div className="relative">
                          {uploadFile?.type.startsWith('video/') ? (
                            <video src={uploadPreview} className="max-h-56 w-full rounded-xl object-cover" controls />
                          ) : (
                            <img src={uploadPreview} alt="Preview" className="max-h-56 w-full rounded-xl object-cover" />
                          )}
                          <button type="button" onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-3">
                          <textarea value={uploadCaption} onChange={e => setUploadCaption(e.target.value.slice(0, 150))}
                            placeholder="Add a caption..." rows={2}
                            className="w-full resize-none rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#1a1a1a] dark:border-[#333]" />
                          <p className="mt-1 text-right text-[11px] text-ink-muted">{uploadCaption.length}/150</p>
                        </div>
                      </>
                    ) : (
                      <button type="button" onClick={() => uploadInputRef.current?.click()}
                        className="flex h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-ink-muted transition hover:border-brand-400 hover:text-brand-600">
                        <svg className="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                        </svg>
                        <p className="text-sm font-medium">Tap to add photo or video</p>
                        <p className="text-[11px] text-ink-muted mt-0.5">Images up to 5MB · Videos up to 10MB</p>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-36 items-center justify-center rounded-xl px-4"
                      style={{ backgroundColor: uploadBgColor }}>
                      <p className={cn('text-center font-bold leading-tight text-white break-words w-full',
                        uploadText.length > 100 ? 'text-lg' : uploadText.length > 50 ? 'text-xl' : 'text-2xl')}>
                        {uploadText || <span className="opacity-40">Your text here…</span>}
                      </p>
                    </div>
                    <textarea value={uploadText} onChange={e => setUploadText(e.target.value)}
                      placeholder="What's on your mind?" maxLength={280} rows={3}
                      className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#1a1a1a] dark:border-[#333]" />
                    <div className="flex flex-wrap gap-2">
                      {BG_PRESETS.map(c => (
                        <button key={c} type="button" onClick={() => setUploadBgColor(c)}
                          className={cn('h-7 w-7 shrink-0 rounded-full transition hover:scale-110',
                            uploadBgColor === c ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : '')}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={closeUploadModal}>Cancel</Button>
                  <Button className="flex-1" disabled={!canShare || uploading} loading={uploading}
                    onClick={handleUploadStory}>
                    Share Story
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Profile photo lightbox */}
      {photoLightboxOpen && user.profile_photo_url && (
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
            src={user.profile_photo_url}
            alt={user.full_name}
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
