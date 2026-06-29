'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
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
  RoleBadge,
  PostContent,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
  { href: '/news', label: 'News', icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z' },
  { href: '/messages', label: 'Messages', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
  { href: '/profile', label: 'Profile', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
  { href: '/channels', label: 'Channels', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14' },
  { href: '/library', label: 'Library', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
];

interface SuggestedUser {
  id: number;
  full_name: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
}

interface FollowUser {
  id: number;
  full_name: string;
  matric_number: string;
  username?: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  is_following?: boolean;
}

type FollowModalType = 'none' | 'followers' | 'following';

interface TrendingHashtag {
  tag: string;
  post_count: number;
}

const POST_CATEGORIES = [
  { value: 'GENERAL',      label: 'General' },
  { value: 'EXAMINATION',  label: 'Examination' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'ACADEMIC',     label: 'Academic' },
  { value: 'SPORTS',       label: 'Sports' },
  { value: 'EVENTS',       label: 'Events' },
  { value: 'CAMPUS_LIFE',  label: 'Campus Life' },
] as const;

type PostCategory = typeof POST_CATEGORIES[number]['value'];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  EXAMINATION:  'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  REGISTRATION: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  ACADEMIC:     'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  SPORTS:       'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  EVENTS:       'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  CAMPUS_LIFE:  'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
};

interface Story {
  id: number;
  user_id: number;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  story_type: 'image' | 'video' | 'text';
  text_content: string | null;
  bg_color: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
}

interface StoryGroup {
  user_id: number;
  user_name: string;
  user_photo: string | null;
  is_own: boolean;
  stories: Story[];
}

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
  post_subtype: 'post' | 'discussion' | 'poll' | 'question' | 'event';
  discussion_title: string | null;
  poll_options: Array<{ id: number; option_text: string; vote_count: number }> | null;
  voted_option_id: number | null;
  poll_ends_at: string | null;
  poll_duration_hours: number | null;
  event_title: string | null;
  event_date: string | null;
  event_location: string | null;
  event_rsvp_count: number;
  is_attending: boolean;
  created_at: string;
  author_name: string;
  author_department: string;
  author_photo: string | null;
  author_role?: string;
  engagement_score: number;
  is_trending: boolean;
  is_hot: boolean;
  comment_velocity: number;
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
  is_best_answer?: boolean;
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

interface FeedChannel {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

interface BirthdayUser {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string;
}

interface ShareFollower {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string;
}

interface Highlight {
  id: number;
  title: string;
  description: string | null;
  type: 'announcement' | 'exam' | 'deadline' | 'event';
  start_date: string | null;
  end_date: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
}

const HIGHLIGHT_CONFIG: Record<string, { icon: string; bg: string; titleColor: string; badgeCls: string }> = {
  announcement: {
    icon: '📢',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    titleColor: 'text-blue-800 dark:text-blue-200',
    badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  exam: {
    icon: '📝',
    bg: 'bg-red-50 dark:bg-red-950/40',
    titleColor: 'text-red-800 dark:text-red-200',
    badgeCls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  deadline: {
    icon: '⏰',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    titleColor: 'text-orange-800 dark:text-orange-200',
    badgeCls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
  event: {
    icon: '🎉',
    bg: 'bg-green-50 dark:bg-green-950/40',
    titleColor: 'text-green-800 dark:text-green-200',
    badgeCls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
};

function highlightCountdown(startDate: string | null): string {
  if (!startDate) return '';
  const diffMs = new Date(startDate).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return 'Ongoing';
  if (diffDays === 0) return 'Today!';
  if (diffDays === 1) return 'Tomorrow';
  return `in ${diffDays} days`;
}

// ── Stories components ───────────────────────────────────────────────────────

function SegmentedRing({ stories, viewedIds }: { stories: Story[]; viewedIds: Set<number> }) {
  const count = stories.length;
  if (count === 0) return null;
  const size = 62;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 2.5;
  const r = cx - strokeW / 2 - 1;
  const gapDeg = count > 1 ? 6 : 0;
  const segDeg = (360 - count * gapDeg) / count;
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as [number, number];
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      className="absolute pointer-events-none" style={{ top: -3, left: -3 }}>
      {stories.map((story, i) => {
        const start = i * (segDeg + gapDeg);
        const end = start + segDeg;
        const [sx, sy] = toXY(start);
        const [ex, ey] = toXY(end);
        const large = segDeg > 180 ? 1 : 0;
        return (
          <path key={story.id}
            d={`M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
            fill="none"
            stroke={viewedIds.has(story.id) ? '#9ca3af' : '#16a34a'}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function StoriesBar({
  groups, storiesLoaded, user, onAddStory, onViewGroup, viewedStoryIds,
}: {
  groups: StoryGroup[];
  storiesLoaded: boolean;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onAddStory: () => void;
  onViewGroup: (g: StoryGroup) => void;
  viewedStoryIds: Set<number>;
}) {
  const ownGroup = groups.find(g => g.is_own);
  const others = groups.filter(g => !g.is_own);
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide px-0.5">
      {/* My Status */}
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <button type="button" onClick={() => ownGroup ? onViewGroup(ownGroup) : onAddStory()}
            className="relative h-14 w-14 rounded-full">
            {ownGroup
              ? <SegmentedRing stories={ownGroup.stories} viewedIds={viewedStoryIds} />
              : null}
            <div className={cn(
              'h-full w-full rounded-full p-[2px]',
              !ownGroup && 'ring-2 ring-gray-200 dark:ring-gray-700'
            )}>
              <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[1px]">
                <Avatar src={user.profile_photo_url} name={user.full_name} size="xl" className="h-full w-full" />
              </div>
            </div>
          </button>
          <button type="button" onClick={onAddStory}
            className="absolute -bottom-0.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 ring-2 ring-white dark:ring-[#0a0a0a]">
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
        {ownGroup ? (
          <Link href="/mystories" className="max-w-[54px] truncate text-[11px] font-medium text-brand-600 hover:text-brand-700" onClick={e => e.stopPropagation()}>
            My Stories
          </Link>
        ) : (
          <span className="max-w-[54px] truncate text-[11px] font-medium text-ink-muted">My Status</span>
        )}
      </div>
      {/* Others */}
      {others.map(g => (
        <button key={g.user_id} type="button" onClick={() => onViewGroup(g)}
          className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
            <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[2px]">
              <Avatar src={g.user_photo} name={g.user_name} size="xl" className="h-full w-full" />
            </div>
          </div>
          <span className="max-w-[54px] truncate text-[11px] font-medium text-ink-muted">
            {g.user_name.split(' ')[0].slice(0, 8)}
          </span>
        </button>
      ))}
      {/* Loading skeletons — only while fetching */}
      {!storiesLoaded && [1, 2, 3].map(i => (
        <div key={i} className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200 dark:bg-[#2a2a2a]" />
          <div className="h-2 w-9 animate-pulse rounded-full bg-gray-200 dark:bg-[#2a2a2a]" />
        </div>
      ))}
      {/* No stories from others — just show hint text, no fake circles */}
      {storiesLoaded && others.length === 0 && (
        <div className="flex shrink-0 items-center pl-2">
          <p className="max-w-[120px] text-[11px] leading-tight text-ink-muted">
            Follow people to see their stories here
          </p>
        </div>
      )}
    </div>
  );
}

function storyFormatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function StoryViewer({
  group, index, onClose, onPrev, onNext, onDelete, onAddStory,
  reactions, onReact, showReplyInput, onToggleReply, replyText, onReplyChange, onSendReply, replySending,
  likers, viewCount, isPaused, onPauseToggle,
}: {
  group: StoryGroup;
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete?: (storyId: number) => void;
  onAddStory?: () => void;
  reactions?: { count: number; is_liked: boolean };
  onReact?: () => void;
  showReplyInput?: boolean;
  onToggleReply?: () => void;
  replyText?: string;
  onReplyChange?: (v: string) => void;
  onSendReply?: () => void;
  replySending?: boolean;
  likers?: Array<{ user_id: number; user_name: string; user_photo: string | null }>;
  viewCount?: number;
  isPaused: boolean;
  onPauseToggle: () => void;
}) {
  const story = group.stories[index];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const pauseIconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [isPaused]);

  useEffect(() => {
    setVideoProgress(0);
    setVideoCurrentTime(0);
    setVideoDuration(0);
  }, [story?.id]);

  if (!story) return null;

  const handleCenterTap = () => {
    onPauseToggle();
    setShowPauseIcon(true);
    if (pauseIconTimerRef.current) clearTimeout(pauseIconTimerRef.current);
    pauseIconTimerRef.current = setTimeout(() => setShowPauseIcon(false), 1000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ touchAction: "none" }} onTouchMove={e => e.preventDefault()}>
      {/* Backdrop — dedicated element so content clicks never bubble here */}
      <div className="absolute inset-0 bg-black" onClick={onClose} />
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
        {group.stories.map((s, i) => (
          <div key={i} className="h-0.5 flex-1 rounded-full bg-white/30">
            {i < index ? (
              <div className="h-full w-full rounded-full bg-white" />
            ) : i === index ? (
              s.story_type === 'video' ? (
                <div className="h-full rounded-full bg-white" style={{ width: `${videoProgress * 100}%`, transition: 'width 0.1s linear' }} />
              ) : (
                <div className="h-full rounded-full bg-white animate-[story-progress_5s_linear_forwards]"
                  style={{ animationPlayState: isPaused ? 'paused' : 'running' }} />
              )
            ) : (
              <div className="h-full w-0 rounded-full bg-white" />
            )}
          </div>
        ))}
      </div>
      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Avatar src={group.user_photo} name={group.user_name} size="sm" />
          <span className="text-sm font-medium text-white">{group.user_name}</span>
          <span className="text-xs text-white/60">{new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {story.story_type === 'video' && videoDuration > 0 && (
            <span className="text-xs text-white/60">{storyFormatTime(videoCurrentTime)} / {storyFormatTime(videoDuration)}</span>
          )}
          <span className={cn('flex items-center gap-1', group.is_own ? 'text-white/80 text-xs font-medium' : 'text-white/40 text-[11px]')}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {viewCount ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {group.is_own && onAddStory && (
            <button type="button" onClick={onAddStory}
              className="rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50" title="Add to story">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
          {group.is_own && onDelete && (
            <button type="button" onClick={() => onDelete(story.id)}
              className="rounded-full bg-black/30 p-1.5 text-white hover:bg-red-500/80" title="Delete story">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      {/* Media / Text */}
      <div className="relative z-10 flex h-full w-full max-w-sm items-center justify-center">
        {story.story_type === 'text' ? (
          <div className="flex h-full w-full items-center justify-center px-8"
            style={{ backgroundColor: story.bg_color || '#16a34a' }}>
            <p className={cn(
              'text-center font-bold leading-tight text-white break-words w-full',
              (story.text_content?.length ?? 0) > 100 ? 'text-xl' : (story.text_content?.length ?? 0) > 50 ? 'text-2xl' : 'text-3xl'
            )}>
              {story.text_content}
            </p>
          </div>
        ) : story.story_type === 'video' ? (
          <video
            ref={videoRef}
            src={story.media_url!}
            autoPlay
            muted={false}
            controls={false}
            playsInline
            className="w-full object-contain"
            style={{ maxHeight: 'calc(100vh - 140px)', marginTop: '80px' }}
            onTimeUpdate={(e) => {
              const vid = e.currentTarget;
              if (vid.duration && !isNaN(vid.duration)) {
                setVideoProgress(vid.currentTime / vid.duration);
                setVideoCurrentTime(vid.currentTime);
              }
            }}
            onLoadedMetadata={(e) => {
              setVideoDuration(e.currentTarget.duration);
            }}
            onEnded={() => onNext()}
          />
        ) : (
          <img src={story.media_url!} alt="Story" className="max-h-full w-full object-contain" />
        )}
      </div>
      {/* Caption overlay — image/video only */}
      {story.story_type !== 'text' && story.caption && (
        <div className="absolute inset-x-0 bottom-20 z-10 pointer-events-none">
          <div className="bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
            <p className="text-sm font-medium leading-snug text-white/95 line-clamp-2">{story.caption}</p>
          </div>
        </div>
      )}
      {/* Tap zones — z-[5] so header buttons at z-10 remain clickable */}
      <button type="button" className="absolute left-0 top-0 z-[5] h-full w-1/3" onClick={onPrev} aria-label="Previous" />
      <button type="button" className="absolute left-1/3 right-1/3 top-0 z-[5] h-full" onClick={handleCenterTap} aria-label="Pause/Resume" />
      <button type="button" className="absolute right-0 top-0 z-[5] h-full w-1/3" onClick={onNext} aria-label="Next" />
      {/* Pause/play icon — brief overlay feedback */}
      {showPauseIcon && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/50 p-4">
            {isPaused ? (
              <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar — others' story: react + reply */}
      {!group.is_own && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 px-4 pb-8">
          {showReplyInput && (
            <>
              {/* Story preview chip */}
              <div className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 backdrop-blur-sm">
                {story.story_type === 'image' && story.media_url && (
                  <img src={story.media_url} alt="Story preview" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                )}
                {story.story_type === 'video' && story.media_url && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/60">
                    <svg className="h-5 w-5 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                )}
                {story.story_type === 'text' && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg px-1" style={{ backgroundColor: story.bg_color || '#16a34a' }}>
                    <p className="line-clamp-2 text-center text-[9px] font-semibold leading-tight text-white">{story.text_content}</p>
                  </div>
                )}
                <p className="text-xs text-white/70">Replying to story</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText ?? ''}
                  onChange={e => onReplyChange?.(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !replySending && replyText?.trim()) onSendReply?.(); }}
                  placeholder="Reply to story…"
                  autoFocus
                  className="flex-1 rounded-full bg-white/20 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur-sm"
                />
                <button
                  type="button"
                  onClick={onSendReply}
                  disabled={replySending || !replyText?.trim()}
                  className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm disabled:opacity-40"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onReact}
              className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-white backdrop-blur-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                fill={reactions?.is_liked ? '#ef4444' : 'none'}
                style={{ color: reactions?.is_liked ? '#ef4444' : 'white' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <span className="text-sm font-medium">{reactions?.count ?? 0}</span>
            </button>
            <button
              type="button"
              onClick={onToggleReply}
              className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-white backdrop-blur-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
              <span className="text-sm font-medium">Reply</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar — own story: views + who liked it */}
      {group.is_own && ((viewCount ?? 0) > 0 || (likers && likers.length > 0)) && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-8">
          <div className="rounded-xl bg-black/40 px-4 py-3 backdrop-blur-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {viewCount ?? 0} {(viewCount ?? 0) === 1 ? 'view' : 'views'}
            </p>
            {likers && likers.length > 0 && (
              <>
                <p className="mb-2 text-xs font-medium text-white/60">
                  ❤ {likers.length} {likers.length === 1 ? 'like' : 'likes'}
                </p>
                <div className="flex max-h-24 flex-col gap-1.5 overflow-y-auto">
                  {likers.map(l => (
                    <div key={l.user_id} className="flex items-center gap-2">
                      <Avatar src={l.user_photo} name={l.user_name} size="xs" />
                      <span className="text-xs text-white">{l.user_name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex justify-between pt-1">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarProfile({
  user,
  postCount,
  followersCount,
  followingCount,
  token,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  postCount: number;
  followersCount: number;
  followingCount: number;
  token: string | null;
}) {
  const [modalType, setModalType] = useState<FollowModalType>('none');
  const [modalList, setModalList] = useState<FollowUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const closeModal = () => { setModalType('none'); setModalError(''); };

  const openModal = async (type: 'followers' | 'following') => {
    if (!token) return;
    setModalType(type);
    setModalLoading(true);
    setModalList([]);
    setModalError('');
    try {
      const endpoint =
        type === 'followers'
          ? `/api/follows/${user.id}/followers`
          : `/api/follows/${user.id}/following`;
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.message || 'Failed to load list');
        return;
      }
      setModalList(data[type] ?? []);
    } catch {
      setModalError('Network error — could not load list');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center text-center">
            <Avatar src={user.profile_photo_url} name={user.full_name} size="xl" />
            <h3 className="mt-3 font-semibold text-ink">{user.full_name}</h3>
            <Badge variant="brand" className="mt-2">{user.department}</Badge>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface-muted py-3">
            <div className="text-center">
              <p className="font-semibold text-ink">{postCount}</p>
              <p className="text-caption text-ink-muted">Posts</p>
            </div>
            <button
              type="button"
              onClick={() => openModal('followers')}
              className="text-center transition hover:bg-surface-subtle"
            >
              <p className="font-semibold text-ink">{followersCount}</p>
              <p className="text-caption text-ink-muted">Followers</p>
            </button>
            <button
              type="button"
              onClick={() => openModal('following')}
              className="text-center transition hover:bg-surface-subtle"
            >
              <p className="font-semibold text-ink">{followingCount}</p>
              <p className="text-caption text-ink-muted">Following</p>
            </button>
          </div>
          <nav className="mt-5 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium text-ink-secondary transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950 dark:hover:text-brand-400"
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

      {/* Followers / Following modal */}
      {modalType !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#111] dark:border dark:border-[#222]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold text-ink capitalize">
                {modalType} ({modalType === 'followers' ? followersCount : followingCount})
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {modalLoading ? (
                <div className="space-y-0">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : modalError ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-body-sm font-medium text-red-600">{modalError}</p>
                </div>
              ) : modalList.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-body-sm text-ink-muted">
                    {modalType === 'followers' ? 'No followers yet' : "You're not following anyone yet"}
                  </p>
                </div>
              ) : (
                modalList.map((u) => (
                  <FeedModalUserRow
                    key={u.id}
                    user={u}
                    token={token}
                    onNavigate={closeModal}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FeedModalUserRow({
  user,
  token,
  onNavigate,
}: {
  user: FollowUser;
  token: string | null;
  onNavigate: () => void;
}) {
  const { isFollowing, loading, toggle } = useFollow(user.id, user.is_following ?? false, 0, token);

  return (
    <div className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]">
      <Link href={`/profile/${user.id}`} onClick={onNavigate}>
        <Avatar src={user.profile_photo_url} name={user.full_name} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/profile/${user.id}`}
          onClick={onNavigate}
          className="block truncate font-medium text-ink hover:text-brand-600"
        >
          {user.full_name}
        </Link>
        <p className="truncate text-caption text-ink-muted">{user.department}</p>
      </div>
      <Button
        variant={isFollowing ? 'outline' : 'primary'}
        size="sm"
        onClick={toggle}
        loading={loading}
        className={`shrink-0 min-w-[76px] ${isFollowing ? 'hover:border-red-300 hover:text-red-600' : ''}`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}

export default function FeedPage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [composerMode, setComposerMode] = useState<'post' | 'discussion' | 'poll' | 'question' | 'event'>('post');
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<24 | 48 | 72 | 168>(24);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [commentingId, setCommentingId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<number, boolean>>({});

  // Share Post
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [shareFollowers, setShareFollowers] = useState<ShareFollower[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSendingId, setShareSendingId] = useState<number | null>(null);
  const [shareSentIds, setShareSentIds] = useState<Set<number>>(new Set());
  const [shareCopied, setShareCopied] = useState(false);

  // Reply to Comments
  const [replyingTo, setReplyingTo] = useState<{ postId: number; commentId: number } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<Record<number, Reply[]>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<number, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  // Stories
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [viewingIdx, setViewingIdx] = useState(0);
  const [showUploadStory, setShowUploadStory] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyTab, setStoryTab] = useState<'media' | 'text'>('media');
  const [storyText, setStoryText] = useState('');
  const [storyBgColor, setStoryBgColor] = useState('#16a34a');
  const [storyCaption, setStoryCaption] = useState('');
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<number>>(new Set());
  // Story reactions & replies
  const [storyReactions, setStoryReactions] = useState<Record<number, { count: number; is_liked: boolean }>>({});
  const [storyLikers, setStoryLikers] = useState<Array<{ user_id: number; user_name: string; user_photo: string | null }>>([]);
  const [showStoryReply, setShowStoryReply] = useState(false);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [storyReplySending, setStoryReplySending] = useState(false);
  const [storyPaused, setStoryPaused] = useState(false);
  const [storyUploadProgress, setStoryUploadProgress] = useState<number | null>(null);
  const [storyUploadError, setStoryUploadError] = useState('');

  // Highlights
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Birthdays
  const [birthdayUsers, setBirthdayUsers] = useState<BirthdayUser[]>([]);
  const [isMyBirthday, setIsMyBirthday] = useState(false);

  // Today's classes
  interface TodayClass { id: number; course_code: string | null; course_title: string; start_time: string; end_time: string; venue: string | null; lecturer: string | null; }
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [noTimetableProfile, setNoTimetableProfile] = useState(false);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<PostCategory | 'ALL'>('ALL');
  const [newPostCategory, setNewPostCategory] = useState<PostCategory>('GENERAL');

  // Repost
  const [repostingId, setRepostingId] = useState<number | null>(null);

  // Show more/less per post
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());

  // ⋮ post context menu
  const [postMenuId, setPostMenuId] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const lastFetchRef = useRef<number>(0);
  const viewedPostsRef = useRef<Set<number>>(new Set());
  const viewedStoryApiCallsRef = useRef<Set<number>>(new Set());
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  // Close lightbox/story viewer on Escape; if upload modal is open, close that first
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showUploadStory) {
        setShowUploadStory(false);
        setStoryFile(null); setStoryPreview(null); setStoryText(''); setStoryBgColor('#16a34a'); setStoryTab('media'); setStoryCaption(''); setStoryUploadError(''); setStoryUploadProgress(null);
      } else {
        setLightboxUrl(null); setViewingGroup(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showUploadStory]);

  // Fetch stories
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/stories`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStoryGroups(d.groups || []); setStoriesLoaded(true); })
      .catch(() => setStoriesLoaded(true));
  }, [token]);

  // Fetch highlights
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/highlights`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setHighlights(d.highlights || []))
      .catch(() => {});
  }, [token]);

  // Fetch today's classes
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/timetable/today`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setTodayClasses(d.classes || []);
        setNoTimetableProfile(!!d.no_profile);
      })
      .catch(() => {});
  }, [token]);

  // Fetch today's birthdays
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/users/birthdays/today`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setBirthdayUsers(d.users || []); setIsMyBirthday(!!d.is_my_birthday); })
      .catch(() => {});
  }, [token]);

  // IntersectionObserver for view counts
  useEffect(() => {
    if (!token || loading) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = parseInt((entry.target as HTMLElement).dataset.postId || '0', 10);
          if (id && !viewedPostsRef.current.has(id)) {
            viewedPostsRef.current.add(id);
            fetch(`${API_URL}/api/posts/${id}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
            setPosts(prev => prev.map(p => p.id === id ? { ...p, view_count: p.view_count + 1 } : p));
            observer.unobserve(entry.target);
          }
        }
      }
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-post-id]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loading, posts.length]);

  // Fetch reactions for the currently viewed story
  useEffect(() => {
    if (!viewingGroup || !token) return;
    const story = viewingGroup.stories[viewingIdx];
    if (!story) return;
    setShowStoryReply(false);
    setStoryReplyText('');
    fetch(`${API_URL}/api/stories/${story.id}/reactions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setStoryReactions(prev => ({ ...prev, [story.id]: { count: d.count, is_liked: d.is_liked } }));
        if (viewingGroup.is_own) setStoryLikers(d.likers || []);
      })
      .catch(() => {});
  }, [viewingGroup, viewingIdx, token]);

  // Auto-advance story viewer (image/text only; video advances via onEnded)
  useEffect(() => {
    const isVideo = viewingGroup?.stories[viewingIdx]?.story_type === 'video';
    if (!viewingGroup || showUploadStory || showStoryReply || storyPaused || isVideo) {
      if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
      return;
    }
    storyTimerRef.current = setTimeout(() => {
      if (viewingIdx < viewingGroup.stories.length - 1) {
        setViewingIdx(i => i + 1);
      } else {
        setViewingGroup(null);
      }
    }, 5000);
    return () => { if (storyTimerRef.current) clearTimeout(storyTimerRef.current); };
  }, [viewingGroup, viewingIdx, showUploadStory, showStoryReply, storyPaused]);

  // Reset pause state when navigating to a different story
  useEffect(() => {
    setStoryPaused(false);
  }, [viewingGroup?.user_id, viewingIdx]);

  // Load viewed story IDs from localStorage on mount; purge entries older than 24 h
  useEffect(() => {
    try {
      const stored = localStorage.getItem('viewed_stories');
      if (!stored) return;
      const parsed: Record<string, number> = JSON.parse(stored);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const ids = new Set<number>();
      const valid: Record<string, number> = {};
      for (const [id, ts] of Object.entries(parsed)) {
        if (ts > cutoff) { valid[id] = ts; ids.add(Number(id)); }
      }
      localStorage.setItem('viewed_stories', JSON.stringify(valid));
      setViewedStoryIds(ids);
    } catch {}
  }, []);

  // Mark current story as viewed (localStorage) and record view via API
  useEffect(() => {
    if (!viewingGroup) return;
    const story = viewingGroup.stories[viewingIdx];
    if (!story) return;
    setViewedStoryIds(prev => new Set([...prev, story.id]));
    try {
      const stored = localStorage.getItem('viewed_stories');
      const parsed: Record<string, number> = stored ? JSON.parse(stored) : {};
      parsed[String(story.id)] = Date.now();
      localStorage.setItem('viewed_stories', JSON.stringify(parsed));
    } catch {}
    // Record view via API once per session, skip own stories
    if (token && !viewingGroup.is_own && !viewedStoryApiCallsRef.current.has(story.id)) {
      viewedStoryApiCallsRef.current.add(story.id);
      const storyId = story.id;
      fetch(`${API_URL}/api/stories/${storyId}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => {
          if (r.ok) {
            setViewingGroup(prev => prev ? {
              ...prev,
              stories: prev.stories.map(s => s.id === storyId ? { ...s, view_count: (s.view_count ?? 0) + 1 } : s),
            } : null);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingGroup, viewingIdx]);

  // Close post context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) {
        setPostMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Read ?openComments=<postId> from URL on mount and auto-expand that post
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('openComments');
    if (id) setCommentingId(parseInt(id, 10));
  }, []);

  // Load comments when a post's section is expanded
  useEffect(() => {
    if (commentingId !== null && comments[commentingId] === undefined) {
      fetchComments(commentingId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentingId]);

  const fetchPosts = async (isRetry = false) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 && !isRetry) {
        // Token may be stale — verify with /api/users/me
        const meRes = await fetch(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          // Token is valid, just retry posts
          return fetchPosts(true);
        } else {
          // Truly expired — log out
          logout();
          router.push('/login?reason=session_expired');
          return;
        }
      }
      const data = await res.json();
      if (res.ok) {
        setPosts(data.posts);
        lastFetchRef.current = Date.now();
      }
    } catch {
      setError('Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPosts();
  }, [token]);

  // Re-fetch when user returns to the tab after 5+ minutes
  useEffect(() => {
    if (!token) return;
    const handleFocus = () => {
      if (Date.now() - lastFetchRef.current > 5 * 60 * 1000) {
        fetchPosts();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token]);

  // Scroll to target post once posts are rendered and commentingId is set from URL
  useEffect(() => {
    if (loading || commentingId === null) return;
    const el = document.getElementById(`post-${commentingId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    // reset input so the same file can be re-selected
    e.target.value = '';
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if ((composerMode === 'discussion' || composerMode === 'question') && !discussionTitle.trim()) return;
    if (composerMode === 'poll' && pollOptions.filter(o => o.trim()).length < 2) return;
    if (composerMode === 'event' && (!eventTitle.trim() || !eventDate)) return;
    if (composerMode === 'post' && !newPost.trim()) return;
    setPosting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('content', newPost.trim());
      formData.append('category', newPostCategory);
      if (composerMode === 'discussion') {
        formData.append('post_subtype', 'discussion');
        formData.append('discussion_title', discussionTitle.trim());
      } else if (composerMode === 'question') {
        formData.append('post_subtype', 'question');
        formData.append('discussion_title', discussionTitle.trim());
      } else if (composerMode === 'poll') {
        formData.append('post_subtype', 'poll');
        formData.append('poll_options', JSON.stringify(pollOptions.filter(o => o.trim())));
        formData.append('poll_duration_hours', String(pollDuration));
      } else if (composerMode === 'event') {
        formData.append('post_subtype', 'event');
        formData.append('event_title', eventTitle.trim());
        formData.append('event_date', eventDate);
        if (eventLocation.trim()) formData.append('event_location', eventLocation.trim());
      }
      if (imageFile) formData.append('image', imageFile);

      const endpoint = selectedChannelId
        ? `${API_URL}/api/channels/${selectedChannelId}/posts`
        : `${API_URL}/api/posts`;

      // If there is an image, upload it directly to Cloudinary first (bypasses Railway 30s timeout)
      if (imageFile) {
        const sigRes = await fetch(`${API_URL}/api/stories/upload-signature`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!sigRes.ok) throw new Error('Failed to get upload signature');
        const { signature, timestamp, api_key, cloud_name } = await sigRes.json() as {
          signature: string; timestamp: number; api_key: string; cloud_name: string; folder: string;
        };
        const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const tid = setTimeout(() => xhr.abort(), 120000);
          xhr.onload = () => {
            clearTimeout(tid);
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url); }
              catch { reject(new Error('Invalid Cloudinary response')); }
            } else {
              try { reject(new Error((JSON.parse(xhr.responseText) as { error?: { message: string } }).error?.message || 'Image upload failed')); }
              catch { reject(new Error('Image upload failed')); }
            }
          };
          xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error — check your connection')); };
          xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out — try a smaller image')); };
          const fd = new FormData();
          fd.append('file', imageFile);
          fd.append('api_key', api_key);
          fd.append('timestamp', String(timestamp));
          fd.append('signature', signature);
          fd.append('folder', 'abukonn/posts');
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`);
          xhr.send(fd);
        });
        // Replace the image in formData with the Cloudinary URL
        formData.delete('image');
        formData.append('image_url', cloudinaryUrl);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message || 'Failed to create post');
      }
      setNewPost('');
      setNewPostCategory('GENERAL');
      setComposerMode('post');
      setDiscussionTitle('');
      setPollOptions(['', '']);
      setPollDuration(24);
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setSelectedChannelId(null);
      setImageFile(null);
      setImagePreview(null);
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (postId: number, optionId: number) => {
    if (!token) return;
    setPosts(prev => prev.map(p => p.id !== postId ? p : {
      ...p,
      voted_option_id: optionId,
      poll_options: p.poll_options?.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o) ?? null,
    }));
    fetch(`${API_URL}/api/posts/${postId}/vote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    }).catch(() => {});
  };

  const handleRSVP = async (postId: number) => {
    if (!token) return;
    setPosts(prev => prev.map(p => p.id !== postId ? p : {
      ...p,
      is_attending: !p.is_attending,
      event_rsvp_count: p.is_attending ? p.event_rsvp_count - 1 : p.event_rsvp_count + 1,
    }));
    fetch(`${API_URL}/api/posts/${postId}/rsvp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const handleMarkBestAnswer = async (postId: number, commentId: number) => {
    if (!token) return;
    setComments(prev => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map(c => ({ ...c, is_best_answer: c.id === commentId })),
    }));
    fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/best-answer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const fetchComments = async (postId: number) => {
    if (!token) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => ({ ...prev, [postId]: data.comments }));
      }
    } catch {
      // non-blocking
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleLike = async (postId: number) => {
    if (!token) return;
    // Optimistic toggle
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      )
    );
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likes_count: data.post.likes_count, is_liked: data.is_liked } : p
          )
        );
      } else {
        // Revert on server error
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
              : p
          )
        );
      }
    } catch {
      // Revert on network error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
            : p
        )
      );
    }
  };

  const handleComment = async (postId: number) => {
    if (!commentText.trim() || !token || !user) return;
    const text = commentText.trim();

    // Optimistic add
    const tempComment: Comment = {
      id: -Date.now(),
      post_id: postId,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      author_name: user.full_name,
      author_photo: user.profile_photo_url,
      reply_count: 0,
    };
    setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), tempComment] }));
    setCommentText('');

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) => p.id === postId ? { ...p, comments_count: data.post.comments_count } : p)
        );
        // Replace temp with real comment from server
        setComments((prev) => ({
          ...prev,
          [postId]: [
            ...(prev[postId] ?? []).filter((c) => c.id !== tempComment.id),
            data.comment,
          ],
        }));
      } else {
        // Revert
        setComments((prev) => ({
          ...prev,
          [postId]: (prev[postId] ?? []).filter((c) => c.id !== tempComment.id),
        }));
        setCommentText(text);
      }
    } catch {
      setComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== tempComment.id),
      }));
      setCommentText(text);
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

  // ── Stories ─────────────────────────────────────────────────────────────────

  const handleStoryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryUploadError('');
    if (file.type.startsWith('video/') && file.size > 10 * 1024 * 1024) {
      setStoryUploadError('Video must be under 10MB');
      e.target.value = '';
      return;
    }
    setStoryFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setStoryPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadStory = async () => {
    if (!token) return;
    setUploadingStory(true);
    setStoryUploadError('');
    setStoryUploadProgress(null);

    const onSuccess = (story: Story) => {
      setStoryGroups(prev => {
        const ownIdx = prev.findIndex(g => g.is_own);
        if (ownIdx >= 0) {
          const updated = [...prev];
          updated[ownIdx] = { ...updated[ownIdx], stories: [...updated[ownIdx].stories, story] };
          return updated;
        }
        return [{ user_id: user!.id, user_name: user!.full_name, user_photo: user!.profile_photo_url, is_own: true, stories: [story] }, ...prev];
      });
      setViewingGroup(prev => prev?.is_own ? { ...prev, stories: [...prev.stories, story] } : prev);
      setShowUploadStory(false);
      setStoryFile(null);
      setStoryPreview(null);
      setStoryText('');
      setStoryBgColor('#16a34a');
      setStoryTab('media');
    };

    try {
      if (storyTab === 'text') {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 60000);
        const res = await fetch(`${API_URL}/api/stories`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ story_type: 'text', text_content: storyText, bg_color: storyBgColor }),
          signal: controller.signal,
        }).finally(() => clearTimeout(tid));
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(d.message || 'Upload failed');
        }
        onSuccess(((await res.json()) as { story: Story }).story);
      } else {
        if (!storyFile) return;
        const isVideo = storyFile.type.startsWith('video/');

        if (isVideo) {
          // Direct-to-Cloudinary upload to bypass Railway's 30s proxy timeout
          const sigRes = await fetch(`${API_URL}/api/stories/upload-signature`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!sigRes.ok) throw new Error('Failed to get upload signature');
          const { signature, timestamp, api_key, cloud_name, folder } = await sigRes.json() as {
            signature: string; timestamp: number; api_key: string; cloud_name: string; folder: string;
          };

          const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const tid = setTimeout(() => xhr.abort(), 300000);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) setStoryUploadProgress(Math.round((e.loaded / e.total) * 100));
            };
            xhr.onload = () => {
              clearTimeout(tid);
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url); }
                catch { reject(new Error('Invalid Cloudinary response')); }
              } else {
                try { reject(new Error((JSON.parse(xhr.responseText) as { error?: { message: string } }).error?.message || 'Cloudinary upload failed')); }
                catch { reject(new Error('Cloudinary upload failed')); }
              }
            };
            xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error — check your connection')); };
            xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out')); };
            const fd = new FormData();
            fd.append('file', storyFile);
            fd.append('api_key', api_key);
            fd.append('timestamp', String(timestamp));
            fd.append('signature', signature);
            fd.append('folder', folder);
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`);
            xhr.send(fd);
          });

          const saveRes = await fetch(`${API_URL}/api/stories`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ story_type: 'video', media_url: cloudinaryUrl, direct_upload: true, caption: storyCaption.trim() || undefined }),
          });
          if (!saveRes.ok) {
            const d = await saveRes.json().catch(() => ({})) as { message?: string };
            throw new Error(d.message || 'Failed to save story');
          }
          onSuccess(((await saveRes.json()) as { story: Story }).story);
        } else {
          const story = await new Promise<Story>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const tid = setTimeout(() => xhr.abort(), 30000);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) setStoryUploadProgress(Math.round((e.loaded / e.total) * 100));
            };
            xhr.onload = () => {
              clearTimeout(tid);
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve((JSON.parse(xhr.responseText) as { story: Story }).story); }
                catch { reject(new Error('Invalid server response')); }
              } else {
                try { reject(new Error((JSON.parse(xhr.responseText) as { message?: string }).message || 'Upload failed')); }
                catch { reject(new Error('Upload failed')); }
              }
            };
            xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error — check your connection')); };
            xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out')); };
            const fd = new FormData();
            fd.append('media', storyFile);
            if (storyCaption.trim()) fd.append('caption', storyCaption.trim());
            xhr.open('POST', `${API_URL}/api/stories`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(fd);
          });
          onSuccess(story);
        }
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? 'Upload timed out — please try again'
        : err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setStoryUploadError(msg);
    } finally {
      setUploadingStory(false);
      setStoryUploadProgress(null);
    }
  };

  const handleDeleteStory = async (storyId: number) => {
    if (!token || !viewingGroup) return;
    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setStoryGroups(prev =>
        prev.map(g => g.is_own ? { ...g, stories: g.stories.filter(s => s.id !== storyId) } : g)
          .filter(g => g.stories.length > 0)
      );
      // Use functional updater so we always read the latest viewingGroup state
      setViewingGroup(prev => {
        if (!prev) return null;
        const remaining = prev.stories.filter(s => s.id !== storyId);
        return remaining.length === 0 ? null : { ...prev, stories: remaining };
      });
      // Clamp index after stories shrink (safe even if viewer is closing)
      const remaining = viewingGroup.stories.filter(s => s.id !== storyId);
      if (remaining.length > 0) {
        setViewingIdx(i => Math.min(i, remaining.length - 1));
      }
    } catch { /* silent */ }
  };

  const handleToggleReaction = async (storyId: number) => {
    if (!token) return;
    setStoryReactions(prev => {
      const curr = prev[storyId] || { count: 0, is_liked: false };
      return { ...prev, [storyId]: { count: curr.is_liked ? curr.count - 1 : curr.count + 1, is_liked: !curr.is_liked } };
    });
    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}/react`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setStoryReactions(prev => ({ ...prev, [storyId]: { count: d.count, is_liked: d.liked } }));
      }
    } catch { /* keep optimistic */ }
  };

  const handleSendStoryReply = async (storyId: number) => {
    if (!token || !storyReplyText.trim() || storyReplySending) return;
    setStoryReplySending(true);
    try {
      await fetch(`${API_URL}/api/stories/${storyId}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: storyReplyText.trim() }),
      });
      setStoryReplyText('');
      setShowStoryReply(false);
    } catch { /* silent */ }
    finally { setStoryReplySending(false); }
  };

  // ── Repost ───────────────────────────────────────────────────────────────────

  const handleRepost = async (postId: number) => {
    if (!token || repostingId !== null) return;
    setRepostingId(postId);
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/repost`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Increment repost_count on original, prepend new post
      setPosts(prev => [
        { ...data.post, is_liked: false, is_following_author: false, repost_count: 0, view_count: 0, comments_count: 0, likes_count: 0 },
        ...prev.map(p => p.id === postId ? { ...p, repost_count: p.repost_count + 1 } : p),
      ]);
    } catch { /* silent */ }
    finally { setRepostingId(null); }
  };

  // ── Follow from post card ────────────────────────────────────────────────────

  const handleFollowFromCard = async (authorId: number) => {
    if (!token) return;
    // Optimistic: flip is_following_author on all posts by this author
    setPosts(prev => prev.map(p => p.user_id === authorId ? { ...p, is_following_author: true } : p));
    try {
      await fetch(`${API_URL}/api/follows/${authorId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setPosts(prev => prev.map(p => p.user_id === authorId ? { ...p, is_following_author: false } : p));
    }
  };

  // ── Share Post ──────────────────────────────────────────────────────────────

  const openShareModal = async (post: Post) => {
    if (!token || !user) return;
    setSharePost(post);
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
    if (!sharePost || !token || shareSendingId !== null) return;
    setShareSendingId(recipientId);
    try {
      const convRes = await fetch(`${API_URL}/api/messages/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      if (!convRes.ok) throw new Error('Failed to start conversation');
      const { conversation } = await convRes.json();
      const content = JSON.stringify({
        type: 'shared_post',
        post_id: sharePost.id,
        author_name: sharePost.author_name,
        content: sharePost.content,
        image_url: sharePost.image_url ?? null,
      });
      await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: conversation.id, content }),
      });
      setShareSentIds((prev) => new Set([...prev, recipientId]));
    } catch { /* silent */ }
    finally { setShareSendingId(null); }
  };

  const handleCopyPostLink = (postId: number) => {
    const url = `${window.location.origin}/feed#post-${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  };

  // ── Reply to Comments ───────────────────────────────────────────────────────

  const fetchReplies = async (postId: number, commentId: number) => {
    if (!token || repliesLoading[commentId]) return;
    setRepliesLoading((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/replies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReplies((prev) => ({ ...prev, [commentId]: data.replies || [] }));
      setExpandedReplies((prev) => new Set([...prev, commentId]));
    } catch { /* non-blocking */ }
    finally { setRepliesLoading((prev) => ({ ...prev, [commentId]: false })); }
  };

  const toggleReplies = (postId: number, commentId: number) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => { const n = new Set(prev); n.delete(commentId); return n; });
    } else if (replies[commentId] !== undefined) {
      setExpandedReplies((prev) => new Set([...prev, commentId]));
    } else {
      fetchReplies(postId, commentId);
    }
  };

  const handleReply = async (postId: number, commentId: number) => {
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
    setReplies((prev) => ({ ...prev, [commentId]: [...(prev[commentId] ?? []), tempReply] }));
    setExpandedReplies((prev) => new Set([...prev, commentId]));
    setReplyingTo(null);
    setReplyText('');
    // Update reply_count optimistically
    setComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((c) =>
        c.id === commentId ? { ...c, reply_count: (c.reply_count ?? 0) + 1 } : c
      ),
    }));
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies((prev) => ({
          ...prev,
          [commentId]: [...(prev[commentId] ?? []).filter((r) => r.id !== tempReply.id), data.reply],
        }));
      } else {
        setReplies((prev) => ({
          ...prev,
          [commentId]: (prev[commentId] ?? []).filter((r) => r.id !== tempReply.id),
        }));
        setReplyingTo({ postId, commentId });
        setReplyText(text);
      }
    } catch {
      setReplies((prev) => ({
        ...prev,
        [commentId]: (prev[commentId] ?? []).filter((r) => r.id !== tempReply.id),
      }));
      setReplyingTo({ postId, commentId });
      setReplyText(text);
    }
  };

  const userPostCount = posts.filter((p) => p.user_id === user?.id).length;
  const maxEngagementScore = Math.max(1, ...posts.map(p => p.engagement_score ?? 0));
  const activePosts = [...posts]
    .filter(p => (p.comment_velocity ?? 0) > 0)
    .sort((a, b) => (b.comment_velocity ?? 0) - (a.comment_velocity ?? 0))
    .slice(0, 3);

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [myChannels, setMyChannels] = useState<FeedChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
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

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/channels/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMyChannels(d.channels ?? []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const refreshTrending = () => {
      fetch(`${API_URL}/api/hashtags/trending?limit=8`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setTrendingHashtags(d.hashtags ?? []))
        .catch(() => {});
    };
    refreshTrending();
    const tid = setInterval(refreshTrending, 300000);
    return () => clearInterval(tid);
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
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left sidebar */}
        <aside className="hidden lg:col-span-3 lg:block lg:py-6 lg:pl-4 lg:pr-6">
          <div className="sticky top-20">
            <SidebarProfile
              user={user}
              postCount={userPostCount}
              followersCount={myFollowersCount}
              followingCount={myFollowingCount}
              token={token}
            />
          </div>
        </aside>

        {/* Center feed — bordered timeline column */}
        <div className="lg:col-span-6 lg:border-x lg:border-border dark:lg:border-[#222] min-h-screen">
          {/* Stories bar */}
          <div className="border-b border-border px-4 py-3">
            <StoriesBar
              groups={storyGroups}
              storiesLoaded={storiesLoaded}
              user={user}
              onAddStory={() => setShowUploadStory(true)}
              onViewGroup={(g) => { setViewingGroup(g); setViewingIdx(0); }}
              viewedStoryIds={viewedStoryIds}
            />
          </div>

          {/* Your Classes Today */}
          {(todayClasses.length > 0 || noTimetableProfile) && (
            <div className="border-b border-border px-4 py-3">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Your Classes Today</p>
                  <span className="text-[14px]">📚</span>
                </div>
                <Link href="/timetable" className="text-[11px] font-medium text-brand-600 hover:text-brand-700 transition dark:text-brand-400">
                  View full timetable →
                </Link>
              </div>
              {noTimetableProfile ? (
                <p className="text-[12px] text-ink-muted">
                  <Link href="/settings#account" className="text-brand-600 hover:underline">Set your department in Settings</Link> to see your timetable
                </p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                  {todayClasses.map(cls => (
                    <div key={cls.id} className="flex min-w-[200px] max-w-[240px] shrink-0 flex-col gap-1.5 rounded-2xl bg-indigo-50 p-3.5 dark:bg-indigo-950/40">
                      <p className="text-[13px] font-bold text-indigo-800 dark:text-indigo-200 leading-snug">
                        {cls.course_code && <span className="mr-1">{cls.course_code}</span>}{cls.course_title}
                      </p>
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {cls.start_time} – {cls.end_time}
                      </p>
                      {cls.venue && <p className="text-[11px] text-indigo-500 dark:text-indigo-400">📍 {cls.venue}</p>}
                      {cls.lecturer && <p className="text-[11px] text-indigo-500 dark:text-indigo-400">👨‍🏫 {cls.lecturer}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Today's Highlights */}
          {highlights.length > 0 && (
            <div className="border-b border-border px-4 py-3">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Today&apos;s Highlights
              </p>
              <div className="flex gap-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {highlights.map((h) => {
                  const cfg = HIGHLIGHT_CONFIG[h.type] ?? HIGHLIGHT_CONFIG.announcement;
                  const countdown = highlightCountdown(h.start_date);
                  return (
                    <div
                      key={h.id}
                      className={cn('flex min-w-[200px] max-w-[240px] shrink-0 flex-col gap-1.5 rounded-2xl p-3.5', cfg.bg)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xl leading-none">{cfg.icon}</span>
                        {countdown && (
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.badgeCls)}>
                            {countdown}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-[13px] font-semibold leading-snug', cfg.titleColor)}>{h.title}</p>
                      {h.description && (
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-muted">{h.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Birthdays Today */}
          {(isMyBirthday || birthdayUsers.length > 0) && (
            <div className="border-b border-border px-4 py-3 animate-[fadeIn_0.4s_ease-out]">
              <div className="mb-2.5 flex items-center gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Birthdays Today</p>
                <span className="text-[15px]">🎂</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {isMyBirthday && user && (
                  <div className="flex min-w-[156px] shrink-0 flex-col items-center gap-2 rounded-2xl border border-pink-200 bg-gradient-to-b from-pink-50 to-rose-50 p-3.5 text-center dark:border-pink-900/50 dark:from-pink-950/40 dark:to-rose-950/30">
                    <div className="relative">
                      <Avatar src={user.profile_photo_url} name={user.full_name} size="md" />
                      <span className="absolute -top-1 -right-1 text-[14px]">🎉</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-pink-700 dark:text-pink-300">Happy Birthday!</p>
                      <p className="text-[11px] text-ink-muted">{user.full_name}</p>
                    </div>
                  </div>
                )}
                {birthdayUsers.map(bu => (
                  <div key={bu.id} className="flex min-w-[156px] shrink-0 flex-col items-center gap-2 rounded-2xl border border-pink-200 bg-gradient-to-b from-pink-50 to-rose-50 p-3.5 text-center dark:border-pink-900/50 dark:from-pink-950/40 dark:to-rose-950/30">
                    <Avatar src={bu.profile_photo_url} name={bu.full_name} size="md" />
                    <div>
                      <p className="text-[13px] font-semibold text-ink leading-tight">{bu.full_name}</p>
                      <p className="text-[11px] text-ink-muted">{bu.department}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-pink-600 dark:text-pink-400">🎂 Today!</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/messages?userId=${bu.id}`)}
                      className="rounded-full bg-pink-100 px-3 py-1 text-[11px] font-semibold text-pink-700 transition hover:bg-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:hover:bg-pink-900/60"
                    >
                      Wish them well 🎉
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sticky category filter tabs */}
          <div className="sticky top-14 z-20 border-b border-border bg-white/95 backdrop-blur-sm dark:bg-[#0a0a0a]/95 dark:border-[#222]">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex min-w-max gap-0 pl-2 pr-4">
                {[{ value: 'ALL', label: 'All' }, ...POST_CATEGORIES].map(cat => (
                  <button key={cat.value} type="button"
                    onClick={() => setCategoryFilter(cat.value as PostCategory | 'ALL')}
                    className={cn(
                      'shrink-0 border-b-2 px-3.5 py-3 text-[13px] font-medium transition whitespace-nowrap',
                      categoryFilter === cat.value
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-ink-muted hover:text-ink hover:border-border'
                    )}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="border-b border-border px-4 py-3 text-sm text-red-600 bg-red-50">
              {error}
            </div>
          )}

          {/* Composer */}
          <div className="border-b border-border px-4 py-4">
            <form onSubmit={handleCreatePost}>
              <div className="flex gap-3">
                <Avatar src={user.profile_photo_url} name={user.full_name} size="md" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  {(composerMode === 'discussion' || composerMode === 'question') && (
                    <input
                      type="text"
                      value={discussionTitle}
                      onChange={(e) => setDiscussionTitle(e.target.value.slice(0, 100))}
                      placeholder={composerMode === 'question' ? 'Ask your question… (required)' : 'Discussion title (required)'}
                      maxLength={100}
                      className="mb-2 w-full border-b border-border bg-transparent pb-2 text-[16px] font-semibold text-ink placeholder:text-ink-muted focus:outline-none"
                    />
                  )}
                  {composerMode === 'event' && (
                    <div className="mb-3 space-y-2">
                      <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value.slice(0, 200))}
                        placeholder="Event title (required)" maxLength={200}
                        className="w-full border-b border-border bg-transparent pb-2 text-[16px] font-semibold text-ink placeholder:text-ink-muted focus:outline-none" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1 text-[11px] text-ink-muted">Date & Time</p>
                          <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)}
                            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-[13px] text-ink focus:border-brand-500 focus:outline-none dark:border-[#333]" />
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] text-ink-muted">Location (optional)</p>
                          <input type="text" value={eventLocation} onChange={e => setEventLocation(e.target.value)}
                            placeholder="e.g. Faculty Hall" maxLength={200}
                            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none dark:border-[#333]" />
                        </div>
                      </div>
                    </div>
                  )}
                  {composerMode === 'poll' && (
                    <div className="mb-3 space-y-2">
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="text" value={opt}
                            onChange={e => setPollOptions(opts => opts.map((o, j) => j === i ? e.target.value : o))}
                            placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ''}`} maxLength={200}
                            className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none dark:border-[#333]" />
                          {i >= 2 && (
                            <button type="button" onClick={() => setPollOptions(opts => opts.filter((_, j) => j !== i))}
                              className="text-ink-muted hover:text-red-500 transition">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 4 && (
                        <button type="button" onClick={() => setPollOptions(opts => [...opts, ''])}
                          className="text-[13px] font-medium text-brand-600 hover:text-brand-700 transition">
                          + Add option
                        </button>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] text-ink-muted">Duration:</span>
                        {([24, 48, 72, 168] as const).map(d => (
                          <button key={d} type="button" onClick={() => setPollDuration(d)}
                            className={cn('rounded-full px-2.5 py-1 text-[12px] font-medium transition',
                              pollDuration === d ? 'bg-indigo-600 text-white' : 'bg-surface-muted text-ink-secondary hover:text-ink dark:bg-[#1a1a1a]'
                            )}>
                            {d === 24 ? '1 day' : d === 48 ? '2 days' : d === 72 ? '3 days' : '1 week'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    value={newPost}
                    onChange={(e) => { setNewPost(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }}
                    placeholder={
                      composerMode === 'discussion' ? 'Add context or details (optional)…' :
                      composerMode === 'question' ? 'Add context or description (optional)…' :
                      composerMode === 'poll' ? 'Describe what you\'re asking (optional)…' :
                      composerMode === 'event' ? 'Event description (optional)…' :
                      "What's happening on campus?"
                    }
                    rows={1}
                    className="w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus:outline-none leading-relaxed"
                    style={{ minHeight: '28px', maxHeight: '200px', overflow: 'hidden' }}
                  />

                  {imagePreview && (
                    <div className="relative mt-3">
                      <img src={imagePreview} alt="Preview" className="max-h-56 w-full rounded-2xl object-cover" />
                      <button type="button" onClick={removeImage}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button type="button" onClick={() => imageInputRef.current?.click()}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-600 transition hover:bg-brand-50" title="Add photo">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </button>
                      <button type="button"
                        onClick={() => { setComposerMode(m => m === 'discussion' ? 'post' : 'discussion'); setDiscussionTitle(''); }}
                        title="Start a discussion"
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] transition',
                          composerMode === 'discussion'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                        )}>
                        💬
                      </button>
                      <button type="button"
                        onClick={() => { setComposerMode(m => m === 'question' ? 'post' : 'question'); setDiscussionTitle(''); }}
                        title="Ask a question"
                        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] transition',
                          composerMode === 'question' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' : 'text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40'
                        )}>❓</button>
                      <button type="button"
                        onClick={() => setComposerMode(m => m === 'poll' ? 'post' : 'poll')}
                        title="Create a poll"
                        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] transition',
                          composerMode === 'poll' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        )}>📊</button>
                      <button type="button"
                        onClick={() => { setComposerMode(m => m === 'event' ? 'post' : 'event'); setEventTitle(''); setEventDate(''); setEventLocation(''); }}
                        title="Create an event"
                        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] transition',
                          composerMode === 'event' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40'
                        )}>📅</button>
                      <select
                        value={newPostCategory}
                        onChange={e => setNewPostCategory(e.target.value as PostCategory)}
                        className="min-w-0 rounded-full border border-border bg-transparent py-1.5 pl-3 pr-2 text-[13px] text-ink-secondary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      >
                        {POST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      {myChannels.length > 0 && (
                        <select
                          value={selectedChannelId ?? ''}
                          onChange={e => setSelectedChannelId(e.target.value ? Number(e.target.value) : null)}
                          className="min-w-0 rounded-full border border-border bg-transparent py-1.5 pl-3 pr-2 text-[13px] text-ink-secondary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        >
                          <option value="">📌 Feed only</option>
                          {myChannels.map(ch => (
                            <option key={ch.id} value={ch.id}>{ch.icon} {ch.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <Button type="submit" size="sm"
                      disabled={posting || (
                        composerMode === 'discussion' ? !discussionTitle.trim() :
                        composerMode === 'question' ? !discussionTitle.trim() :
                        composerMode === 'poll' ? pollOptions.filter(o => o.trim()).length < 2 :
                        composerMode === 'event' ? (!eventTitle.trim() || !eventDate) :
                        !newPost.trim()
                      )}
                      loading={posting}
                      className={cn('shrink-0 rounded-full px-5',
                        composerMode === 'discussion' && 'bg-purple-600 hover:bg-purple-700',
                        composerMode === 'question' && 'bg-cyan-600 hover:bg-cyan-700',
                        composerMode === 'poll' && 'bg-indigo-600 hover:bg-indigo-700',
                        composerMode === 'event' && 'bg-green-600 hover:bg-green-700',
                      )}>
                      {composerMode === 'discussion' ? 'Discuss' :
                       composerMode === 'question' ? 'Ask' :
                       composerMode === 'poll' ? 'Create Poll' :
                       composerMode === 'event' ? 'Create Event' :
                       'Post'}
                    </Button>
                  </div>

                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </div>
              </div>
            </form>
          </div>

          {/* Posts */}
          {loading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : posts.filter(p => categoryFilter === 'ALL' || p.category === categoryFilter).length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="font-medium text-ink">No posts yet</p>
              <p className="mt-1 text-[14px] text-ink-muted">Be the first to share something with the ABU community!</p>
            </div>
          ) : (
            posts
              .filter(post => categoryFilter === 'ALL' || post.category === categoryFilter)
              .map((post) => {
                const isExpanded = expandedPosts.has(post.id);
                const longContent = post.content.length > 280;
              return (
              /* ── Post Card (flat, Twitter-style) ── */
              <article key={post.id} id={`post-${post.id}`} data-post-id={post.id}
                className="border-b border-border px-4 py-4 scroll-mt-20 hover:bg-gray-50/40 dark:hover:bg-white/[0.03] transition-colors dark:border-[#222]">

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
                          {post.post_subtype === 'discussion' && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                              💬 Discussion
                            </span>
                          )}
                          {post.post_subtype === 'question' && (
                            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                              ❓ Question
                            </span>
                          )}
                          {post.post_subtype === 'poll' && (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              📊 Poll
                            </span>
                          )}
                          {post.post_subtype === 'event' && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
                              📅 Event
                            </span>
                          )}
                          {post.is_hot ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                              ⚡ Hot
                            </span>
                          ) : post.is_trending ? (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                              🔥 Trending
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[13px] text-ink-muted">
                          {post.author_department} · {timeAgo(post.created_at)}
                        </p>
                      </div>

                      {/* Follow button */}
                      {post.user_id !== user.id && !post.is_following_author && (
                        <button type="button" onClick={() => handleFollowFromCard(post.user_id)}
                          className="shrink-0 rounded-full border border-brand-500 px-3 py-0.5 text-[12px] font-semibold text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-950">
                          Follow
                        </button>
                      )}

                      {/* ⋮ menu */}
                      <div className="relative shrink-0" ref={postMenuId === post.id ? postMenuRef : undefined}>
                        <button type="button"
                          onClick={() => setPostMenuId(postMenuId === post.id ? null : post.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>
                        {postMenuId === post.id && (
                          <div className="absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:bg-[#111] dark:border-[#222]">
                            {post.user_id === user.id && (
                              <button type="button"
                                onClick={() => { handleDelete(post.id); setPostMenuId(null); }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                Delete post
                              </button>
                            )}
                            <button type="button" onClick={() => setPostMenuId(null)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-ink-secondary hover:bg-surface-muted transition">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 011.743-1.342 48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664L19.5 19.5" /></svg>
                              Report post
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content with show more/less */}
                    <div className="mt-2">
                      {post.post_subtype === 'discussion' && post.discussion_title && (
                        <p className="mb-1 text-[16px] font-bold text-ink leading-snug">{post.discussion_title}</p>
                      )}
                      <p className={cn('text-[15px] text-ink leading-[1.6]', !isExpanded && longContent && 'line-clamp-3', post.post_subtype === 'discussion' && !post.content && 'hidden')}>
                        <PostContent content={post.content} />
                      </p>
                      {longContent && (
                        <button type="button"
                          onClick={() => setExpandedPosts(prev => { const n = new Set(prev); if (isExpanded) n.delete(post.id); else n.add(post.id); return n; })}
                          className="mt-0.5 text-[14px] font-medium text-brand-600 hover:text-brand-700">
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>

                    {/* Post image */}
                    {post.image_url && (
                      <button type="button" onClick={() => setLightboxUrl(post.image_url)}
                        className="mt-3 block w-full overflow-hidden rounded-2xl border border-border/60">
                        <img src={post.image_url} alt="Post" className="max-h-[400px] w-full object-cover transition hover:opacity-95" />
                      </button>
                    )}

                    {/* Poll */}
                    {post.post_subtype === 'poll' && post.poll_options && (() => {
                      const totalVotes = post.poll_options.reduce((s, o) => s + o.vote_count, 0);
                      const hasVoted = !!post.voted_option_id;
                      const isExpiredPoll = post.poll_ends_at ? new Date(post.poll_ends_at) < new Date() : false;
                      return (
                        <div className="mt-3 space-y-2">
                          {post.poll_options.map(opt => {
                            const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
                            const isChosen = post.voted_option_id === opt.id;
                            return (
                              <button key={opt.id} type="button"
                                disabled={hasVoted || isExpiredPoll}
                                onClick={() => !hasVoted && !isExpiredPoll && handleVote(post.id, opt.id)}
                                className={cn('relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-[14px] transition',
                                  isChosen ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-border dark:border-[#333]',
                                  !hasVoted && !isExpiredPoll && 'hover:border-brand-400 cursor-pointer',
                                  (hasVoted || isExpiredPoll) && 'cursor-default'
                                )}>
                                {(hasVoted || isExpiredPoll) && (
                                  <div className="absolute inset-y-0 left-0 rounded-xl bg-brand-100/60 dark:bg-brand-950/30" style={{ width: `${pct}%` }} />
                                )}
                                <div className="relative flex items-center justify-between">
                                  <span className={cn('font-medium', isChosen ? 'text-brand-700 dark:text-brand-300' : 'text-ink')}>{opt.option_text}</span>
                                  {(hasVoted || isExpiredPoll) && <span className="text-[13px] text-ink-muted">{pct}%</span>}
                                </div>
                              </button>
                            );
                          })}
                          <p className="text-[12px] text-ink-muted">
                            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                            {post.poll_ends_at && <> · {new Date(post.poll_ends_at) > new Date() ? `ends ${timeAgo(post.poll_ends_at)}` : 'Poll ended'}</>}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Event card */}
                    {post.post_subtype === 'event' && post.event_title && (
                      <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3.5 dark:border-green-900/40 dark:bg-green-950/30">
                        <p className="font-bold text-[15px] text-ink">{post.event_title}</p>
                        {post.event_date && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
                            <span>📅</span>
                            {new Date(post.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        )}
                        {post.event_location && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
                            <span>📍</span>{post.event_location}
                          </p>
                        )}
                        <button type="button" onClick={() => handleRSVP(post.id)}
                          className={cn('mt-3 rounded-full px-4 py-1.5 text-[13px] font-semibold transition',
                            post.is_attending
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'border border-green-600 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/40'
                          )}>
                          {post.is_attending ? `✅ Attending (${post.event_rsvp_count})` : `RSVP${post.event_rsvp_count > 0 ? ` · ${post.event_rsvp_count}` : ''}`}
                        </button>
                      </div>
                    )}

                    {(post.comment_velocity ?? 0) > 3 && (
                      <div className="mt-2.5">
                        <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-400">
                          💬 Active discussion
                        </span>
                      </div>
                    )}

                    {/* Action row — icon-only buttons, evenly spaced */}
                    <div className="mt-3 flex items-center justify-between">
                      {/* Like */}
                      <button type="button" onClick={() => handleLike(post.id)}
                        className={cn('group flex items-center gap-1 text-[13px] transition',
                          post.is_liked ? 'text-rose-500' : 'text-ink-muted hover:text-rose-500')}>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-rose-50">
                          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                            fill={post.is_liked ? 'currentColor' : 'none'}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                        </span>
                        {post.likes_count > 0 && <span>{post.likes_count}</span>}
                      </button>

                      {/* Comment */}
                      <button type="button" onClick={() => setCommentingId(commentingId === post.id ? null : post.id)}
                        className={cn('group flex items-center gap-1 text-[13px] transition',
                          commentingId === post.id ? 'text-brand-600' : 'text-ink-muted hover:text-brand-600')}>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-brand-50">
                          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.74 1.676v2.954a.75.75 0 01-1.088.67L6.19 21.1a.75.75 0 01-.365-.633v-1.44C3.512 17.962 3 15.075 3 12z" />
                          </svg>
                        </span>
                        {post.comments_count > 0 && (
                          <span>
                            {post.comments_count}
                            {post.post_subtype === 'discussion' && <span className="ml-0.5 text-[11px]"> replies</span>}
                            {post.post_subtype === 'question' && <span className="ml-0.5 text-[11px]"> answers</span>}
                          </span>
                        )}
                      </button>

                      {/* Repost */}
                      {post.user_id !== user.id ? (
                        <button type="button" onClick={() => handleRepost(post.id)} disabled={repostingId === post.id}
                          className="group flex items-center gap-1 text-[13px] text-ink-muted transition hover:text-brand-600 disabled:opacity-40">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-brand-50">
                            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                            </svg>
                          </span>
                          {post.repost_count > 0 && <span>{post.repost_count}</span>}
                        </button>
                      ) : <span className="w-9" />}

                      {/* Share */}
                      <button type="button" onClick={() => openShareModal(post)}
                        className="group flex items-center gap-1 text-[13px] text-ink-muted transition hover:text-brand-600">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full transition group-hover:bg-brand-50">
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
                        {formatCount(post.view_count)}
                      </span>
                    </div>
                    {(post.engagement_score ?? 0) > 0 && (
                      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-border/50">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500',
                            (post.engagement_score ?? 0) > 50
                              ? 'bg-red-400 dark:bg-red-500'
                              : (post.engagement_score ?? 0) > 20
                              ? 'bg-amber-400 dark:bg-amber-500'
                              : 'bg-green-400 dark:bg-green-500'
                          )}
                          style={{ width: `${Math.min(100, Math.max(3, ((post.engagement_score ?? 0) / maxEngagementScore) * 100))}%` }}
                        />
                      </div>
                    )}

                      {/* Comments section */}
                      {commentingId === post.id && (
                        <div className="mt-4 border-t border-border pt-4">
                          {/* Existing comments */}
                          {commentsLoading[post.id] ? (
                            <div className="mb-3 space-y-3">
                              {[1, 2].map((i) => (
                                <div key={i} className="flex gap-2.5">
                                  <Skeleton className="h-8 w-8 shrink-0" rounded="full" />
                                  <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-3 w-full" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (comments[post.id] ?? []).length > 0 ? (
                            <div className="mb-4 space-y-4">
                              {(comments[post.id] ?? []).map((c) => (
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
                                        {c.is_best_answer && (
                                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
                                            ✓ Best Answer
                                          </div>
                                        )}
                                      </div>
                                      {/* Reply button + view replies */}
                                      <div className="ml-2 mt-1 flex items-center gap-3">
                                        <button type="button"
                                          onClick={() => {
                                            if (replyingTo?.commentId === c.id) { setReplyingTo(null); }
                                            else { setReplyingTo({ postId: post.id, commentId: c.id }); setReplyText(''); }
                                          }}
                                          className="text-caption font-medium text-ink-secondary transition hover:text-brand-600">
                                          Reply
                                        </button>
                                        {post.post_subtype === 'question' && post.user_id === user.id && !c.is_best_answer && (
                                          <button type="button"
                                            onClick={() => handleMarkBestAnswer(post.id, c.id)}
                                            className="text-caption font-medium text-green-600 transition hover:text-green-700">
                                            ✓ Best Answer
                                          </button>
                                        )}
                                        {(c.reply_count > 0 || (replies[c.id]?.length ?? 0) > 0) && (
                                          <button type="button"
                                            onClick={() => toggleReplies(post.id, c.id)}
                                            className="text-caption text-ink-muted transition hover:text-brand-600">
                                            {expandedReplies.has(c.id)
                                              ? 'Hide replies'
                                              : `View ${c.reply_count > 0 ? c.reply_count : replies[c.id]?.length} ${(c.reply_count === 1 || replies[c.id]?.length === 1) ? 'reply' : 'replies'}`}
                                          </button>
                                        )}
                                      </div>
                                      {/* Reply input */}
                                      {replyingTo?.commentId === c.id && (
                                        <div className="ml-2 mt-2 flex gap-2">
                                          <Avatar src={user.profile_photo_url} name={user.full_name} size="sm" className="shrink-0" />
                                          <div className="flex min-w-0 flex-1 gap-2">
                                            <Input
                                              value={replyText}
                                              onChange={(e) => setReplyText(e.target.value)}
                                              placeholder={`Reply to ${c.author_name}…`}
                                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(post.id, c.id); } }}
                                              className="flex-1 text-sm"
                                            />
                                            <Button onClick={() => handleReply(post.id, c.id)} size="sm" disabled={!replyText.trim()}>Post</Button>
                                          </div>
                                        </div>
                                      )}
                                      {/* Expanded replies */}
                                      {expandedReplies.has(c.id) && (
                                        <div className="ml-6 mt-2 space-y-2 border-l-2 border-border pl-3">
                                          {repliesLoading[c.id] ? (
                                            <div className="space-y-2 py-1">
                                              {[1, 2].map((i) => (
                                                <div key={i} className="flex gap-2">
                                                  <Skeleton className="h-6 w-6 shrink-0" rounded="full" />
                                                  <div className="flex-1 space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-full" /></div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (replies[c.id] ?? []).length === 0 ? (
                                            <p className="py-1 text-caption text-ink-muted">No replies yet.</p>
                                          ) : (
                                            (replies[c.id] ?? []).map((r) => (
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
                          ) : (
                            <p className="mb-3 text-center text-caption text-ink-muted">No comments yet — be the first!</p>
                          )}

                          {/* New comment input */}
                          <div className="flex gap-2">
                            <Avatar src={user.profile_photo_url} name={user.full_name} size="sm" className="shrink-0" />
                            <div className="flex min-w-0 flex-1 gap-2">
                              <Input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Write a comment…"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleComment(post.id);
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                onClick={() => handleComment(post.id)}
                                size="sm"
                                disabled={!commentText.trim()}
                              >
                                Post
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </article>
              );
            })
          )}
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:col-span-3 lg:block lg:py-6 lg:pl-6 lg:pr-4">
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
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-ink">Trending on campus</h3>
                  <span className="text-caption text-ink-muted">↻ 5 min</span>
                </div>
                <div className="mt-3 space-y-0.5">
                  {trendingHashtags.length === 0 ? (
                    <p className="py-2 text-caption text-ink-muted">No trending hashtags yet.</p>
                  ) : (() => {
                    const maxCount = trendingHashtags[0]?.post_count ?? 1;
                    return trendingHashtags.map((topic, idx) => (
                      <Link
                        key={topic.tag}
                        href={`/hashtag/${topic.tag}`}
                        className="group flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[13px] font-semibold text-brand-600 group-hover:text-brand-700 dark:text-brand-400 dark:group-hover:text-brand-300">
                              #{topic.tag}
                            </p>
                            {idx < 3 && <span className="text-[11px] leading-none">🔥</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                              <div
                                className="h-full rounded-full bg-brand-400/70 transition-all"
                                style={{ width: `${Math.max(8, (topic.post_count / maxCount) * 100)}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[11px] text-ink-muted">{topic.post_count}</span>
                          </div>
                        </div>
                      </Link>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            {activePosts.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-ink">People are talking</h3>
                  <div className="mt-3 space-y-3">
                    {activePosts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => router.push(`/post/${p.id}`)}
                        className="flex w-full items-start gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]"
                      >
                        <Avatar src={p.author_photo} name={p.author_name} size="sm" className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[12px] leading-snug text-ink">
                            {p.discussion_title || p.content}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                            💬 {p.comment_velocity} comment{p.comment_velocity !== 1 ? 's' : ''} this hour
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </aside>
      </div>

      {/* Story Viewer */}
      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          index={viewingIdx}
          onClose={() => setViewingGroup(null)}
          onPrev={() => viewingIdx > 0 ? setViewingIdx(i => i - 1) : setViewingGroup(null)}
          onNext={() => viewingIdx < viewingGroup.stories.length - 1 ? setViewingIdx(i => i + 1) : setViewingGroup(null)}
          onDelete={handleDeleteStory}
          onAddStory={() => setShowUploadStory(true)}
          reactions={storyReactions[viewingGroup.stories[viewingIdx]?.id]}
          onReact={() => viewingGroup.stories[viewingIdx] && handleToggleReaction(viewingGroup.stories[viewingIdx].id)}
          showReplyInput={showStoryReply}
          onToggleReply={() => setShowStoryReply(v => !v)}
          replyText={storyReplyText}
          onReplyChange={setStoryReplyText}
          onSendReply={() => viewingGroup.stories[viewingIdx] && handleSendStoryReply(viewingGroup.stories[viewingIdx].id)}
          replySending={storyReplySending}
          likers={storyLikers}
          viewCount={viewingGroup.stories[viewingIdx]?.view_count ?? 0}
          isPaused={storyPaused}
          onPauseToggle={() => setStoryPaused(p => !p)}
        />
      )}

      {/* Story Upload modal */}
      {showUploadStory && (() => {
        const BG_PRESETS = ['#16a34a','#1d4ed8','#7c3aed','#dc2626','#ea580c','#0891b2','#111827','#be185d'];
        const closeModal = () => { setShowUploadStory(false); setStoryFile(null); setStoryPreview(null); setStoryText(''); setStoryBgColor('#16a34a'); setStoryTab('media'); setStoryCaption(''); setStoryUploadError(''); setStoryUploadProgress(null); };
        const canShare = storyTab === 'text' ? storyText.trim().length > 0 : !!storyFile;
        const textLen = storyText.length;
        const textSize = textLen > 100 ? 'text-xl' : textLen > 50 ? 'text-2xl' : 'text-3xl';
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#111] dark:border dark:border-[#222]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#222]">
                <h3 className="font-semibold text-ink">Add to Status</h3>
                <button type="button" onClick={closeModal}
                  className="rounded-lg p-1 text-ink-secondary hover:bg-surface-muted">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Tabs */}
              <div className="flex border-b border-border dark:border-[#222]">
                <button type="button"
                  onClick={() => setStoryTab('media')}
                  className={cn('flex-1 py-2.5 text-sm font-medium transition-colors',
                    storyTab === 'media' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-ink-muted hover:text-ink')}>
                  Photo / Video
                </button>
                <button type="button"
                  onClick={() => setStoryTab('text')}
                  className={cn('flex-1 py-2.5 text-sm font-medium transition-colors',
                    storyTab === 'text' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-ink-muted hover:text-ink')}>
                  Text
                </button>
              </div>
              <div className="p-5">
                {storyTab === 'media' ? (
                  <>
                    {storyPreview ? (
                      <>
                        <div className="relative mb-4">
                          {storyFile?.type.startsWith('video') ? (
                            <video src={storyPreview} className="max-h-64 w-full rounded-xl object-cover" controls />
                          ) : (
                            <img src={storyPreview} alt="Preview" className="max-h-64 w-full rounded-xl object-cover" />
                          )}
                          <button type="button" onClick={() => { setStoryFile(null); setStoryPreview(null); setStoryCaption(''); }}
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <div className="mt-3">
                          <textarea
                            value={storyCaption}
                            onChange={e => setStoryCaption(e.target.value.slice(0, 150))}
                            placeholder="Add a caption..."
                            rows={2}
                            className="w-full resize-none rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#1a1a1a] dark:border-[#333]"
                          />
                          <p className="mt-1 text-right text-[11px] text-ink-muted">{storyCaption.length}/150</p>
                        </div>
                      </>
                    ) : (
                      <button type="button" onClick={() => storyInputRef.current?.click()}
                        className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-ink-muted transition hover:border-brand-400 hover:text-brand-600">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <p className="text-body-sm font-medium">Tap to add photo or video</p>
                        <p className="text-caption">Story disappears after 24 hours</p>
                      </button>
                    )}
                    <input ref={storyInputRef} type="file" accept="image/*,video/*" onChange={handleStoryFileSelect} className="hidden" />
                  </>
                ) : (
                  <>
                    {/* Live preview */}
                    <div className="mb-4 flex h-44 w-full items-center justify-center rounded-xl px-4"
                      style={{ backgroundColor: storyBgColor }}>
                      <p className={cn('text-center font-bold leading-tight text-white break-words w-full', textSize)}>
                        {storyText || <span className="opacity-40">Your text here…</span>}
                      </p>
                    </div>
                    {/* Textarea */}
                    <textarea
                      value={storyText}
                      onChange={e => setStoryText(e.target.value)}
                      maxLength={280}
                      rows={3}
                      placeholder="Write something…"
                      className="mb-3 w-full resize-none rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#1a1a1a] dark:border-[#333]"
                    />
                    {/* Color picker */}
                    <div className="mb-4 flex gap-2">
                      {BG_PRESETS.map(c => (
                        <button key={c} type="button"
                          onClick={() => setStoryBgColor(c)}
                          className={cn('h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110',
                            storyBgColor === c ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : '')}
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </>
                )}
                {storyUploadError && (
                  <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    {storyUploadError}
                  </p>
                )}
                {uploadingStory && storyUploadProgress !== null && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
                      <span>Uploading…</span>
                      <span>{storyUploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all duration-300"
                        style={{ width: `${storyUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
                  <Button className="flex-1" disabled={!canShare || uploadingStory} loading={uploadingStory} onClick={handleUploadStory}>
                    Share Story
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Share Post modal */}
      {sharePost && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
          onClick={(e) => { if (e.target === e.currentTarget) setSharePost(null); }}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#111] dark:border dark:border-[#222]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#222]">
              <h3 className="font-semibold text-ink">Share Post</h3>
              <button type="button" onClick={() => setSharePost(null)}
                className="rounded-lg p-1 text-ink-secondary hover:bg-surface-muted">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Post preview */}
            <div className="border-b border-border bg-surface-muted px-5 py-3">
              <p className="line-clamp-2 text-caption text-ink-secondary">{sharePost.content}</p>
            </div>

            {/* Copy link */}
            <div className="border-b border-border px-5 py-3">
              <button type="button" onClick={() => handleCopyPostLink(sharePost.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border border-border px-4 py-2.5 text-left transition hover:border-brand-400 hover:bg-brand-50', shareCopied && 'border-brand-600 bg-brand-50')}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <span className={cn('text-body-sm font-medium', shareCopied ? 'text-brand-600' : 'text-ink')}>
                  {shareCopied ? '✓ Link copied!' : 'Copy link'}
                </span>
              </button>
            </div>

            {/* Share to follower */}
            <div className="px-5 py-3">
              <p className="mb-2.5 text-body-sm font-medium text-ink">Share to…</p>
              <Input value={shareSearch} onChange={(e) => setShareSearch(e.target.value)} placeholder="Search people you follow…" className="mb-2" />
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border dark:border-[#222]">
                {shareLoading ? (
                  <div className="space-y-0 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <Skeleton className="h-9 w-9 shrink-0" rounded="full" />
                        <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
                      </div>
                    ))}
                  </div>
                ) : shareFollowers.filter((f) => f.full_name.toLowerCase().includes(shareSearch.toLowerCase())).length === 0 ? (
                  <p className="py-8 text-center text-caption text-ink-muted">
                    {shareSearch ? 'No results' : 'Follow people to share posts with them'}
                  </p>
                ) : (
                  shareFollowers
                    .filter((f) => f.full_name.toLowerCase().includes(shareSearch.toLowerCase()))
                    .map((f) => {
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
  const [hovered, setHovered] = useState(false);

  const handleClick = async () => {
    await toggle();
    if (!isFollowing) {
      // Just followed — remove from list after a beat
      setTimeout(() => onFollowed(user.id), 700);
    }
    // If unfollowing from sidebar (edge case), keep them visible so user can re-follow
  };

  const label = isFollowing ? (hovered ? 'Unfollow' : 'Following') : 'Follow';

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
        variant={isFollowing ? 'outline' : 'outline'}
        size="sm"
        onClick={handleClick}
        loading={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'min-w-[82px] transition-colors',
          isFollowing && hovered
            ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
            : isFollowing
            ? 'border-brand-400 text-brand-700 dark:border-brand-600 dark:text-brand-400'
            : ''
        )}
      >
        {label}
      </Button>
    </div>
  );
}

