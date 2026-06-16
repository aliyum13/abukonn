'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { useFollow } from '@/hooks/useFollow';
import { Avatar, Badge, Button, Card, CardContent, EmptyState, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface UserProfile {
  id: number;
  full_name: string;
  matric_number: string;
  email: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  bio: string | null;
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
}

function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-32 w-full rounded-t-2xl sm:h-44" />
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between">
          <Skeleton className="-mt-10 h-20 w-20 rounded-full ring-4 ring-white" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-muted py-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1 py-1 text-center">
              <Skeleton className="mx-auto h-5 w-8" />
              <Skeleton className="mx-auto h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FollowButton({
  userId,
  initialIsFollowing,
  initialFollowersCount,
  token,
}: {
  userId: number;
  initialIsFollowing: boolean;
  initialFollowersCount: number;
  token: string | null;
}) {
  const { isFollowing, loading, toggle } = useFollow(
    userId,
    initialIsFollowing,
    initialFollowersCount,
    token
  );

  return (
    <Button
      variant={isFollowing ? 'outline' : 'primary'}
      size="sm"
      onClick={toggle}
      loading={loading}
      className={
        isFollowing
          ? 'min-w-[96px] border-border hover:border-red-300 hover:text-red-600'
          : 'min-w-[96px]'
      }
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}

export default function UserProfilePage() {
  const { token, user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (currentUser && userId === String(currentUser.id)) {
      router.replace('/profile');
    }
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
        setProfile(data.user);
        setPosts(data.posts);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, userId]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Card className="overflow-hidden">
          <ProfileSkeleton />
        </Card>
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card>
          <EmptyState
            title="User not found"
            description="This profile doesn't exist or may have been removed."
            action={<Button onClick={() => router.back()} variant="outline">Go Back</Button>}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            }
          />
        </Card>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Card className="overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-brand-600 to-brand-800 sm:h-44" />

        <CardContent className="px-5 pb-6">
          <div className="flex items-end justify-between">
            <div className="-mt-10 rounded-full ring-4 ring-white">
              <Avatar src={profile.profile_photo_url} name={profile.full_name} size="xl" />
            </div>
            <FollowButton
              userId={profile.id}
              initialIsFollowing={profile.is_following}
              initialFollowersCount={profile.followers_count}
              token={token}
            />
          </div>

          <div className="mt-3">
            <h1 className="text-xl font-bold text-ink">{profile.full_name}</h1>
            <p className="text-body-sm text-ink-muted">{profile.matric_number}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="brand">{profile.department}</Badge>
              <Badge variant="default">{profile.level}</Badge>
            </div>
            {profile.bio && (
              <p className="mt-3 text-body-sm text-ink-secondary leading-relaxed">{profile.bio}</p>
            )}
          </div>

          <StatsRow
            postsCount={posts.length}
            userId={profile.id}
            initialFollowersCount={profile.followers_count}
            initialFollowingCount={profile.following_count}
            token={token}
          />
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="mt-5">
        <h2 className="mb-3 text-body-sm font-semibold uppercase tracking-wider text-ink-muted">
          Posts ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <Card>
            <EmptyState
              title="No posts yet"
              description={`${profile.full_name} hasn't posted anything yet.`}
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex gap-3">
                    <Avatar src={profile.profile_photo_url} name={profile.full_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="font-semibold text-ink">{profile.full_name}</p>
                        <p className="text-caption text-ink-muted">{timeAgo(post.created_at)}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink leading-relaxed">
                        {post.content}
                      </p>
                      {post.image_url && (
                        <img src={post.image_url} alt="Post" className="mt-3 max-h-72 w-full rounded-xl object-cover" />
                      )}
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
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-body-sm text-ink-muted transition hover:text-ink"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

// Subcomponent: live follower/following counts (reads from useFollow)
function StatsRow({
  postsCount,
  userId,
  initialFollowersCount,
  initialFollowingCount,
  token,
}: {
  postsCount: number;
  userId: number;
  initialFollowersCount: number;
  initialFollowingCount: number;
  token: string | null;
}) {
  const { followersCount } = useFollow(userId, false, initialFollowersCount, token);
  const [followingCount] = useState(initialFollowingCount);

  return (
    <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-muted py-3">
      <div className="text-center">
        <p className="font-semibold text-ink">{postsCount}</p>
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
  );
}
