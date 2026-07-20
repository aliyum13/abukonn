import { useEffect, useState, useCallback, memo } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Image,
  TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../src/lib/upload';
import { MenuSheet } from '../../src/components/MenuSheet';
import { useTabScrollToTop } from '../../src/lib/useScrollToTop';
import { apiFetch, API_URL } from '../../src/lib/api';
import { getToken } from '../../src/lib/storage';
import { colors, radius, shadow } from '../../src/theme';
import { StoryBar } from '../../src/components/Stories';
import { PostContent } from '../../src/components/PostContent';
import { ShareSheet } from '../../src/components/ShareSheet';
import { ReportModal } from '../../src/components/ReportModal';
import { useAuth } from '../../src/context/AuthContext';
import { friendlyPreview } from '../../src/lib/messagePreview';

interface TodayClass {
  id: number | string;
  course_code: string | null;
  course_title: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  lecturer: string | null;
  status?: 'holding' | 'cancelled';
  override?: {
    kind: 'add' | 'edit' | 'cancel';
    note?: string | null;
    new?: { start_time?: string; end_time?: string; course_code?: string | null; course_title?: string; venue?: string | null; lecturer?: string | null };
  } | null;
}

interface Post {
  id: number;
  user_id: number;
  content: string;
  category?: string;
  image_url: string | null;
  author_name: string;
  author_department: string | null;
  author_photo: string | null;
  author_is_verified?: boolean;
  author_is_content_creator?: boolean;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_reposted?: boolean;
  is_repost?: boolean;
  original_author_name?: string | null;
  original_author_full_name?: string | null;
  original_author_photo?: string | null;
  original_author_id?: number | null;
  reposts_count?: number;
  created_at: string;
  post_subtype?: string | null;
  discussion_title?: string | null;
  poll_options?: Array<{ id: number; option_text: string; vote_count: number }> | null;
  voted_option_id?: number | null;
  poll_ends_at?: string | null;
  event_title?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  event_rsvp_count?: number;
  is_attending?: boolean;
}

interface Comment {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Countdown label for an admin highlight, mirroring web.
function highlightCountdown(startDate: string | null): string {
  if (!startDate) return '';
  const diffDays = Math.ceil((new Date(startDate).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return 'Ongoing';
  if (diffDays === 0) return 'Today!';
  if (diffDays === 1) return 'Tomorrow';
  return `in ${diffDays} days`;
}

// Soft background tint per highlight color name.
const HL_TINT: Record<string, string> = {
  blue: '#eff6ff', red: '#fef2f2', orange: '#fff7ed', green: '#f0fdf4',
  purple: '#faf5ff', pink: '#fdf2f8', yellow: '#fefce8', teal: '#f0fdfa', gray: '#f9fafb',
};

// Memoized so a row only re-renders when its own post changes (like/comment
// counts), not when any other post or unrelated state updates. This is the fix
// for the VirtualizedList slow-update warning on a large feed.
interface PostCardProps {
  post: Post;
  currentUserId?: number;
  onOpenProfile: (userId: number) => void;
  onToggleLike: (post: Post) => void;
  onOpenComments: (post: Post) => void;
  onRepost: (post: Post) => void;
  onShare: (post: Post) => void;
  onMenu: (post: Post) => void;
  onVote: (post: Post, optionId: number) => void;
  onRSVP: (post: Post) => void;
}

const CATEGORY_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  EXAMINATION:  { bg: 'rgba(239,68,68,0.12)',  fg: '#dc2626', label: 'Examination' },
  REGISTRATION: { bg: 'rgba(249,115,22,0.12)', fg: '#ea580c', label: 'Registration' },
  ACADEMIC:     { bg: 'rgba(59,130,246,0.12)', fg: '#2563eb', label: 'Academic' },
  SPORTS:       { bg: 'rgba(234,179,8,0.12)',  fg: '#a16207', label: 'Sports' },
  EVENTS:       { bg: 'rgba(168,85,247,0.12)', fg: '#9333ea', label: 'Events' },
  CAMPUS_LIFE:  { bg: 'rgba(22,163,74,0.12)',  fg: '#16a34a', label: 'Campus Life' },
};

const PostCard = memo(function PostCard({ post, currentUserId, onOpenProfile, onToggleLike, onOpenComments, onRepost, onShare, onMenu, onVote, onRSVP }: PostCardProps) {
  const s = useThemedStyles(make_s);
  const { palette } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const longContent = (post.content?.length ?? 0) > 280;
  // For reposts, the card body shows the ORIGINAL author; the reposter is named
  // in the banner above.
  const displayName = post.is_repost && post.original_author_full_name ? post.original_author_full_name : post.author_name;
  const displayPhoto = post.is_repost && post.original_author_photo !== undefined && post.original_author_photo !== null ? post.original_author_photo : post.author_photo;
  const displayAuthorId = post.is_repost && post.original_author_id ? post.original_author_id : post.user_id;
  return (
    <View style={s.card}>
      {post.is_repost ? (
        <TouchableOpacity style={s.repostBanner} onPress={() => onOpenProfile(post.user_id)} activeOpacity={0.7}>
          <Ionicons name="repeat" size={14} color={palette.textSecondary} />
          <Text style={s.repostBannerText}>{post.author_name} reposted</Text>
        </TouchableOpacity>
      ) : null}
      <View style={s.row}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          activeOpacity={0.7}
          onPress={() => onOpenProfile(displayAuthorId)}
        >
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.fallback]}>
              <Text style={s.letter}>{displayName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={s.authorRow}>
              <Text style={s.author} numberOfLines={1}>{displayName}</Text>
              {post.author_is_verified ? (
                <Ionicons name="checkmark-circle" size={15} color="#3b82f6" style={{ marginLeft: 3 }} />
              ) : null}
              {post.author_is_content_creator ? (
                <View style={s.creatorBadge}><Text style={s.creatorBadgeText}>✎</Text></View>
              ) : null}
              {post.category && post.category !== 'GENERAL' && CATEGORY_CHIP[post.category] ? (
                <View style={[s.postCatChip, { backgroundColor: CATEGORY_CHIP[post.category].bg }]}>
                  <Text style={[s.postCatChipText, { color: CATEGORY_CHIP[post.category].fg }]}>
                    {CATEGORY_CHIP[post.category].label}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={s.muted}>{post.author_department} · {timeAgo(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMenu(post)} hitSlop={12} style={s.menuDots}>
          <Ionicons name="ellipsis-horizontal" size={20} color={palette.muted} />
        </TouchableOpacity>
      </View>

      {(post.post_subtype === 'question' || post.post_subtype === 'discussion')
        && post.discussion_title ? (
          <Text style={s.title}>{post.discussion_title}</Text>
        ) : null}

      {post.content ? (
        <>
          <PostContent
            content={post.content}
            style={s.content}
            numberOfLines={!expanded && longContent ? 3 : undefined}
          />
          {longContent ? (
            <Text style={s.showMore} onPress={() => setExpanded(v => !v)}>
              {expanded ? 'Show less' : 'Show more'}
            </Text>
          ) : null}
        </>
      ) : null}

      {/* Poll */}
      {post.post_subtype === 'poll' && post.poll_options ? (
        <View style={s.pollWrap}>
          {(() => {
            const totalVotes = post.poll_options.reduce((sum, o) => sum + o.vote_count, 0);
            const hasVoted = post.voted_option_id != null;
            const ended = post.poll_ends_at ? new Date(post.poll_ends_at) < new Date() : false;
            return post.poll_options.map(opt => {
              const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
              const isMine = post.voted_option_id === opt.id;
              const showResults = hasVoted || ended;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={s.pollOpt}
                  disabled={hasVoted || ended}
                  onPress={() => onVote(post, opt.id)}
                  activeOpacity={0.7}
                >
                  {showResults ? <View style={[s.pollBar, isMine ? s.pollBarMine : null, { width: `${pct}%` }]} /> : null}
                  <View style={s.pollOptContent}>
                    <Text style={[s.pollOptText, isMine ? s.pollOptTextMine : null]} numberOfLines={2}>
                      {isMine ? '✓ ' : ''}{opt.option_text}
                    </Text>
                    {showResults ? <Text style={s.pollPct}>{pct}%</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            });
          })()}
          <Text style={s.pollMeta}>
            {post.poll_options.reduce((sum, o) => sum + o.vote_count, 0)} votes
            {post.poll_ends_at ? (new Date(post.poll_ends_at) < new Date() ? ' · ended' : ` · ends ${timeAgo(post.poll_ends_at)}`) : ''}
          </Text>
        </View>
      ) : null}

      {/* Event */}
      {post.post_subtype === 'event' && post.event_title ? (
        <View style={s.eventWrap}>
          <View style={s.eventHeader}>
            <Ionicons name="calendar" size={18} color={palette.brand} />
            <Text style={s.eventTitle}>{post.event_title}</Text>
          </View>
          {post.event_date ? <Text style={s.eventDetail}>🗓  {post.event_date}</Text> : null}
          {post.event_location ? <Text style={s.eventDetail}>📍  {post.event_location}</Text> : null}
          <View style={s.eventFooter}>
            <TouchableOpacity
              style={[s.rsvpBtn, post.is_attending ? s.rsvpBtnOn : null]}
              onPress={() => onRSVP(post)}
            >
              <Ionicons
                name={post.is_attending ? 'checkmark-circle' : 'add-circle-outline'}
                size={18}
                color={post.is_attending ? '#fff' : palette.brand}
              />
              <Text style={post.is_attending ? s.rsvpTextOn : s.rsvpText}>
                {post.is_attending ? 'Attending' : 'RSVP'}
              </Text>
            </TouchableOpacity>
            <Text style={s.muted}>{post.event_rsvp_count || 0} going</Text>
          </View>
        </View>
      ) : null}

      {post.image_url ? (
        <Image source={{ uri: post.image_url }} style={s.image} resizeMode="contain" />
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity style={s.action} onPress={() => onToggleLike(post)}>
          <Ionicons
            name={post.is_liked ? 'heart' : 'heart-outline'}
            size={20}
            color={post.is_liked ? palette.danger : palette.textSecondary}
          />
          <Text style={[s.actionText, post.is_liked ? s.liked : null]}>{post.likes_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.action} onPress={() => onOpenComments(post)}>
          <Ionicons name="chatbubble-outline" size={19} color={palette.textSecondary} />
          <Text style={s.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.action} onPress={() => onRepost(post)}>
          <Ionicons name="repeat-outline" size={20} color={post.is_reposted ? palette.brand : palette.textSecondary} />
          {post.reposts_count ? <Text style={[s.actionText, post.is_reposted ? { color: palette.brand } : null]}>{post.reposts_count}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity style={s.action} onPress={() => onShare(post)}>
          <Ionicons name="paper-plane-outline" size={19} color={palette.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const POST_CATEGORIES = [
  { value: 'ALL', label: 'All' },
  { value: 'GENERAL', label: 'General' },
  { value: 'EXAMINATION', label: 'Examination' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'CAMPUS_LIFE', label: 'Campus Life' },
];

export default function Feed() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { ref: listRef, setRefresh } = useTabScrollToTop<Post>();
  const openProfile = useCallback((userId: number) => router.push({ pathname: '/user/[id]', params: { id: String(userId) } }), [router]);
  const followUser = useCallback(async (id: number) => {
    // Optimistically remove from the list — matches web, which drops a suggestion
    // once you follow it.
    setSuggestions(prev => prev.filter(u => u.id !== id));
    try {
      await apiFetch(`/api/follows/${id}`, { method: 'POST' });
    } catch {
      // On failure we simply don't re-add; the list refreshes on next focus.
    }
  }, []);
  const { scheme } = useTheme();
  const { user } = useAuth();

  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [composeOpen, setComposeOpen] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<'post' | 'discussion' | 'question' | 'poll' | 'event'>('post');
  const [composerCategory, setComposerCategory] = useState('GENERAL');
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState(24);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedTab, setFeedTab] = useState<'for_you' | 'following' | 'messages'>('for_you');
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [conversations, setConversations] = useState<{
    id: number; other_user_id: number; other_user_name: string;
    other_user_photo: string | null; last_message: string | null;
    last_message_at: string | null; unread_count: number;
  }[]>([]);
  const [msgGroups, setMsgGroups] = useState<{
    id: number; name: string; member_count: number;
    last_message: string | null; last_message_at: string | null;
  }[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [convoSearch, setConvoSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [category, setCategory] = useState('ALL');
  const [suggestions, setSuggestions] = useState<{ id: number; full_name: string; department: string | null; level: string | null; profile_photo_url: string | null }[]>([]);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [noTimetableProfile, setNoTimetableProfile] = useState(false);
  const [trending, setTrending] = useState<{ tag: string; post_count: number }[]>([]);
  const [highlights, setHighlights] = useState<{
    id: number; title: string; description: string | null; icon: string;
    color: string; start_date: string | null;
  }[]>([]);
  const [showHighlights, setShowHighlights] = useState(false);
  const [birthdays, setBirthdays] = useState<{ id: number; full_name: string; profile_photo_url: string | null }[]>([]);

  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'user'; id: number; name: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ posts: Post[] }>('/api/posts');
      setPosts(data.posts || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); setRefresh(load); }, [load, setRefresh]);

  const loadFollowing = useCallback(async () => {
    setFollowingLoading(true);
    try {
      const data = await apiFetch<{ posts: Post[] }>('/api/posts/following');
      setFollowingPosts(data.posts || []);
    } catch {
      setFollowingPosts([]);
    } finally {
      setFollowingLoading(false);
    }
  }, []);

  useEffect(() => { if (feedTab === 'following') loadFollowing(); }, [feedTab, loadFollowing]);

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const [convData, grpData] = await Promise.all([
        apiFetch<{ conversations: typeof conversations }>('/api/messages/conversations'),
        apiFetch<{ groups: typeof msgGroups }>('/api/groups').catch(() => ({ groups: [] as typeof msgGroups })),
      ]);
      setConversations(convData.conversations || []);
      setMsgGroups(grpData.groups || []);
    } catch {
      setConversations([]);
      setMsgGroups([]);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => { if (feedTab === 'messages') loadConversations(); }, [feedTab, loadConversations]);

  // Merge DMs + groups into one list sorted by last activity, matching web.
  type MsgListItem =
    | { kind: 'dm'; id: number; name: string; photo: string | null; last_message: string | null; last_message_at: string | null; unread_count: number; other_user_name: string }
    | { kind: 'group'; id: number; name: string; member_count: number; last_message: string | null; last_message_at: string | null };
  const messageListItems: MsgListItem[] = [
    ...conversations.map(c => ({ kind: 'dm' as const, id: c.id, name: c.other_user_name, photo: c.other_user_photo, last_message: c.last_message, last_message_at: c.last_message_at, unread_count: c.unread_count, other_user_name: c.other_user_name })),
    ...msgGroups.map(g => ({ kind: 'group' as const, id: g.id, name: g.name, member_count: g.member_count, last_message: g.last_message, last_message_at: g.last_message_at })),
  ].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
  const filteredMessageItems = convoSearch.trim()
    ? messageListItems.filter(i => i.name.toLowerCase().includes(convoSearch.toLowerCase()))
    : messageListItems;

  // Unread badges + who-to-follow (matches web).
  const refreshBadges = useCallback(() => {
    apiFetch<{ count: number }>('/api/messages/unread-count')
      .then(d => setUnreadCount(d.count || 0)).catch(() => {});
    apiFetch<{ count: number }>('/api/notifications/unread-count')
      .then(d => setNotifUnread(d.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshBadges();
    apiFetch<{ suggestions: typeof suggestions }>('/api/follows/suggestions')
      .then(d => setSuggestions(d.suggestions || [])).catch(() => {});
    apiFetch<{ hashtags: typeof trending }>('/api/hashtags/trending?limit=6')
      .then(d => setTrending(d.hashtags || [])).catch(() => {});
    apiFetch<{ highlights: typeof highlights }>('/api/highlights')
      .then(d => setHighlights(d.highlights || [])).catch(() => {});
    apiFetch<{ users: typeof birthdays }>('/api/users/birthdays/today')
      .then(d => setBirthdays(d.users || [])).catch(() => {});
    apiFetch<{ classes: TodayClass[]; no_profile?: boolean }>('/api/timetable/today')
      .then(d => { setTodayClasses(d.classes || []); setNoTimetableProfile(!!d.no_profile); })
      .catch(() => {});
  }, [refreshBadges]);

  // Re-check unread counts whenever the feed regains focus — e.g. after you open
  // Notifications and mark all read, the bell should clear when you come back.
  useFocusEffect(useCallback(() => { refreshBadges(); }, [refreshBadges]));

  // Optimistic: flip immediately, roll back if the server disagrees.
  const mutateBoth = useCallback((id: number, fn: (p: Post) => Post) => {
    setPosts(prev => prev.map(p => (p.id === id ? fn(p) : p)));
    setFollowingPosts(prev => prev.map(p => (p.id === id ? fn(p) : p)));
  }, []);

  const toggleLike = useCallback(async (post: Post) => {
    const was = post.is_liked;
    mutateBoth(post.id, p => ({ ...p, is_liked: !was, likes_count: p.likes_count + (was ? -1 : 1) }));
    try {
      const res = await apiFetch<{ is_liked: boolean; post: Post }>(
        `/api/posts/${post.id}/like`, { method: 'POST' });
      mutateBoth(post.id, p => ({ ...p, is_liked: res.is_liked, likes_count: res.post.likes_count }));
    } catch {
      mutateBoth(post.id, p => ({ ...p, is_liked: was, likes_count: p.likes_count + (was ? 1 : -1) }));
    }
  }, [mutateBoth]);

  const repost = useCallback(async (post: Post) => {
    const was = post.is_reposted;
    mutateBoth(post.id, p => ({
      ...p,
      is_reposted: !was,
      reposts_count: (p.reposts_count || 0) + (was ? -1 : 1),
    }));
    try {
      await apiFetch(`/api/posts/${post.id}/repost`, { method: 'POST' });
    } catch {
      mutateBoth(post.id, p => ({
        ...p,
        is_reposted: was,
        reposts_count: (p.reposts_count || 0) + (was ? 1 : -1),
      }));
    }
  }, [mutateBoth]);

  const voteOnPoll = useCallback(async (post: Post, optionId: number) => {
    if (post.voted_option_id != null) return; // already voted
    // Optimistic: mark voted, bump that option's count.
    mutateBoth(post.id, p => ({
      ...p,
      voted_option_id: optionId,
      poll_options: p.poll_options?.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o) ?? null,
    }));
    try {
      await apiFetch(`/api/posts/${post.id}/vote`, { method: 'POST', body: JSON.stringify({ option_id: optionId }) });
    } catch {
      // revert
      mutateBoth(post.id, p => ({
        ...p,
        voted_option_id: null,
        poll_options: p.poll_options?.map(o => o.id === optionId ? { ...o, vote_count: Math.max(0, o.vote_count - 1) } : o) ?? null,
      }));
    }
  }, [mutateBoth]);

  const toggleRSVP = useCallback(async (post: Post) => {
    const was = post.is_attending;
    mutateBoth(post.id, p => ({
      ...p,
      is_attending: !was,
      event_rsvp_count: Math.max(0, (p.event_rsvp_count || 0) + (was ? -1 : 1)),
    }));
    try {
      const res = await apiFetch<{ attending: boolean }>(`/api/posts/${post.id}/rsvp`, { method: 'POST' });
      // Reconcile with server truth.
      mutateBoth(post.id, p => ({ ...p, is_attending: res.attending }));
    } catch {
      mutateBoth(post.id, p => ({
        ...p,
        is_attending: was,
        event_rsvp_count: Math.max(0, (p.event_rsvp_count || 0) + (was ? 1 : -1)),
      }));
    }
  }, [mutateBoth]);

  const deletePost = useCallback((post: Post) => {
    Alert.alert('Delete post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          // Optimistically remove from both lists.
          setPosts(prev => prev.filter(p => p.id !== post.id));
          setFollowingPosts(prev => prev.filter(p => p.id !== post.id));
          try {
            await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
          } catch {
            load(); // restore on failure
          }
        },
      },
    ]);
  }, [load]);

  const reportPost = useCallback((post: Post) => {
    setReportTarget({ type: 'post', id: post.id, name: post.author_name });
  }, []);

  const blockUser = useCallback((post: Post) => {
    Alert.alert(
      `Block ${post.author_name}?`,
      "You won't see their posts or messages, and they won't see yours. You can unblock them later in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/moderation/block/${post.user_id}`, { method: 'POST' });
              setPosts(prev => prev.filter(p => p.user_id !== post.user_id));
              setFollowingPosts(prev => prev.filter(p => p.user_id !== post.user_id));
              Alert.alert('Blocked', `You've blocked ${post.author_name}.`);
            } catch (err) {
              Alert.alert('Could not block', err instanceof Error ? err.message : '');
            }
          },
        },
      ],
    );
  }, []);

  const openPostMenu = useCallback((post: Post) => {
    const isOwn = user?.id === post.user_id;
    if (isOwn) {
      Alert.alert('Post options', undefined, [
        { text: 'Delete post', style: 'destructive', onPress: () => deletePost(post) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Post options', undefined, [
        { text: 'Report post', onPress: () => reportPost(post) },
        { text: 'Report user', onPress: () => setReportTarget({ type: 'user', id: post.user_id, name: post.author_name }) },
        { text: 'Block user', style: 'destructive', onPress: () => blockUser(post) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [user, deletePost, reportPost, blockUser]);


  const openComments = useCallback(async (post: Post) => {
    setCommentsFor(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      const data = await apiFetch<{ comments: Comment[] }>(`/api/posts/${post.id}/comments`);
      setComments(data.comments || []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const sendComment = async () => {
    if (!commentText.trim() || !commentsFor) return;
    const body = commentText.trim();
    setCommentText('');
    try {
      const res = await apiFetch<{ comment: Comment }>(
        `/api/posts/${commentsFor.id}/comments`,
        { method: 'POST', body: JSON.stringify({ content: body }) });
      setComments(prev => [...prev, res.comment]);
      setPosts(prev => prev.map(p => p.id === commentsFor.id
        ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (err) {
      Alert.alert('Could not post comment', err instanceof Error ? err.message : '');
      setCommentText(body); // don't lose what they typed
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setNewImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) setNewImage(res.assets[0].uri);
  };

  const resetComposer = () => {
    setNewPost(''); setNewImage(null); setComposerMode('post');
    setComposerCategory('GENERAL'); setDiscussionTitle('');
    setPollOptions(['', '']); setPollDuration(24);
    setEventTitle(''); setEventDate(''); setEventLocation('');
  };

  const submitPost = async () => {
    // Per-type validation, mirroring web.
    if ((composerMode === 'discussion' || composerMode === 'question') && !discussionTitle.trim()) {
      Alert.alert('Title required', 'Please add a title.'); return;
    }
    if (composerMode === 'poll' && pollOptions.filter(o => o.trim()).length < 2) {
      Alert.alert('Poll needs options', 'Add at least two options.'); return;
    }
    if (composerMode === 'event' && (!eventTitle.trim() || !eventDate.trim())) {
      Alert.alert('Event needs details', 'Add a title and date.'); return;
    }
    if (composerMode === 'post' && !newPost.trim() && !newImage) return;

    setPosting(true);
    try {
      let imageUrl: string | null = null;
      if (newImage) imageUrl = await uploadImage(newImage, 'abukonn/posts');

      const body: Record<string, unknown> = {
        content: newPost.trim(),
        category: composerCategory,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      if (composerMode === 'discussion' || composerMode === 'question') {
        body.post_subtype = composerMode;
        body.discussion_title = discussionTitle.trim();
      } else if (composerMode === 'poll') {
        body.post_subtype = 'poll';
        body.poll_options = JSON.stringify(pollOptions.filter(o => o.trim()));
        body.poll_duration_hours = pollDuration;
      } else if (composerMode === 'event') {
        body.post_subtype = 'event';
        body.event_title = eventTitle.trim();
        body.event_date = eventDate.trim();
        if (eventLocation.trim()) body.event_location = eventLocation.trim();
      }

      await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(body) });

      resetComposer();
      setComposeOpen(false);
      load();
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : '');
    } finally {
      setPosting(false);
    }
  };

  const forYouHeader = (
    <View>
      <StoryBar />

      {/* Your Classes Today — mirrors web's feed widget, uses /api/timetable/today */}
      {(todayClasses.length > 0 || noTimetableProfile) ? (
        <View style={s.tcWrap}>
          <View style={s.tcHead}>
            <Text style={s.tcHeadTitle}>YOUR CLASSES TODAY 📚</Text>
            <TouchableOpacity onPress={() => router.push('/timetable')}>
              <Text style={s.tcLink}>View full timetable →</Text>
            </TouchableOpacity>
          </View>
          {noTimetableProfile ? (
            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Text style={s.tcNoProfile}>Set your department in Settings to see your timetable</Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              data={todayClasses}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={c => String(c.id)}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
              renderItem={({ item }) => {
                const ov = item.override;
                const isCancelled = item.status === 'cancelled' || ov?.kind === 'cancel';
                const isAdded = ov?.kind === 'add';
                const isEdited = ov?.kind === 'edit';
                const nv = isEdited ? ov?.new : null;
                return (
                  <View style={[s.tcCard, isCancelled ? s.tcCardCancel : (isAdded || isEdited) ? s.tcCardAmber : s.tcCardNormal]}>
                    <View style={s.tcCardTop}>
                      <Text style={[s.tcCourse, isCancelled ? s.tcStrike : null]} numberOfLines={2}>
                        {item.course_code ? `${item.course_code} ` : ''}{item.course_title}
                      </Text>
                      <View style={[s.tcBadge, isCancelled ? s.tcBadgeRed : isAdded ? s.tcBadgeAmber : s.tcBadgeGreen]}>
                        <Text style={[s.tcBadgeText, isCancelled ? s.tcBadgeTextRed : isAdded ? s.tcBadgeTextAmber : s.tcBadgeTextGreen]}>
                          {isCancelled ? 'Cancelled' : isAdded ? 'Extra class' : 'Holding'}
                        </Text>
                      </View>
                    </View>
                    {isEdited && nv ? (
                      <>
                        <Text style={s.tcTimeStrike}>{item.start_time} – {item.end_time}</Text>
                        <Text style={s.tcTimeAmber}>{nv.start_time} – {nv.end_time}</Text>
                      </>
                    ) : (
                      <Text style={[s.tcTime, isCancelled ? s.tcTimeRed : null]}>{item.start_time} – {item.end_time}</Text>
                    )}
                    {isEdited && nv?.venue ? (
                      <Text style={s.tcVenueAmber}>📍 {nv.venue}</Text>
                    ) : item.venue ? (
                      <Text style={[s.tcVenue, isCancelled ? s.tcTimeRed : null]}>📍 {item.venue}</Text>
                    ) : null}
                    {item.lecturer && !isEdited ? <Text style={s.tcVenue}>👤 {item.lecturer}</Text> : null}
                    {ov?.note ? <Text style={s.tcNote}>{ov.note}</Text> : null}
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : null}

      {/* Category filter — matches web's post categories */}
      <FlatList
        data={POST_CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={c => c.value}
        contentContainerStyle={s.catRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.catChip, category === item.value ? s.catChipOn : null]}
            onPress={() => setCategory(item.value)}
          >
            <Text style={category === item.value ? s.catTextOn : s.catText}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Who to follow */}
      {suggestions.length > 0 ? (
        <View style={s.wtfWrap}>
          <Text style={s.wtfTitle}>Who to follow</Text>
          <FlatList
            data={suggestions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={u => String(u.id)}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
            renderItem={({ item }) => (
              <View style={s.wtfCard}>
                <TouchableOpacity
                  style={{ alignItems: 'center' }}
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.id) } })}
                >
                  {item.profile_photo_url ? (
                    <Image source={{ uri: item.profile_photo_url }} style={s.wtfAvatar} />
                  ) : (
                    <View style={[s.wtfAvatar, s.fallback]}>
                      <Text style={s.letter}>{item.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={s.wtfName} numberOfLines={1}>{item.full_name}</Text>
                  {item.department ? <Text style={s.wtfDept} numberOfLines={1}>{item.department}</Text> : null}
                </TouchableOpacity>
                <TouchableOpacity style={s.wtfFollowBtn} onPress={() => followUser(item.id)}>
                  <Text style={s.wtfFollowText}>Follow</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      ) : null}

      {/* Birthdays today */}
      {birthdays.length > 0 ? (
        <View style={s.bdayWrap}>
          <Text style={s.bdayTitle}>🎂 Birthdays today</Text>
          <Text style={s.bdayNames}>
            {birthdays.slice(0, 3).map(b => b.full_name).join(', ')}
            {birthdays.length > 3 ? ` and ${birthdays.length - 3} more` : ''}
          </Text>
        </View>
      ) : null}

      {/* Trending hashtags — vertical list with proportional bars, matching web */}
      {trending.length > 0 ? (
        <View style={s.trendWrap}>
          <Text style={s.trendHeading}>Trending on campus</Text>
          <View style={s.trendList}>
            {trending.map((t, idx) => {
              const maxCount = trending[0]?.post_count || 1;
              const pct = Math.max(8, (t.post_count / maxCount) * 100);
              return (
                <TouchableOpacity
                  key={t.tag}
                  style={s.trendRow}
                  onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: t.tag } })}
                >
                  <Text style={s.trendRank}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={s.trendTagRow}>
                      <Text style={s.trendTag} numberOfLines={1}>#{t.tag}</Text>
                      <Text style={s.trendCount}>{t.post_count}</Text>
                    </View>
                    <View style={s.trendBarTrack}>
                      <View style={[s.trendBarFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </TouchableOpacity>
        <Image
          source={scheme === 'dark'
            ? require('../../assets/logo-lockup-dark.png')
            : require('../../assets/logo-lockup-light.png')}
          style={s.logoLockup}
          resizeMode="contain"
        />
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => router.push('/search')} hitSlop={8}>
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
          {highlights.length > 0 ? (
            <TouchableOpacity onPress={() => setShowHighlights(true)} hitSlop={8} style={s.bellWrap}>
              <Ionicons name="star" size={22} color={colors.brand} />
              <View style={s.bellBadge}><Text style={s.bellBadgeText}>{highlights.length > 9 ? '9+' : highlights.length}</Text></View>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')} hitSlop={8} style={s.bellWrap}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {notifUnread > 0 ? (
              <View style={s.bellBadge}><Text style={s.bellBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text></View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />

      {/* For You / Following / Messages — matches web */}
      <View style={s.tabBar}>
        <TouchableOpacity style={s.feedTab} onPress={() => setFeedTab('for_you')}>
          <Text style={feedTab === 'for_you' ? s.feedTabOn : s.feedTabOff}>For You</Text>
          {feedTab === 'for_you' ? <View style={s.tabUnderline} /> : null}
        </TouchableOpacity>
        <TouchableOpacity style={s.feedTab} onPress={() => setFeedTab('following')}>
          <Text style={feedTab === 'following' ? s.feedTabOn : s.feedTabOff}>Following</Text>
          {feedTab === 'following' ? <View style={s.tabUnderline} /> : null}
        </TouchableOpacity>
        <TouchableOpacity style={s.feedTab} onPress={() => setFeedTab('messages')}>
          <View style={s.feedTabRow}>
            <Text style={feedTab === 'messages' ? s.feedTabOn : s.feedTabOff}>Messages</Text>
            {unreadCount > 0 ? (
              <View style={s.tabBadge}><Text style={s.tabBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
            ) : null}
          </View>
          {feedTab === 'messages' ? <View style={s.tabUnderline} /> : null}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : feedTab === 'messages' ? (
        <FlatList
          data={filteredMessageItems}
          keyExtractor={i => `${i.kind}-${i.id}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={s.convoSearchWrap}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                style={s.convoSearchInput}
                placeholder="Search conversations"
                placeholderTextColor={colors.muted}
                value={convoSearch}
                onChangeText={setConvoSearch}
              />
              {convoSearch ? (
                <TouchableOpacity onPress={() => setConvoSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={conversationsLoading}
              onRefresh={loadConversations} tintColor={colors.brand} />
          }
          ListEmptyComponent={
            conversationsLoading ? null : (
              <View style={s.center}>
                <Text style={s.muted}>{convoSearch ? 'No matches' : 'No conversations yet'}</Text>
                {!convoSearch ? <Text style={s.mutedSmall}>Start a chat from someone&apos;s profile</Text> : null}
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.convoRow}
              onPress={() => item.kind === 'group'
                ? router.push({ pathname: '/group/[id]', params: { id: String(item.id), name: item.name } })
                : router.push({ pathname: '/chat/[id]', params: { id: String(item.id), name: item.name } })}
            >
              {item.kind === 'dm' && item.photo ? (
                <Image source={{ uri: item.photo }} style={s.convoAvatar} />
              ) : (
                <View style={[s.convoAvatar, s.fallback]}>
                  {item.kind === 'group'
                    ? <Ionicons name="people" size={20} color={colors.muted} />
                    : <Text style={s.letter}>{item.name?.charAt(0).toUpperCase()}</Text>}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={s.convoTop}>
                  <Text style={s.convoName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.mutedSmall}>{item.last_message_at ? timeAgo(item.last_message_at) : ''}</Text>
                </View>
                <Text style={s.convoPreview} numberOfLines={1}>
                  {item.kind === 'group' && !item.last_message ? `${item.member_count} members` : friendlyPreview(item.last_message)}
                </Text>
              </View>
              {item.kind === 'dm' && item.unread_count > 0 ? (
                <View style={s.convoBadge}><Text style={s.convoBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text></View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      ) : error ? (
        <View style={s.center}>
          <Text style={s.error}>{error}</Text>
          <Text style={s.muted}>Pull down to retry</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feedTab === 'following' ? followingPosts : (category === 'ALL' ? posts : posts.filter(p => p.category === category))}
          keyExtractor={p => String(p.id)}
          ListHeaderComponent={feedTab === 'for_you' ? forYouHeader : null}
          refreshControl={
            <RefreshControl
              refreshing={feedTab === 'following' ? followingLoading : refreshing}
              onRefresh={() => {
                if (feedTab === 'following') { loadFollowing(); }
                else { setRefreshing(true); load(); }
              }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            feedTab === 'following' ? (
              followingLoading ? null : (
                <View style={s.center}>
                  <Text style={s.muted}>No posts from people you follow yet</Text>
                  <Text style={s.mutedSmall}>Follow classmates to see their posts here</Text>
                </View>
              )
            ) : <View style={s.center}><Text style={s.muted}>No posts yet</Text></View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={user?.id}
              onOpenProfile={openProfile}
              onToggleLike={toggleLike}
              onOpenComments={openComments}
              onRepost={repost}
              onShare={setSharePost}
              onMenu={openPostMenu}
              onVote={voteOnPoll}
              onRSVP={toggleRSVP}
            />
          )}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          removeClippedSubviews
        />
      )}

      {/* Today's Highlights popup */}
      <Modal visible={showHighlights} animationType="fade" transparent onRequestClose={() => setShowHighlights(false)}>
        <TouchableOpacity style={s.hlOverlay} activeOpacity={1} onPress={() => setShowHighlights(false)}>
          <View style={s.hlSheet}>
            <View style={s.hlHeader}>
              <Text style={s.hlTitle}>Today&apos;s Highlights</Text>
              <TouchableOpacity onPress={() => setShowHighlights(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              {highlights.map(h => {
                const countdown = highlightCountdown(h.start_date);
                return (
                  <View key={h.id} style={[s.hlCard, { backgroundColor: HL_TINT[h.color] || HL_TINT.blue }]}>
                    <View style={s.hlCardTop}>
                      <Text style={s.hlIcon}>{h.icon || '📌'}</Text>
                      {countdown ? <Text style={s.hlCountdown}>{countdown}</Text> : null}
                    </View>
                    <Text style={s.hlCardTitle}>{h.title}</Text>
                    {h.description ? <Text style={s.hlDesc}>{h.description}</Text> : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Floating compose button — only on the post feeds, not Messages */}
      {feedTab !== 'messages' ? (
        <TouchableOpacity style={s.fab} onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {/* Compose */}
      <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => { resetComposer(); setComposeOpen(false); }} hitSlop={12} style={s.modalClose}>
                <Text style={s.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>New post</Text>
              <TouchableOpacity onPress={submitPost} disabled={posting}>
                {posting ? <ActivityIndicator color={colors.brand} />
                  : <Text style={s.post}>Post</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Post type selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modeRow}>
                {([
                  { id: 'post', label: 'Post', icon: 'create-outline' },
                  { id: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline' },
                  { id: 'question', label: 'Question', icon: 'help-circle-outline' },
                  { id: 'poll', label: 'Poll', icon: 'stats-chart-outline' },
                  { id: 'event', label: 'Event', icon: 'calendar-outline' },
                ] as const).map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.modeChip, composerMode === m.id ? s.modeChipOn : null]}
                    onPress={() => setComposerMode(m.id)}
                  >
                    <Ionicons name={m.icon} size={16} color={composerMode === m.id ? '#fff' : colors.textSecondary} />
                    <Text style={composerMode === m.id ? s.modeTextOn : s.modeText}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Title for discussion / question */}
              {(composerMode === 'discussion' || composerMode === 'question') ? (
                <TextInput
                  style={s.titleInput}
                  placeholder={composerMode === 'question' ? 'Your question' : 'Discussion title'}
                  placeholderTextColor={colors.muted}
                  value={discussionTitle}
                  onChangeText={setDiscussionTitle}
                />
              ) : null}

              {/* Event fields */}
              {composerMode === 'event' ? (
                <>
                  <TextInput style={s.titleInput} placeholder="Event title" placeholderTextColor={colors.muted} value={eventTitle} onChangeText={setEventTitle} maxLength={200} />
                  <TextInput style={s.fieldInput} placeholder="Date (e.g. 2026-03-15 3:00 PM)" placeholderTextColor={colors.muted} value={eventDate} onChangeText={setEventDate} />
                  <TextInput style={s.fieldInput} placeholder="Location (optional)" placeholderTextColor={colors.muted} value={eventLocation} onChangeText={setEventLocation} />
                </>
              ) : null}

              <TextInput
                style={s.composeInput}
                placeholder={
                  composerMode === 'question' ? 'Add details (optional)'
                  : composerMode === 'poll' ? 'Ask something...'
                  : composerMode === 'event' ? 'Describe the event (optional)'
                  : "What's happening on campus?"
                }
                placeholderTextColor={colors.muted}
                value={newPost}
                onChangeText={setNewPost}
                multiline
              />

              {/* Poll options */}
              {composerMode === 'poll' ? (
                <View style={s.pollBox}>
                  {pollOptions.map((opt, i) => (
                    <View key={i} style={s.pollOptRow}>
                      <TextInput
                        style={s.pollInput}
                        placeholder={`Option ${i + 1}`}
                        placeholderTextColor={colors.muted}
                        value={opt}
                        onChangeText={(v) => setPollOptions(prev => prev.map((o, idx) => idx === i ? v : o))}
                      />
                      {pollOptions.length > 2 ? (
                        <TouchableOpacity onPress={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color={colors.muted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  {pollOptions.length < 4 ? (
                    <TouchableOpacity onPress={() => setPollOptions(prev => [...prev, ''])} style={s.addOpt}>
                      <Ionicons name="add" size={18} color={colors.brand} />
                      <Text style={s.addOptText}>Add option</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={s.durationRow}>
                    <Text style={s.durationLabel}>Duration:</Text>
                    {[24, 48, 72, 168].map(h => (
                      <TouchableOpacity key={h} style={[s.durChip, pollDuration === h ? s.durChipOn : null]} onPress={() => setPollDuration(h)}>
                        <Text style={pollDuration === h ? s.durTextOn : s.durText}>
                          {h === 24 ? '1 day' : h === 48 ? '2 days' : h === 72 ? '3 days' : '1 week'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Category chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catComposeRow}>
                {POST_CATEGORIES.filter(c => c.value !== 'ALL').map(c => (
                  <TouchableOpacity
                    key={c.value}
                    style={[s.catChip, composerCategory === c.value ? s.catChipOn : null]}
                    onPress={() => setComposerCategory(c.value)}
                  >
                    <Text style={composerCategory === c.value ? s.catTextOn : s.catText}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {newImage ? (
                <View style={s.previewWrap}>
                  <Image source={{ uri: newImage }} style={s.preview} resizeMode="contain" />
                  <TouchableOpacity style={s.removeImg} onPress={() => setNewImage(null)}>
                    <Text style={s.removeImgText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={s.composeTools}>
                <TouchableOpacity style={s.tool} onPress={pickImage}>
                  <Ionicons name="image-outline" size={20} color={colors.brand} />
                  <Text style={s.toolText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.tool} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={20} color={colors.brand} />
                  <Text style={s.toolText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Comments */}
      <Modal visible={!!commentsFor} animationType="slide" onRequestClose={() => setCommentsFor(null)}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setCommentsFor(null)} hitSlop={12} style={s.modalClose}>
                <Text style={s.modalCloseText}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => {
                  const pid = commentsFor?.id;
                  setCommentsFor(null);
                  if (pid) router.push({ pathname: '/post/[id]', params: { id: String(pid) } });
                }}
                hitSlop={8}
                style={{ width: 50, alignItems: 'flex-end' }}
              >
                <Ionicons name="open-outline" size={20} color={colors.brand} />
              </TouchableOpacity>
            </View>

            {commentsLoading ? (
              <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={c => String(c.id)}
                ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No comments yet</Text></View>}
                renderItem={({ item }) => (
                  <View style={s.commentRow}>
                    <Text style={s.author}>{item.author_name}</Text>
                    <Text style={s.content}>{item.content}</Text>
                    <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
                  </View>
                )}
              />
            )}

            <View style={s.commentBar}>
              <TextInput
                style={s.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.muted}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={sendComment} disabled={!commentText.trim()}>
                <Text style={[s.post, !commentText.trim() ? { opacity: 0.4 } : null]}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // Your Classes Today widget
  tcWrap: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  tcHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  tcHeadTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6 },
  tcLink: { fontSize: 11, fontWeight: '700', color: colors.brand },
  tcNoProfile: { fontSize: 12, color: colors.brand, paddingHorizontal: 16, textDecorationLine: 'underline' },
  tcCard: { width: 210, borderRadius: 16, padding: 14, gap: 6 },
  tcCardCancel: { backgroundColor: '#fef2f2' },
  tcCardAmber: { backgroundColor: '#fffbeb' },
  tcCardNormal: { backgroundColor: '#eef2ff' },
  tcCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  tcCourse: { flex: 1, fontSize: 13, fontWeight: '800', color: '#3730a3', lineHeight: 17 },
  tcStrike: { color: '#991b1b', textDecorationLine: 'line-through' },
  tcBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tcBadgeRed: { backgroundColor: '#fee2e2' },
  tcBadgeAmber: { backgroundColor: '#fef3c7' },
  tcBadgeGreen: { backgroundColor: '#dcfce7' },
  tcBadgeText: { fontSize: 10, fontWeight: '800' },
  tcBadgeTextRed: { color: '#b91c1c' },
  tcBadgeTextAmber: { color: '#b45309' },
  tcBadgeTextGreen: { color: '#15803d' },
  tcTime: { fontSize: 11, fontWeight: '700', color: '#4f46e5' },
  tcTimeRed: { color: '#dc2626' },
  tcTimeStrike: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textDecorationLine: 'line-through' },
  tcTimeAmber: { fontSize: 11, fontWeight: '700', color: '#b45309' },
  tcVenue: { fontSize: 11, color: '#6366f1' },
  tcVenueAmber: { fontSize: 11, color: '#b45309' },
  tcNote: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 26, height: 26, borderRadius: 6 },
  logoLockup: { width: 120, height: 30 },
  logo: { fontSize: 20, fontWeight: '800', color: colors.brand },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  feedTab: { flex: 1, alignItems: 'center', paddingVertical: 13 },
  feedTabRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedTabOn: { fontSize: 14, fontWeight: '800', color: colors.text },
  feedTabOff: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabUnderline: {
    position: 'absolute', bottom: 0, height: 2.5, width: 40,
    borderRadius: 2, backgroundColor: colors.brand,
  },
  tabBadge: {
    backgroundColor: colors.brand, borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  mutedSmall: { color: colors.muted, fontSize: 13, marginTop: 4 },
  convoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  convoSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginVertical: 10, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  convoSearchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  convoAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand100 },
  convoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convoName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  convoPreview: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  convoBadge: {
    backgroundColor: colors.brand, borderRadius: 11, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  convoBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap: { position: 'relative' },
  bell: { fontSize: 20 },
  bellBadge: {
    position: 'absolute', top: -5, right: -6, backgroundColor: colors.danger,
    borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  catRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  catChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  catText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  catTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  wtfWrap: { paddingTop: 6, paddingBottom: 12, borderBottomWidth: 8, borderBottomColor: colors.bg },
  wtfTitle: { fontSize: 15, fontWeight: '800', color: colors.text, paddingHorizontal: 16, marginBottom: 10 },
  wtfCard: {
    width: 130, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center',
  },
  wtfAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand100, marginBottom: 8 },
  wtfName: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  wtfDept: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 2 },
  wtfFollowBtn: {
    marginTop: 10, backgroundColor: colors.brand, borderRadius: radius.full,
    paddingVertical: 7, alignItems: 'center', width: '100%',
  },
  wtfFollowText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bdayWrap: {
    marginHorizontal: 12, marginTop: 10, padding: 14,
    backgroundColor: colors.brand50, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.brand100,
  },
  bdayTitle: { fontSize: 14, fontWeight: '800', color: colors.brand },
  bdayNames: { fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  trendWrap: { paddingTop: 12, paddingBottom: 12, borderBottomWidth: 8, borderBottomColor: colors.bg },
  trendHeading: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 16, marginBottom: 8 },
  trendList: { paddingHorizontal: 12 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  trendRank: { fontSize: 14, fontWeight: '800', color: colors.muted, width: 18, textAlign: 'center' },
  trendTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trendTag: { fontSize: 14, fontWeight: '700', color: colors.brand, flex: 1 },
  trendCount: { fontSize: 12, color: colors.muted, marginLeft: 8 },
  trendBarTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceSubtle, marginTop: 5, overflow: 'hidden' },
  trendBarFill: { height: '100%', borderRadius: 2, backgroundColor: colors.brand },
  modalClose: { paddingVertical: 4, paddingHorizontal: 4 },
  modalCloseText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  menuBtn: { fontSize: 24, color: colors.text },
  fab: {
    position: 'absolute', right: 18, bottom: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 6,
  },
  hlOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  hlSheet: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, maxHeight: '75%' },
  hlHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  hlTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  hlCard: { borderRadius: 16, padding: 16, gap: 6 },
  hlCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hlIcon: { fontSize: 26 },
  hlCountdown: { fontSize: 12, fontWeight: '800', color: '#374151', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  hlCardTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  hlDesc: { fontSize: 14, color: '#374151', lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center', marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 12 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  author: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  repostBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginLeft: 4 },
  repostBannerText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  postCatChip: { marginLeft: 6, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  postCatChipText: { fontSize: 10, fontWeight: '700' },
  creatorBadge: {
    marginLeft: 4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(217,119,6,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  creatorBadgeText: { fontSize: 10, color: '#d97706', fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  content: { fontSize: 15, color: colors.text, lineHeight: 22 },
  showMore: { fontSize: 14, fontWeight: '600', color: colors.brand, marginTop: 2 },
  pollWrap: { marginTop: 10, gap: 8 },
  pollOpt: {
    position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, backgroundColor: colors.surfaceSubtle, minHeight: 44, justifyContent: 'center',
  },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.brand100 },
  pollBarMine: { backgroundColor: colors.brand100 },
  pollOptContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  pollOptText: { fontSize: 14, color: colors.text, flex: 1, fontWeight: '500' },
  pollOptTextMine: { fontWeight: '800', color: colors.brand },
  pollPct: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginLeft: 8 },
  pollMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  eventWrap: {
    marginTop: 10, borderWidth: 1, borderColor: colors.brand100, borderRadius: 12,
    backgroundColor: colors.brand50, padding: 14, gap: 6,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTitle: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 },
  eventDetail: { fontSize: 14, color: colors.textSecondary },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rsvpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.brand, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18,
  },
  rsvpBtnOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  rsvpText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  rsvpTextOn: { color: '#fff', fontWeight: '700', fontSize: 14 },
  image: { width: '100%', height: 300, borderRadius: 12, marginTop: 10, backgroundColor: colors.surfaceSubtle },
  actions: { flexDirection: 'row', gap: 24, marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontSize: 14, color: colors.textSecondary },
  menuDots: { padding: 4, marginLeft: 8 },
  liked: { color: colors.danger, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  post: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  modeRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  modeChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  modeText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  modeTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  titleInput: {
    fontSize: 17, fontWeight: '700', color: colors.text,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
  },
  fieldInput: {
    fontSize: 15, color: colors.text, backgroundColor: colors.surfaceSubtle,
    marginHorizontal: 16, marginTop: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
  },
  pollBox: { paddingHorizontal: 16, paddingTop: 8 },
  pollOptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pollInput: {
    flex: 1, fontSize: 15, color: colors.text, backgroundColor: colors.surfaceSubtle,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  addOpt: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  addOptText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  durationLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  durChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  durChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  durText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  durTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  catComposeRow: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  composeInput: { flex: 1, padding: 16, fontSize: 16, color: colors.text, textAlignVertical: 'top' },
  previewWrap: { marginHorizontal: 16, marginBottom: 12 },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#f3f4f6' },
  removeImg: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  removeImgText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  composeTools: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  toolText: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text },
});
