'use client';

import { useEffect, useState, FormEvent } from 'react';
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
  Input,
  Skeleton,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
  { href: '/profile', label: 'Profile', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
  { href: '/messages', label: 'Messages', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
  { href: '/news', label: 'News', icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z' },
];

interface SuggestedUser {
  id: number;
  full_name: string;
  matric_number: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
}

const TRENDING = [
  { tag: '#ABUFreshers', posts: '128 posts' },
  { tag: '#ExamSeason', posts: '94 posts' },
  { tag: '#ZariaLife', posts: '76 posts' },
  { tag: '#ABUSports', posts: '52 posts' },
];

interface Post {
  id: number;
  user_id: number;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_name: string;
  author_department: string;
  author_photo: string | null;
  author_matric: string;
}

function PostSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarProfile({
  user,
  postCount,
  followersCount,
  followingCount,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  postCount: number;
  followersCount: number;
  followingCount: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col items-center text-center">
          <Avatar src={user.profile_photo_url} name={user.full_name} size="xl" />
          <h3 className="mt-3 font-semibold text-ink">{user.full_name}</h3>
          <p className="text-caption text-ink-muted">{user.matric_number}</p>
          <Badge variant="brand" className="mt-2">{user.department}</Badge>
        </div>
        <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-muted py-3">
          <div className="text-center">
            <p className="font-semibold text-ink">{postCount}</p>
            <p className="text-caption text-ink-muted">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-ink">{followersCount}</p>
            <p className="text-caption text-ink-muted">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-ink">{followingCount}</p>
            <p className="text-caption text-ink-muted">Following</p>
          </div>
        </div>
        <nav className="mt-5 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium text-ink-secondary transition hover:bg-brand-50 hover:text-brand-700"
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [commentingId, setCommentingId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  const fetchPosts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setPosts(data.posts);
    } catch {
      setError('Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPosts();
  }, [token]);

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !token) return;
    setPosting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newPost }),
      });
      if (!res.ok) throw new Error('Failed to create post');
      setNewPost('');
      await fetchPosts();
    } catch {
      setError('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, likes_count: data.post.likes_count } : p))
        );
      }
    } catch {
      setError('Failed to like post');
    }
  };

  const handleComment = async (postId: number) => {
    if (!commentText.trim() || !token) return;
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: commentText }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, comments_count: data.post.comments_count } : p
          )
        );
        setCommentText('');
        setCommentingId(null);
      }
    } catch {
      setError('Failed to add comment');
    }
  };

  const handleDelete = async (postId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      setError('Failed to delete post');
    }
  };

  const userPostCount = posts.filter((p) => p.user_id === user?.id).length;

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [myFollowersCount, setMyFollowersCount] = useState(0);
  const [myFollowingCount, setMyFollowingCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/follows/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => {});
  }, [token]);

  // Fetch own follower/following counts for the left sidebar
  useEffect(() => {
    if (!token || !user?.id) return;
    fetch(`${API_URL}/api/follows/${user.id}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setMyFollowersCount(d.followers_count ?? 0);
        setMyFollowingCount(d.following_count ?? 0);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const removeSuggestion = (userId: number) =>
    setSuggestions((prev) => prev.filter((s) => s.id !== userId));

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="hidden lg:col-span-3 lg:block"><PostSkeleton /></div>
          <div className="lg:col-span-6 space-y-4">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left sidebar */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-20">
            <SidebarProfile
              user={user}
              postCount={userPostCount}
              followersCount={myFollowersCount}
              followingCount={myFollowingCount}
            />
          </div>
        </aside>

        {/* Center feed */}
        <div className="lg:col-span-6 space-y-4">
          {/* Mobile profile strip */}
          <Card className="lg:hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar src={user.profile_photo_url} name={user.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{user.full_name}</p>
                <p className="text-caption text-ink-muted">{user.matric_number}</p>
              </div>
              <Badge variant="brand">{user.department}</Badge>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">
              {error}
            </div>
          )}

          {/* Composer */}
          <Card>
            <CardContent className="p-5">
              <form onSubmit={handleCreatePost}>
                <div className="flex gap-3">
                  <Avatar src={user.profile_photo_url} name={user.full_name} size="md" className="mt-1" />
                  <div className="flex-1">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="What's happening on campus?"
                      rows={3}
                      className={cn(
                        'w-full resize-none rounded-xl border border-border bg-white px-4 py-3',
                        'text-body-sm text-ink placeholder:text-ink-muted',
                        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                      )}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button type="submit" disabled={posting || !newPost.trim()} loading={posting}>
                        Post
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Posts */}
          {loading ? (
            <div className="space-y-4">
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <EmptyState
                title="No posts yet"
                description="Be the first to share something with the ABU community!"
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                }
              />
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex gap-3">
                    <Avatar src={post.author_photo} name={post.author_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-ink">{post.author_name}</p>
                          <p className="text-caption text-ink-muted">
                            {post.author_department} · {timeAgo(post.created_at)}
                          </p>
                        </div>
                        {post.user_id === user.id && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} className="text-ink-muted hover:text-red-600">
                            Delete
                          </Button>
                        )}
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-body-sm text-ink leading-relaxed">
                        {post.content}
                      </p>

                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt="Post"
                          className="mt-3 max-h-80 w-full rounded-xl object-cover"
                        />
                      )}

                      <div className="mt-4 flex items-center gap-6 border-t border-border pt-3">
                        <button
                          type="button"
                          onClick={() => handleLike(post.id)}
                          className="flex items-center gap-1.5 text-body-sm text-ink-secondary transition hover:text-brand-600"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                          {post.likes_count}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommentingId(commentingId === post.id ? null : post.id)}
                          className="flex items-center gap-1.5 text-body-sm text-ink-secondary transition hover:text-brand-600"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                          </svg>
                          {post.comments_count}
                        </button>
                      </div>

                      {commentingId === post.id && (
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                            className="flex-1"
                          />
                          <Button onClick={() => handleComment(post.id)} size="md">
                            Reply
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right sidebar */}
        <aside className="hidden xl:col-span-3 xl:block">
          <div className="sticky top-20 space-y-4">
            {suggestions.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-ink">Who to follow</h3>
                  <div className="mt-4 space-y-4">
                    {suggestions.map((person) => (
                      <SuggestionRow
                        key={person.id}
                        user={person}
                        token={token}
                        onFollowed={removeSuggestion}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-ink">Trending on campus</h3>
                <div className="mt-4 space-y-3">
                  {TRENDING.map((topic) => (
                    <div key={topic.tag} className="group cursor-pointer rounded-xl px-2 py-1.5 transition hover:bg-surface-muted">
                      <p className="text-body-sm font-medium text-brand-600 group-hover:text-brand-700">
                        {topic.tag}
                      </p>
                      <p className="text-caption text-ink-muted">{topic.posts}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SuggestionRow({
  user,
  token,
  onFollowed,
}: {
  user: SuggestedUser;
  token: string | null;
  onFollowed: (userId: number) => void;
}) {
  const { isFollowing, loading, toggle } = useFollow(user.id, false, 0, token);

  const handleClick = async () => {
    await toggle();
    // Remove from suggestions after a short delay so the button state is visible
    setTimeout(() => onFollowed(user.id), 600);
  };

  return (
    <div className="flex items-center gap-3">
      <Link href={`/profile/${user.id}`}>
        <Avatar src={user.profile_photo_url} name={user.full_name} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/profile/${user.id}`}
          className="block truncate text-body-sm font-medium text-ink hover:text-brand-600"
        >
          {user.full_name}
        </Link>
        <p className="truncate text-caption text-ink-muted">{user.department}</p>
      </div>
      <Button
        variant={isFollowing ? 'secondary' : 'outline'}
        size="sm"
        onClick={handleClick}
        loading={loading}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}
