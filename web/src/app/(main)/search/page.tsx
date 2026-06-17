'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { useFollow } from '@/hooks/useFollow';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type Tab = 'all' | 'users' | 'posts';

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

interface SearchResults {
  users: SearchUser[];
  posts: SearchPost[];
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'users', label: 'Students' },
  { id: 'posts', label: 'Posts' },
];

function UserCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Skeleton className="h-12 w-12 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-52" />
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

function UserCard({ user, token }: { user: SearchUser; token: string | null }) {
  const { isFollowing, loading, toggle } = useFollow(
    user.id,
    user.is_following,
    0,
    token
  );

  return (
    <Card className="transition hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <Link href={`/profile/${user.id}`}>
          <Avatar src={user.profile_photo_url} name={user.full_name} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${user.id}`}
            className="font-semibold text-ink transition hover:text-brand-600"
          >
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
            className={`min-w-[80px] ${isFollowing ? 'hover:border-red-300 hover:text-red-600' : ''}`}
            onClick={toggle}
            loading={loading}
          >
            {isFollowing ? 'Following' : 'Follow'}
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
          <Avatar src={post.author_photo} name={post.author_name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="font-semibold text-ink">{post.author_name}</p>
              <p className="text-caption text-ink-muted">
                {post.author_department} · {timeAgo(post.created_at)}
              </p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink leading-relaxed">
              {post.content}
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

function SearchResults() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  const [tab, setTab] = useState<Tab>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  const fetchResults = useCallback(
    async (query: string, type: Tab) => {
      if (!query.trim() || !token) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(query)}&type=${type}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
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
    if (q && token) fetchResults(q, tab);
  }, [q, tab, token, fetchResults]);

  const users = results?.users ?? [];
  const posts = results?.posts ?? [];
  const totalCount = users.length + posts.length;

  const showUsers = tab === 'all' || tab === 'users';
  const showPosts = tab === 'all' || tab === 'posts';
  const filteredUsers = showUsers ? users : [];
  const filteredPosts = showPosts ? posts : [];
  const filteredTotal = filteredUsers.length + filteredPosts.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">
          {q ? (
            <>
              Results for{' '}
              <span className="text-brand-600">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        {!loading && results && q && (
          <p className="mt-1 text-body-sm text-ink-muted">
            {totalCount === 0
              ? 'No results found'
              : `${totalCount} result${totalCount !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Tabs */}
      {q && (
        <div className="mb-5 flex gap-1 rounded-xl bg-surface-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-body-sm font-medium transition ${
                tab === t.id
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {t.label}
              {!loading && results && t.id !== 'all' && (
                <span className="ml-1.5 text-caption text-ink-muted">
                  ({t.id === 'users' ? users.length : posts.length})
                </span>
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
            description="Find students by name or department, or search through posts."
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </Card>
      )}

      {/* Loading skeletons */}
      {loading && q && (
        <div className="space-y-4">
          {showUsers && (
            <>
              <Skeleton className="h-4 w-20" />
              <UserCardSkeleton />
              <UserCardSkeleton />
            </>
          )}
          {showPosts && (
            <>
              <Skeleton className="h-4 w-16 mt-2" />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          )}
        </div>
      )}

      {/* Results */}
      {!loading && results && q && (
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
              {/* Students section */}
              {filteredUsers.length > 0 && (
                <section>
                  {tab === 'all' && (
                    <h2 className="mb-3 text-body-sm font-semibold uppercase tracking-wider text-ink-muted">
                      Students ({users.length})
                    </h2>
                  )}
                  <div className="space-y-3">
                    {filteredUsers.map((u) => (
                      <UserCard key={u.id} user={u} token={token} />
                    ))}
                  </div>
                </section>
              )}

              {/* Posts section */}
              {filteredPosts.length > 0 && (
                <section>
                  {tab === 'all' && (
                    <h2 className="mb-3 text-body-sm font-semibold uppercase tracking-wider text-ink-muted">
                      Posts ({posts.length})
                    </h2>
                  )}
                  <div className="space-y-3">
                    {filteredPosts.map((p) => (
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
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 flex-1 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            <UserCardSkeleton />
            <UserCardSkeleton />
            <PostCardSkeleton />
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
