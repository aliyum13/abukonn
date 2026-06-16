import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useFollow(
  userId: number,
  initialIsFollowing: boolean,
  initialFollowersCount: number,
  token: string | null
) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!token || loading) return;

    // Optimistic update
    const wasFollowing = isFollowing;
    const prevCount = followersCount;
    setIsFollowing(!wasFollowing);
    setFollowersCount(wasFollowing ? followersCount - 1 : followersCount + 1);

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/follows/${userId}`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFollowersCount(data.followers_count);
      } else {
        // Revert on error
        setIsFollowing(wasFollowing);
        setFollowersCount(prevCount);
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowersCount(prevCount);
    } finally {
      setLoading(false);
    }
  }, [token, loading, isFollowing, followersCount, userId]);

  return { isFollowing, followersCount, loading, toggle };
}
