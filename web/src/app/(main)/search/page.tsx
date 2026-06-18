'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
  Skeleton,
  PostContent,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type Tab = 'all' | 'users' | 'posts' | 'hashtags';

interface SearchUser {
  id: number;
  full_name: string;
  matric_number: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  is_following: boolean;
}

interface SearchPost {
  id: number;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_id: number;
  author_name: string;
  author_department: string;
  author_photo: string | null;
  author_matric: string;
}

interface SearchHashtag {
  tag: string;
  post_count: number;
}

interface SearchResults {
  users: SearchUser[];
  posts: SearchPost[];
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'users',    label: 'Students' },
  { id: 'posts',    label: 'Posts' },
  { id: 'hashtags', label: 'Hashtags' },
];

// ── Skeletons ─────────────────────────────────────────────────────────────────

function UserCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Skeleton className="h-12 w-12 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-8 w-20 rounded-xl" />
      </CardContent>
    </Card>
  );
}

function PostCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HashtagSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-8 w-20 rounded-full" />
    </div>
  );
}

// ── Result cards ──────────────────────────────────────────────────────────────

function UserCard({ user, token }: { user: SearchUser; token: string | null }) {
  const { isFollowing, loading, toggle } = useFollow(user.id, user.is_following, 0, token);
  const [hovered, setHovered] = useState(false);

  return (
    <Card className="transition hover:shadow-md dark:hover:shadow-none dark:hover:border-[#333]">
      <CardContent className="flex items-center gap-4 p-5">
        <Link href={`/profile/${user.id}`}>
          <Avatar src={user.profile_photo_url} name={user.full_name} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${user.id}`} className="font-semibold text-ink transition hover:text-brand-600">
            {user.full_name}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="brand">{user.department}</Badge>
            <Badge variant="default">{user.level}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/messages?userId=${user.id}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-1" title="Message">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <span className="hidden sm:inline">Message</span>
            </Button>
          </Link>
          <Button
            variant={isFollowing ? 'outline' : 'primary'}
            size="sm"
            className={cn(
              'min-w-[80px]',
              isFollowing && hovered ? 'border-red-300 text-red-600' : ''
            )}
            onClick={toggle}
            loading={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {isFollowing ? (hovered ? 'Unfollow' : 'Following') : 'Follow'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post }: { post: SearchPost }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex gap-3">
          <Link href={`/profile/${post.user_id}`}>
            <Avatar src={post.author_photo} name={post.author_name} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link href={`/profile/${post.user_id}`} className="font-semibold text-ink hover:text-brand-600 hover:underline">
                {post.author_name}
              </Link>
              <span className="text-caption text-ink-muted">
                {post.author_department} · {timeAgo(post.created_at)}
              </span>
            </div>
            <p className="mt-2 text-body-sm text-ink leading-relaxed">
              <PostContent content={post.content} />
            </p>
            <div className="mt-3 flex items-center gap-5 text-caption text-ink-muted">
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {post.likes_count}
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                </svg>
                {post.comments_count}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HashtagCard({ hashtag }: { hashtag: SearchHashtag }) {
  return (
    <Link href={`/hashtag/${hashtag.tag}`}>
      <div className="flex items-center gap-3 rounded-2xl border border-border dark:border-[#222] px-4 py-3.5 transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a] hover:border-brand-200 dark:hover:border-brand-800 group">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 text-[18px] font-bold">
          #
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px] text-ink group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
            #{hashtag.tag}
          </p>
          <p className="text-[13px] text-ink-muted">
            {hashtag.post_count.toLocaleString()} post{hashtag.post_count !== 1 ? 's' : ''}
          </p>
        </div>
        <svg className="h-4 w-4 text-ink-muted opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

// ── Main search component ─────────────────────────────────────────────────────

function SearchResults() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  const [tab, setTab] = useState<Tab>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [hashtags, setHashtags] = useState<SearchHashtag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  const fetchResults = useCallback(
    async (query: string) => {
      if (!query.trim() || !token) return;
      setLoading(true);
      try {
        const [searchRes, hashtagRes] = await Promise.all([
          fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}&type=all`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/hashtags/search?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (searchRes.ok) {
          const data = await searchRes.json();
          setResults(data);
        }
        if (hashtagRes.ok) {
          const data = await hashtagRes.json();
          setHashtags(data.hashtags ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (q && token) fetchResults(q);
  }, [q, token, fetchResults]);

  const users = results?.users ?? [];
  const posts = results?.posts ?? [];

  const showUsers    = tab === 'all' || tab === 'users';
  const showPosts    = tab === 'all' || tab === 'posts';
  const showHashtags = tab === 'all' || tab === 'hashtags';

  const filteredUsers    = showUsers    ? users    : [];
  const filteredPosts    = showPosts    ? posts    : [];
  const filteredHashtags = showHashtags ? hashtags : [];
  const filteredTotal    = filteredUsers.length + filteredPosts.length + filteredHashtags.length;

  const tabCount = (t: Tab) => {
    if (t === 'users')    return users.length;
    if (t === 'posts')    return posts.length;
    if (t === 'hashtags') return hashtags.length;
    return users.length + posts.length + hashtags.length;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">
          {q ? (
            <>Results for <span className="text-brand-600">&ldquo;{q}&rdquo;</span></>
          ) : 'Search'}
        </h1>
        {!loading && (results || hashtags.length > 0) && q && (
          <p className="mt-1 text-body-sm text-ink-muted">
            {filteredTotal === 0 ? 'No results' : `${filteredTotal} result${filteredTotal !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Tabs */}
      {q && (
        <div className="mb-5 flex gap-1 rounded-xl bg-surface-muted dark:bg-[#1a1a1a] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 rounded-lg py-2 text-body-sm font-medium transition',
                tab === t.id
                  ? 'bg-white dark:bg-[#111] text-brand-700 dark:text-brand-400 shadow-sm'
                  : 'text-ink-secondary hover:text-ink'
              )}
            >
              {t.label}
              {!loading && results && t.id !== 'all' && (
                <span className="ml-1 text-caption text-ink-muted">({tabCount(t.id)})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty query state */}
      {!q && (
        <Card>
          <EmptyState
            title="Search ABUkonn"
            description="Find students, posts, or hashtags."
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </Card>
      )}

      {/* Loading */}
      {loading && q && (
        <div className="space-y-4">
          {showUsers    && <><Skeleton className="h-4 w-20" /><UserCardSkeleton /><UserCardSkeleton /></>}
          {showPosts    && <><Skeleton className="h-4 w-16 mt-2" /><PostCardSkeleton /><PostCardSkeleton /></>}
          {showHashtags && <><Skeleton className="h-4 w-20 mt-2" /><HashtagSkeleton /><HashtagSkeleton /></>}
        </div>
      )}

      {/* Results */}
      {!loading && (results || hashtags.length > 0) && q && (
        <>
          {filteredTotal === 0 ? (
            <Card>
              <EmptyState
                title="No results found"
                description={`Nothing matched "${q}". Try a different search.`}
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                }
              />
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Hashtags */}
              {filteredHashtags.length > 0 && (
                <section>
                  {tab === 'all' && (
                    <h2 className="mb-3 text-body-sm font-semibold uppercase tracking-wider text-ink-muted">
                      Hashtags ({hashtags.length})
                    </h2>
                  )}
                  <div className="space-y-2">
                    {filteredHashtags.map(h => (
                      <HashtagCard key={h.tag} hashtag={h} />
                    ))}
                  </div>
                </section>
              )}

              {/* Students */}
              {filteredUsers.length > 0 && (
                <section>
                  {tab === 'all' && (
                    <h2 className="mb-3 text-body-sm font-semibold uppercase tracking-wider text-ink-muted">
                      Students ({users.length})
                    </h2>
                  )}
                  <div className="space-y-3">
                    {filteredUsers.map(u => (
                      <UserCard key={u.id} user={u} token={token} />
                    ))}
                  </div>
                </section>
              )}

              {/* Posts */}
              {filteredPosts.length > 0 && (
                <section>
                  {tab === 'all' && (
                    <h2 className="mb-3 text-body-sm font-semibold uppercase tracking-wider text-ink-muted">
                      Posts ({posts.length})
                    </h2>
                  )}
                  <div className="space-y-3">
                    {filteredPosts.map(p => (
                      <PostCard key={p.id} post={p} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mb-5 flex gap-1 rounded-xl bg-surface-muted p-1">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 flex-1 rounded-lg" />)}
          </div>
          <div className="space-y-3">
            <UserCardSkeleton />
            <PostCardSkeleton />
            <HashtagSkeleton />
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
