'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Avatar,
  Button,
  Input,
  Skeleton,
  RoleBadge,
  PostContent,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type PostCategory = 'GENERAL' | 'EXAMINATION' | 'REGISTRATION' | 'ACADEMIC' | 'SPORTS' | 'EVENTS' | 'CAMPUS_LIFE';

const POST_CATEGORIES = [
  { value: 'GENERAL',      label: 'General' },
  { value: 'EXAMINATION',  label: 'Examination' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'ACADEMIC',     label: 'Academic' },
  { value: 'SPORTS',       label: 'Sports' },
  { value: 'EVENTS',       label: 'Events' },
  { value: 'CAMPUS_LIFE',  label: 'Campus Life' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  EXAMINATION:  'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  REGISTRATION: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  ACADEMIC:     'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  SPORTS:       'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  EVENTS:       'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  CAMPUS_LIFE:  'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
};

interface Post {
  id: number;
  user_id: number;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  repost_count: number;
  view_count: number;
  category: PostCategory;
  is_liked: boolean;
  is_repost: boolean;
  original_post_id: number | null;
  original_author_name: string | null;
  is_following_author: boolean;
  created_at: string;
  author_name: string;
  author_department: string;
  author_photo: string | null;
  author_matric: string;
  author_role?: string;
  engagement_score?: number;
  is_trending?: boolean;
  is_hot?: boolean;
  comment_velocity?: number;
}

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  author_name: string;
  author_photo: string | null;
  reply_count: number;
}

interface Reply {
  id: number;
  comment_id: number;
  user_id: number;
  content: string;
  created_at: string;
  author_name: string;
  author_photo: string | null;
}

interface ShareFollower {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string;
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const postId = Number(params.id);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');

  const [replies, setReplies] = useState<Record<number, Reply[]>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<number, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const postMenuRef = useRef<HTMLDivElement>(null);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFollowers, setShareFollowers] = useState<ShareFollower[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSentIds, setShareSentIds] = useState<Set<number>>(new Set());
  const [shareSendingId, setShareSendingId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) {
        setPostMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!token || !postId) return;
    fetch(`${API_URL}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) { setNotFound(true); return null; }
        return res.json();
      })
      .then(data => { if (data) setPost(data.post); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [postId, token]);

  useEffect(() => {
    if (!token || !postId || loading) return;
    setCommentsLoading(true);
    fetch(`${API_URL}/api/posts/${postId}/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setComments(data.comments || []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [postId, token, loading]);

  useEffect(() => {
    if (!token || !postId || loading || notFound) return;
    fetch(`${API_URL}/api/posts/${postId}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [postId, token, loading, notFound]);

  const handleLike = async () => {
    if (!token || !post) return;
    setPost(p => p ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    try {
      const res = await fetch(`${API_URL}/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPost(p => p ? { ...p, likes_count: data.post.likes_count, is_liked: data.is_liked } : p);
      } else {
        setPost(p => p ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p);
      }
    } catch {
      setPost(p => p ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !token || !user || !post) return;
    const text = commentText.trim();
    const tempComment: Comment = {
      id: -Date.now(),
      post_id: post.id,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      author_name: user.full_name,
      author_photo: user.profile_photo_url,
      reply_count: 0,
    };
    setComments(prev => [...prev, tempComment]);
    setCommentText('');
    try {
      const res = await fetch(`${API_URL}/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setPost(p => p ? { ...p, comments_count: data.post.comments_count } : p);
        setComments(prev => [...prev.filter(c => c.id !== tempComment.id), data.comment]);
      } else {
        setComments(prev => prev.filter(c => c.id !== tempComment.id));
        setCommentText(text);
      }
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      setCommentText(text);
    }
  };

  const handleDelete = async () => {
    if (!token || !post) return;
    try {
      const res = await fetch(`${API_URL}/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) router.replace('/feed');
    } catch {}
  };

  const fetchReplies = async (commentId: number) => {
    if (!token || repliesLoading[commentId]) return;
    setRepliesLoading(prev => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/replies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReplies(prev => ({ ...prev, [commentId]: data.replies || [] }));
      setExpandedReplies(prev => new Set([...prev, commentId]));
    } catch {}
    finally { setRepliesLoading(prev => ({ ...prev, [commentId]: false })); }
  };

  const toggleReplies = (commentId: number) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => { const n = new Set(prev); n.delete(commentId); return n; });
    } else if (replies[commentId] !== undefined) {
      setExpandedReplies(prev => new Set([...prev, commentId]));
    } else {
      fetchReplies(commentId);
    }
  };

  const handleReply = async (commentId: number) => {
    if (!replyText.trim() || !token || !user) return;
    const text = replyText.trim();
    const tempReply: Reply = {
      id: -Date.now(),
      comment_id: commentId,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      author_name: user.full_name,
      author_photo: user.profile_photo_url,
    };
    setReplies(prev => ({ ...prev, [commentId]: [...(prev[commentId] ?? []), tempReply] }));
    setExpandedReplies(prev => new Set([...prev, commentId]));
    setReplyingTo(null);
    setReplyText('');
    setComments(prev =>
      prev.map(c => c.id === commentId ? { ...c, reply_count: (c.reply_count ?? 0) + 1 } : c)
    );
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies(prev => ({
          ...prev,
          [commentId]: [...(prev[commentId] ?? []).filter(r => r.id !== tempReply.id), data.reply],
        }));
      } else {
        setReplies(prev => ({
          ...prev,
          [commentId]: (prev[commentId] ?? []).filter(r => r.id !== tempReply.id),
        }));
        setReplyingTo(commentId);
        setReplyText(text);
      }
    } catch {
      setReplies(prev => ({
        ...prev,
        [commentId]: (prev[commentId] ?? []).filter(r => r.id !== tempReply.id),
      }));
      setReplyingTo(commentId);
      setReplyText(text);
    }
  };

  const openShareModal = async () => {
    if (!token || !user) return;
    setShareModalOpen(true);
    setShareSearch('');
    setShareSentIds(new Set());
    setShareLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/follows/${user.id}/following`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setShareFollowers(data.following || []);
    } catch { setShareFollowers([]); }
    finally { setShareLoading(false); }
  };

  const handleShareToUser = async (recipientId: number) => {
    if (!post || !token || shareSendingId !== null) return;
    setShareSendingId(recipientId);
    try {
      const convRes = await fetch(`${API_URL}/api/messages/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      if (!convRes.ok) throw new Error('Failed');
      const { conversation } = await convRes.json();
      const content = JSON.stringify({
        type: 'shared_post',
        post_id: post.id,
        author_name: post.author_name,
        content: post.content,
        image_url: post.image_url ?? null,
      });
      await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: conversation.id, content }),
      });
      setShareSentIds(prev => new Set([...prev, recipientId]));
    } catch {}
    finally { setShareSendingId(null); }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  };

  if (authLoading || (loading && !notFound)) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-white/90 backdrop-blur-sm px-4 py-3 dark:bg-[#0a0a0a]/90 dark:border-[#222]">
          <div className="h-9 w-9 rounded-full bg-surface-muted animate-pulse" />
          <div className="h-5 w-16 rounded bg-surface-muted animate-pulse" />
        </div>
        <div className="px-4 py-4 border-b border-border dark:border-[#222]">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-16 w-full" />
              <div className="flex justify-between pt-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-7 w-7" rounded="full" />)}
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 pt-5 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="h-8 w-8 shrink-0" rounded="full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-medium text-ink">Post not found</p>
        <p className="mt-1 text-[14px] text-ink-muted">This post may have been deleted.</p>
        <button type="button" onClick={() => router.back()}
          className="mt-4 text-[14px] font-medium text-brand-600 hover:underline">
          ← Go back
        </button>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-white/90 backdrop-blur-sm px-4 py-3 dark:bg-[#0a0a0a]/90 dark:border-[#222]">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]"
          aria-label="Go back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-[17px] font-semibold text-ink">Post</h1>
      </div>

      {/* Post */}
      <article className="border-b border-border px-4 py-4 dark:border-[#222]">
        {/* Repost label */}
        {post.is_repost && (
          <div className="mb-2 ml-11 flex items-center gap-1.5 text-[12px] text-ink-muted">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
            {post.author_name} reposted
          </div>
        )}

        <div className="flex gap-3">
          {/* Avatar */}
          <Link href={`/profile/${post.user_id}`} className="shrink-0">
            <Avatar src={post.author_photo} name={post.author_name} size="md" className="mt-0.5" />
          </Link>

          {/* Post body */}
          <div className="min-w-0 flex-1">
            {/* Author row */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/profile/${post.user_id}`}
                    className="font-semibold text-[15px] text-ink hover:underline">
                    {post.author_name}
                  </Link>
                  <RoleBadge role={post.author_role || 'user'} iconOnly />
                  {post.category && post.category !== 'GENERAL' && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600')}>
                      {POST_CATEGORIES.find(c => c.value === post.category)?.label}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-ink-muted">
                  {post.author_department} · {timeAgo(post.created_at)}
                </p>
              </div>

              {/* ⋮ menu */}
              <div className="relative shrink-0" ref={postMenuRef}>
                <button type="button"
                  onClick={() => setPostMenuOpen(o => !o)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {postMenuOpen && (
                  <div className="absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:bg-[#111] dark:border-[#222]">
                    {post.user_id === user.id && (
                      <button type="button"
                        onClick={() => { handleDelete(); setPostMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Delete post
                      </button>
                    )}
                    <button type="button" onClick={() => setPostMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-ink-secondary hover:bg-surface-muted transition">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 011.743-1.342 48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664L19.5 19.5" />
                      </svg>
                      Report post
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Full content — no truncation */}
            <div className="mt-2">
              <p className="text-[15px] text-ink leading-[1.6]">
                <PostContent content={post.content} />
              </p>
            </div>

            {/* Post image */}
            {post.image_url && (
              <button type="button" onClick={() => setLightboxUrl(post.image_url)}
                className="mt-3 block w-full overflow-hidden rounded-2xl border border-border/60">
                <img src={post.image_url} alt="Post" className="max-h-[400px] w-full object-cover transition hover:opacity-95" />
              </button>
            )}

            {/* Action row */}
            <div className="mt-3 flex items-center justify-between">
              {/* Like */}
              <button type="button" onClick={handleLike}
                className={cn('group flex items-center gap-1 text-[13px] transition',
                  post.is_liked ? 'text-rose-500' : 'text-ink-muted hover:text-rose-500')}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-rose-50 dark:group-hover:bg-rose-950">
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                    fill={post.is_liked ? 'currentColor' : 'none'}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </span>
                {post.likes_count > 0 && <span>{post.likes_count}</span>}
              </button>

              {/* Comment indicator (always active since comments are always shown) */}
              <span className={cn('flex items-center gap-1 text-[13px]',
                comments.length > 0 ? 'text-brand-600' : 'text-ink-muted')}>
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-full',
                  comments.length > 0 ? 'bg-brand-50 dark:bg-brand-950' : '')}>
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                  </svg>
                </span>
                {post.comments_count > 0 && <span>{post.comments_count}</span>}
              </span>

              {/* Repost count (display only on detail page) */}
              {post.user_id !== user.id ? (
                <span className="flex items-center gap-1 text-[13px] text-ink-muted">
                  <span className="flex h-8 w-8 items-center justify-center">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                    </svg>
                  </span>
                  {post.repost_count > 0 && <span>{post.repost_count}</span>}
                </span>
              ) : <span className="w-9" />}

              {/* Share */}
              <button type="button" onClick={openShareModal}
                className="group flex items-center gap-1 text-[13px] text-ink-muted transition hover:text-brand-600">
                <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-brand-50 dark:group-hover:bg-brand-950">
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </span>
              </button>

              {/* Views */}
              <span className="flex items-center gap-1 text-[13px] text-ink-muted">
                <span className="flex h-8 w-8 items-center justify-center">
                  <svg className="h-[16px] w-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </span>
                {post.view_count > 0 ? post.view_count.toLocaleString() : '0'}
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* Comments section — always expanded */}
      <div className="px-4 pt-5 pb-8">
        {/* Comment input */}
        <div className="mb-5 flex gap-2">
          <Avatar src={user.profile_photo_url} name={user.full_name} size="sm" className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              className="flex-1"
            />
            <Button onClick={handleComment} size="sm" disabled={!commentText.trim()}>Post</Button>
          </div>
        </div>

        {/* Comment list */}
        {commentsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="h-8 w-8 shrink-0" rounded="full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-caption text-ink-muted">No comments yet — be the first!</p>
        ) : (
          <div className="space-y-4">
            {comments.map(c => (
              <div key={c.id}>
                <div className="flex gap-2.5">
                  <Avatar src={c.author_photo} name={c.author_name} size="sm" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-xl bg-surface-muted px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-body-sm font-semibold text-ink">{c.author_name}</span>
                        <span className="text-caption text-ink-muted">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-body-sm text-ink leading-relaxed">{c.content}</p>
                    </div>

                    {/* Reply controls */}
                    <div className="ml-2 mt-1 flex items-center gap-3">
                      <button type="button"
                        onClick={() => {
                          if (replyingTo === c.id) { setReplyingTo(null); }
                          else { setReplyingTo(c.id); setReplyText(''); }
                        }}
                        className="text-caption font-medium text-ink-secondary transition hover:text-brand-600">
                        Reply
                      </button>
                      {(c.reply_count > 0 || (replies[c.id]?.length ?? 0) > 0) && (
                        <button type="button"
                          onClick={() => toggleReplies(c.id)}
                          className="text-caption text-ink-muted transition hover:text-brand-600">
                          {expandedReplies.has(c.id)
                            ? 'Hide replies'
                            : `View ${c.reply_count > 0 ? c.reply_count : replies[c.id]?.length} ${(c.reply_count === 1 || replies[c.id]?.length === 1) ? 'reply' : 'replies'}`}
                        </button>
                      )}
                    </div>

                    {/* Reply input */}
                    {replyingTo === c.id && (
                      <div className="ml-2 mt-2 flex gap-2">
                        <Avatar src={user.profile_photo_url} name={user.full_name} size="sm" className="shrink-0" />
                        <div className="flex min-w-0 flex-1 gap-2">
                          <Input
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder={`Reply to ${c.author_name}…`}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(c.id); } }}
                            className="flex-1 text-sm"
                          />
                          <Button onClick={() => handleReply(c.id)} size="sm" disabled={!replyText.trim()}>Post</Button>
                        </div>
                      </div>
                    )}

                    {/* Expanded replies */}
                    {expandedReplies.has(c.id) && (
                      <div className="ml-6 mt-2 space-y-2 border-l-2 border-border pl-3">
                        {repliesLoading[c.id] ? (
                          <div className="space-y-2 py-1">
                            {[1, 2].map(i => (
                              <div key={i} className="flex gap-2">
                                <Skeleton className="h-6 w-6 shrink-0" rounded="full" />
                                <div className="flex-1 space-y-1">
                                  <Skeleton className="h-3 w-20" />
                                  <Skeleton className="h-3 w-full" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (replies[c.id] ?? []).length === 0 ? (
                          <p className="py-1 text-caption text-ink-muted">No replies yet.</p>
                        ) : (
                          (replies[c.id] ?? []).map(r => (
                            <div key={r.id} className="flex gap-2">
                              <Avatar src={r.author_photo} name={r.author_name} size="sm" className="h-6 w-6 shrink-0" />
                              <div className="rounded-lg bg-surface-subtle px-2.5 py-1.5">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-caption font-semibold text-ink">{r.author_name}</span>
                                  <span className="text-[10px] text-ink-muted">{timeAgo(r.created_at)}</span>
                                </div>
                                <p className="mt-0.5 text-caption text-ink leading-relaxed">{r.content}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
          onClick={e => { if (e.target === e.currentTarget) setShareModalOpen(false); }}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#111] dark:border dark:border-[#222]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#222]">
              <h3 className="font-semibold text-ink">Share Post</h3>
              <button type="button" onClick={() => setShareModalOpen(false)}
                className="rounded-lg p-1 text-ink-secondary hover:bg-surface-muted">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Post preview */}
            <div className="border-b border-border bg-surface-muted px-5 py-3 dark:border-[#222]">
              <p className="line-clamp-2 text-caption text-ink-secondary">{post.content}</p>
            </div>

            {/* Copy link */}
            <div className="border-b border-border px-5 py-3 dark:border-[#222]">
              <button type="button" onClick={handleCopyLink}
                className={cn('flex w-full items-center gap-3 rounded-xl border border-border px-4 py-2.5 text-left transition hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30',
                  shareCopied && 'border-brand-600 bg-brand-50 dark:bg-brand-950/30')}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950">
                  <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <span className={cn('text-body-sm font-medium', shareCopied ? 'text-brand-600' : 'text-ink')}>
                  {shareCopied ? '✓ Link copied!' : 'Copy link'}
                </span>
              </button>
            </div>

            {/* Share to followers */}
            <div className="px-5 py-3">
              <p className="mb-2.5 text-body-sm font-medium text-ink">Share to…</p>
              <Input
                value={shareSearch}
                onChange={e => setShareSearch(e.target.value)}
                placeholder="Search people you follow…"
                className="mb-2"
              />
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border dark:border-[#222]">
                {shareLoading ? (
                  <div className="space-y-0 py-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <Skeleton className="h-9 w-9 shrink-0" rounded="full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : shareFollowers.filter(f => f.full_name.toLowerCase().includes(shareSearch.toLowerCase())).length === 0 ? (
                  <p className="py-8 text-center text-caption text-ink-muted">
                    {shareSearch ? 'No results' : 'Follow people to share posts with them'}
                  </p>
                ) : (
                  shareFollowers
                    .filter(f => f.full_name.toLowerCase().includes(shareSearch.toLowerCase()))
                    .map(f => {
                      const sent = shareSentIds.has(f.id);
                      const sending = shareSendingId === f.id;
                      return (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]">
                          <Avatar src={f.profile_photo_url} name={f.full_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-medium text-ink">{f.full_name}</p>
                            <p className="truncate text-caption text-ink-muted">{f.department}</p>
                          </div>
                          <Button size="sm" variant={sent ? 'outline' : 'primary'}
                            disabled={sent || sending} loading={sending}
                            onClick={() => handleShareToUser(f.id)}>
                            {sent ? '✓ Sent' : 'Send'}
                          </Button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}>
          <button type="button" onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={lightboxUrl} alt="Full size"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
