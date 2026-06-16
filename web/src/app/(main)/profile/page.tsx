'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFollow } from '@/hooks/useFollow';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Select,
  Skeleton,
} from '@/components/ui';

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
  matric_number: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
}

type ModalType = 'none' | 'followers' | 'following';

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Skeleton className="h-24 w-24 shrink-0" rounded="full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  const { user, token, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ bio: '', department: '', level: '' });
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts'>('posts');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Follow stats
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Followers/following modal
  const [modalType, setModalType] = useState<ModalType>('none');
  const [modalList, setModalList] = useState<FollowUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setForm({
            bio: data.user.bio || '',
            department: data.user.department,
            level: data.user.level,
          });
          setPosts(data.posts || []);
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [token]);

  // Fetch follow stats — depend on user.id (primitive) not the object
  useEffect(() => {
    if (!token || !user?.id) return;
    fetch(`${API_URL}/api/follows/${user.id}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setFollowersCount(d.followers_count ?? 0);
        setFollowingCount(d.following_count ?? 0);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const openModal = async (type: 'followers' | 'following') => {
    if (!token) return;
    setModalType(type);
    setModalLoading(true);
    setModalList([]);
    try {
      const endpoint =
        type === 'followers' ? '/api/follows/followers' : '/api/follows/following';
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // followers endpoint → { followers: [] }, following endpoint → { following: [] }
      setModalList(data[type] ?? []);
    } catch {
      setModalList([]);
    } finally {
      setModalLoading(false);
    }
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
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
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

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">
          {error}
        </div>
      )}

      {/* Cover banner */}
      <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 sm:h-48">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      {/* Profile header */}
      <Card className="-mt-16 relative z-10 overflow-visible">
        <CardContent className="px-5 pb-6 pt-0 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative -mt-12 sm:-mt-14">
              <Avatar
                src={user.profile_photo_url}
                name={user.full_name}
                size="xl"
                className="h-24 w-24 text-xl ring-4 ring-white sm:h-28 sm:w-28"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-brand transition hover:bg-brand-700 disabled:opacity-50"
                title="Change photo"
              >
                {uploading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 18.63a4 4 0 010-5.656l8.486-8.486a4 4 0 015.656 5.656l-8.486 8.486a4 4 0 01-5.656 0z" />
                  </svg>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </div>

            <div className="flex gap-2 sm:mb-2">
              <Button
                variant={editing ? 'outline' : 'secondary'}
                onClick={() => setEditing(!editing)}
              >
                {editing ? 'Cancel' : 'Edit profile'}
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-display-sm text-ink">{user.full_name}</h1>
            <p className="mt-1 text-body-sm text-ink-secondary">{user.matric_number}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="brand">{user.department}</Badge>
              <Badge variant="outline">{user.level}</Badge>
            </div>
            {!editing && user.bio && (
              <p className="mt-4 text-body-sm leading-relaxed text-ink-secondary">{user.bio}</p>
            )}
            {!editing && !user.bio && (
              <p className="mt-4 text-body-sm italic text-ink-muted">
                No bio yet. Click Edit profile to add one.
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-muted">
            <div className="py-4 text-center">
              <p className="text-lg font-bold text-ink">{posts.length}</p>
              <p className="text-caption text-ink-muted">Posts</p>
            </div>
            <button
              type="button"
              onClick={() => openModal('followers')}
              className="py-4 text-center transition hover:bg-surface-subtle"
            >
              <p className="text-lg font-bold text-ink">{followersCount}</p>
              <p className="text-caption text-ink-muted">Followers</p>
            </button>
            <button
              type="button"
              onClick={() => openModal('following')}
              className="py-4 text-center transition hover:bg-surface-subtle"
            >
              <p className="text-lg font-bold text-ink">{followingCount}</p>
              <p className="text-caption text-ink-muted">Following</p>
            </button>
          </div>

          {editing && (
            <form onSubmit={handleSave} className="mt-6 space-y-4 border-t border-border pt-6">
              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  placeholder="Tell others about yourself..."
                  className={cn(
                    'w-full resize-none rounded-xl border border-border bg-white px-4 py-3',
                    'text-body-sm text-ink placeholder:text-ink-muted',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                  )}
                />
              </div>
              <Select
                label="Department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
              <Select
                label="Level"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Followers / Following modal */}
      {modalType !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalType('none')}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold text-ink capitalize">
                {modalType} ({modalType === 'followers' ? followersCount : followingCount})
              </h2>
              <button
                type="button"
                onClick={() => setModalType('none')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {modalLoading ? (
                <div className="space-y-0">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : modalList.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-body-sm text-ink-muted">
                    {modalType === 'followers'
                      ? 'No followers yet'
                      : "You're not following anyone yet"}
                  </p>
                </div>
              ) : (
                modalList.map((u) => (
                  <ModalUserRow
                    key={u.id}
                    user={u}
                    token={token}
                    onNavigate={() => setModalType('none')}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Posts tab */}
      <div className="mt-6">
        <div className="mb-4 flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={cn(
              'border-b-2 px-4 py-3 text-body-sm font-medium transition',
              activeTab === 'posts'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            )}
          >
            Posts
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              title="No posts yet"
              description="Share your first post from the feed to see it here."
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-5">
                  <p className="whitespace-pre-wrap text-body-sm text-ink leading-relaxed">
                    {post.content}
                  </p>
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="mt-3 max-h-60 w-full rounded-xl object-cover"
                    />
                  )}
                  <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-caption text-ink-muted">
                    <span>{timeAgo(post.created_at)}</span>
                    <span>{post.likes_count} likes</span>
                    <span>{post.comments_count} comments</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted transition">
      <Link href={`/profile/${user.id}`} onClick={onNavigate}>
        <Avatar src={user.profile_photo_url} name={user.full_name} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/profile/${user.id}`}
          onClick={onNavigate}
          className="block truncate font-medium text-ink hover:text-brand-600"
        >
          {user.full_name}
        </Link>
        <p className="truncate text-caption text-ink-muted">{user.department}</p>
      </div>
      <Button
        variant={isFollowing ? 'outline' : 'primary'}
        size="sm"
        onClick={toggle}
        loading={loading}
        className={`shrink-0 min-w-[76px] ${isFollowing ? 'hover:border-red-300 hover:text-red-600' : ''}`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}
