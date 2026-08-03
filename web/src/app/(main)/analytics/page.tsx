'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { Skeleton, EmptyState, PostContent } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PostAnalytics {
  id: number;
  content: string;
  image_url: string | null;
  created_at: string;
  view_count: number;
  unique_viewers: number;
  likes_count: number;
  comments_count: number;
  repost_count: number;
}

// Aggregate stats per post -- view count, unique viewers, likes/comments/
// reposts. Deliberately NOT a per-viewer identity list (confirmed with Ali:
// unlike profile views, a post can rack up hundreds of views, so a full
// viewer roster is a heavier privacy ask and isn't what "analytics" means on
// comparable platforms). Pro perk; free/ungated for now like every candidate
// (the gate is the marked insertion point in the backend's getPostAnalytics,
// not touched here).
export default function PostAnalyticsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<PostAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/posts/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPosts(d.analytics || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur dark:border-[#222]">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-surface-muted"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="flex-1 text-[17px] font-semibold text-ink">Post analytics</h1>
      </div>

      <div className="mx-auto max-w-lg">
        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3 px-4 py-4">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Once you post, you'll see views, likes, and comments for each one here."
          />
        ) : (
          <div className="divide-y divide-border dark:divide-[#222]">
            {posts.map(post => (
              <button
                key={post.id}
                type="button"
                onClick={() => router.push(`/post/${post.id}`)}
                className="block w-full px-4 py-4 text-left transition hover:bg-surface-muted"
              >
                <div className="flex gap-3">
                  {post.image_url && (
                    <img src={post.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    {post.content ? (
                      <p className="line-clamp-2 text-[14px] text-ink">
                        <PostContent content={post.content} />
                      </p>
                    ) : (
                      <p className="text-[14px] italic text-ink-muted">No caption</p>
                    )}
                    <p className="mt-0.5 text-[12px] text-ink-muted">{timeAgo(post.created_at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-5 text-[13px] text-ink-secondary">
                  <span><strong className="font-semibold text-ink">{post.view_count}</strong> views</span>
                  <span><strong className="font-semibold text-ink">{post.unique_viewers}</strong> unique</span>
                  <span><strong className="font-semibold text-ink">{post.likes_count}</strong> likes</span>
                  <span><strong className="font-semibold text-ink">{post.comments_count}</strong> comments</span>
                  {post.repost_count > 0 && (
                    <span><strong className="font-semibold text-ink">{post.repost_count}</strong> reposts</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
