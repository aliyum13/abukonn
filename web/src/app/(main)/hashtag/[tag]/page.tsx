'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Button, Skeleton, PostContent, RoleBadge } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface HashtagMeta {
  tag: string;
  post_count: number;
}

interface HashtagPost {
  id: number;
  user_id: number;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  repost_count: number;
  view_count: number;
  category: string;
  is_repost: boolean;
  original_author_name: string | null;
  created_at: string;
  author_name: string;
  author_department: string;
  author_photo: string | null;
  author_role?: string;
  is_liked: boolean;
}

function PostSkeleton() {
  return (
    <div className="border-b border-border px-4 py-4 dark:border-[#222]">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-24 mt-1" />
        </div>
      </div>
    </div>
  );
}

export default function HashtagPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tag = (params.tag as string).toLowerCase();

  const [meta, setMeta] = useState<HashtagMeta | null>(null);
  const [posts, setPosts] = useState<HashtagPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token || !tag) return;
    setLoading(true);
    fetch(`${API_URL}/api/hashtags/${encodeURIComponent(tag)}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setMeta(d.meta ?? { tag, post_count: d.posts?.length ?? 0 });
        setPosts(d.posts ?? []);
        const liked = new Set<number>(
          (d.posts ?? []).filter((p: HashtagPost) => p.is_liked).map((p: HashtagPost) => p.id)
        );
        setLikedIds(liked);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, tag]);

  async function toggleLike(postId: number) {
    if (!token) return;
    const wasLiked = likedIds.has(postId);
    setLikedIds(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 } : p
    ));
    try {
      await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // revert on error
      setLikedIds(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* ── Header ── */}
      <div className="sticky top-14 z-10 border-b border-border bg-white/95 dark:bg-[#0a0a0a]/95 dark:border-[#222] backdrop-blur-sm">
        <div className="flex h-12 items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-[16px] text-ink">#{tag}</h1>
            {meta && (
              <p className="text-[12px] text-ink-muted leading-none">
                {meta.post_count.toLocaleString()} post{meta.post_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Hashtag hero strip */}
        <div className="flex items-center gap-3 bg-brand-50 dark:bg-brand-950/30 px-4 py-3 border-t border-brand-100 dark:border-brand-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white text-[18px] font-bold shrink-0">
            #
          </div>
          <div>
            <p className="font-bold text-[17px] text-ink">#{tag}</p>
            {!loading && (
              <p className="text-[13px] text-ink-muted">
                {posts.length > 0
                  ? `${posts.length} post${posts.length !== 1 ? 's' : ''} use this hashtag`
                  : 'No posts yet'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Posts ── */}
      {loading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/30">
            <span className="text-3xl font-bold text-brand-600">#</span>
          </div>
          <p className="font-semibold text-[17px] text-ink">No posts yet</p>
          <p className="mt-1.5 text-[14px] text-ink-muted max-w-xs">
            Be the first to use <span className="font-medium text-brand-600">#{tag}</span> in a post!
          </p>
          <Link href="/feed" className="mt-5">
            <Button variant="primary" size="sm" className="rounded-full px-6">Go to Feed</Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border dark:divide-[#222]">
          {posts.map(post => (
            <article key={post.id} className="px-4 py-4 transition hover:bg-gray-50/40 dark:hover:bg-white/[0.02]">
              <div className="flex gap-3">
                <Link href={`/profile/${post.user_id}`} className="shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
                    <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[1.5px]">
                      <Avatar src={post.author_photo} name={post.author_name} size="md" className="h-full w-full" />
                    </div>
                  </div>
                </Link>

                <div className="min-w-0 flex-1">
                  {/* Author row */}
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <Link href={`/profile/${post.user_id}`} className="font-semibold text-[14px] text-ink hover:underline">
                      {post.author_name}
                    </Link>
                    <RoleBadge role={post.author_role || 'user'} iconOnly />
                    <span className="text-[12px] text-ink-muted">·</span>
                    <span className="text-[12px] text-ink-muted">{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-[12px] text-ink-muted">{post.author_department}</p>

                  {/* Content */}
                  <p className="mt-2 text-[15px] leading-[1.6] text-ink">
                    <PostContent content={post.content} />
                  </p>

                  {/* Image */}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="mt-3 max-h-80 w-full rounded-2xl border border-border/60 object-cover"
                    />
                  )}

                  {/* Action bar */}
                  <div className="mt-3 flex items-center gap-5 text-[13px] text-ink-muted">
                    {/* Like */}
                    <button
                      type="button"
                      onClick={() => toggleLike(post.id)}
                      className={cn(
                        'flex items-center gap-1.5 transition hover:text-red-500',
                        likedIds.has(post.id) && 'text-red-500'
                      )}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                        fill={likedIds.has(post.id) ? 'currentColor' : 'none'}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                      {post.likes_count}
                    </button>

                    {/* Comment */}
                    <Link href={`/feed?openComments=${post.id}`} className="flex items-center gap-1.5 transition hover:text-brand-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                      </svg>
                      {post.comments_count}
                    </Link>

                    {/* Views */}
                    <span className="flex items-center gap-1.5 ml-auto">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {post.view_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
