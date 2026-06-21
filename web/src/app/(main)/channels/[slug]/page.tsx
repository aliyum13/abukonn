'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Button, Input, Skeleton, PostContent, RoleBadge } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const POST_CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'EXAMINATION', label: 'Examination' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'CAMPUS_LIFE', label: 'Campus Life' },
] as const;
type PostCategory = (typeof POST_CATEGORIES)[number]['value'];

interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  category: string;
  member_count: number;
  is_official: boolean;
  is_member: boolean;
}

interface ChannelPost {
  id: number;
  user_id: number;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  repost_count: number;
  view_count: number;
  category: PostCategory;
  post_subtype: 'post' | 'discussion';
  discussion_title: string | null;
  is_liked: boolean;
  created_at: string;
  author_name: string;
  author_department: string;
  author_photo: string | null;
  author_role?: string;
  pinned: boolean;
}

function PostSkeleton() {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function ChannelDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [joining, setJoining] = useState(false);

  // Composer
  const [composerText, setComposerText] = useState('');
  const [composerCategory, setComposerCategory] = useState<PostCategory>('GENERAL');
  const [composerImage, setComposerImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token || !slug) return;
    setLoadingChannel(true);
    fetch(`${API_URL}/api/channels/${slug}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setChannel(d.channel ?? null))
      .catch(() => {})
      .finally(() => setLoadingChannel(false));
  }, [token, slug]);

  const fetchPosts = () => {
    if (!token || !channel) return;
    setLoadingPosts(true);
    fetch(`${API_URL}/api/channels/${channel.id}/posts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  };

  useEffect(() => { if (channel) fetchPosts(); }, [channel?.id]);

  const handleJoinLeave = async () => {
    if (!token || !channel) return;
    setJoining(true);
    try {
      const method = channel.is_member ? 'DELETE' : 'POST';
      const url = channel.is_member
        ? `${API_URL}/api/channels/${channel.id}/leave`
        : `${API_URL}/api/channels/${channel.id}/join`;
      await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
      setChannel(c => c ? { ...c, is_member: !c.is_member, member_count: c.is_member ? c.member_count - 1 : c.member_count + 1 } : c);
    } finally {
      setJoining(false);
    }
  };

  const handleLike = async (postId: number) => {
    if (!token) return;
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p
    ));
    await fetch(`${API_URL}/api/posts/${postId}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setComposerImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !channel || !composerText.trim()) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('content', composerText.trim());
      fd.append('category', composerCategory);
      if (composerImage) fd.append('image', composerImage);
      const res = await fetch(`${API_URL}/api/channels/${channel.id}/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        setComposerText('');
        setComposerImage(null);
        setImagePreview(null);
        setComposerCategory('GENERAL');
        fetchPosts();
      }
    } finally {
      setPosting(false);
    }
  };

  if (authLoading || loadingChannel) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="border-b border-border px-4 py-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-semibold text-ink">Channel not found</p>
        <Link href="/channels" className="mt-2 block text-sm text-brand-600 hover:underline">Browse all channels</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Channel header */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-2xl dark:bg-[#1a1a1a]">
            {channel.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-bold text-ink">{channel.name}</h1>
              {channel.is_official && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  Official
                </span>
              )}
            </div>
            <p className="text-[13px] text-ink-muted">
              {channel.member_count.toLocaleString()} member{channel.member_count !== 1 ? 's' : ''}
            </p>
            {channel.description && (
              <p className="mt-1 text-[13px] text-ink-secondary">{channel.description}</p>
            )}
          </div>
          <Button
            size="sm"
            variant={channel.is_member ? 'outline' : 'primary'}
            loading={joining}
            onClick={handleJoinLeave}
            className={cn('shrink-0 rounded-full', channel.is_member && 'hover:border-red-300 hover:text-red-600')}>
            {channel.is_member ? 'Joined' : 'Join'}
          </Button>
        </div>
      </div>

      {/* Composer — only for members */}
      {channel.is_member && user && (
        <div className="border-b border-border px-4 py-4">
          <form onSubmit={handlePost}>
            <div className="flex gap-3">
              <Avatar src={user.profile_photo_url} name={user.full_name} size="md" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <textarea
                  value={composerText}
                  onChange={e => { setComposerText(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }}
                  placeholder={`Post to ${channel.name}…`}
                  rows={1}
                  className="w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none leading-relaxed"
                  style={{ minHeight: '28px', maxHeight: '150px', overflow: 'hidden' }}
                />
                {imagePreview && (
                  <div className="relative mt-2">
                    <img src={imagePreview} alt="Preview" className="max-h-48 w-full rounded-xl object-cover" />
                    <button type="button" onClick={() => { setComposerImage(null); setImagePreview(null); }}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => imageInputRef.current?.click()}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-brand-600 hover:bg-brand-50">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </button>
                    <select value={composerCategory} onChange={e => setComposerCategory(e.target.value as PostCategory)}
                      className="rounded-full border border-border bg-transparent py-1 pl-2 pr-1.5 text-[12px] text-ink-secondary focus:outline-none">
                      {POST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <Button type="submit" size="sm" disabled={posting || !composerText.trim()} loading={posting}
                    className="rounded-full px-5">Post</Button>
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Posts */}
      {loadingPosts ? (
        <><PostSkeleton /><PostSkeleton /></>
      ) : posts.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-2xl mb-2">{channel.icon}</p>
          <p className="font-semibold text-ink">No posts yet</p>
          <p className="mt-1 text-[14px] text-ink-muted">
            {channel.is_member ? 'Be the first to post in this channel!' : 'Join this channel to see and create posts.'}
          </p>
        </div>
      ) : (
        posts.map(post => (
          <article key={post.id}
            className="border-b border-border px-4 py-4 transition hover:bg-gray-50/40 dark:hover:bg-white/[0.03] dark:border-[#222]">
            {post.pinned && (
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                Pinned
              </div>
            )}
            <div className="flex gap-3">
              <Link href={`/profile/${post.user_id}`} className="shrink-0">
                <Avatar src={post.author_photo} name={post.author_name} size="md" className="mt-0.5" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link href={`/profile/${post.user_id}`} className="font-semibold text-[14px] text-ink hover:underline">
                    {post.author_name}
                  </Link>
                  <RoleBadge role={post.author_role || 'user'} iconOnly />
                  {post.post_subtype === 'discussion' && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      💬 Discussion
                    </span>
                  )}
                  <span className="text-[12px] text-ink-muted">{post.author_department} · {timeAgo(post.created_at)}</span>
                </div>
                <div className="mt-1.5">
                  {post.post_subtype === 'discussion' && post.discussion_title && (
                    <p className="mb-1 text-[15px] font-bold text-ink leading-snug">{post.discussion_title}</p>
                  )}
                  {post.content && (
                    <p className="text-[14px] text-ink leading-relaxed">
                      <PostContent content={post.content} />
                    </p>
                  )}
                </div>
                {post.image_url && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-border/60">
                    <img src={post.image_url} alt="Post" className="max-h-80 w-full object-cover" />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-5">
                  <button type="button" onClick={() => handleLike(post.id)}
                    className={cn('flex items-center gap-1.5 text-[13px] transition',
                      post.is_liked ? 'text-rose-500' : 'text-ink-muted hover:text-rose-500')}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                      fill={post.is_liked ? 'currentColor' : 'none'}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    {post.likes_count > 0 && <span>{post.likes_count}</span>}
                  </button>
                  <Link href={`/post/${post.id}`}
                    className="flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-brand-600 transition">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                    </svg>
                    {post.comments_count > 0 && <span>{post.comments_count}</span>}
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
