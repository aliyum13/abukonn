'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
    if (!authLoading && !token) {
      router.push('/login');
    }
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      setError('Failed to delete post');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Create Post */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-[#16a34a] text-white flex items-center justify-center text-sm font-semibold shrink-0">
            {getInitials(user.full_name)}
          </div>
          <form onSubmit={handleCreatePost} className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none text-gray-800 placeholder:text-gray-400"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={posting || !newPost.trim()}
                className="px-5 py-1.5 bg-[#16a34a] hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading feed...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No posts yet</p>
          <p className="text-gray-400 text-sm mt-1">Be the first to share something!</p>
        </div>
      ) : (
        posts.map((post) => (
          <article
            key={post.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 text-[#16a34a] flex items-center justify-center text-sm font-semibold shrink-0">
                {getInitials(post.author_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{post.author_name}</p>
                    <p className="text-xs text-gray-500">
                      {post.author_department} · {timeAgo(post.created_at)}
                    </p>
                  </div>
                  {post.user_id === user.id && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>

                <p className="mt-3 text-gray-800 whitespace-pre-wrap">{post.content}</p>

                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post image"
                    className="mt-3 rounded-lg max-h-80 w-full object-cover"
                  />
                )}

                <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#16a34a] transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    {post.likes_count}
                  </button>
                  <button
                    onClick={() => setCommentingId(commentingId === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#16a34a] transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                    </svg>
                    {post.comments_count}
                  </button>
                </div>

                {commentingId === post.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                    />
                    <button
                      onClick={() => handleComment(post.id)}
                      className="px-3 py-1.5 bg-[#16a34a] text-white text-sm rounded-lg hover:bg-green-700 transition"
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
