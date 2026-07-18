import { useEffect, useState, useCallback, memo } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Image,
  TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
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
import { useAuth } from '../../src/context/AuthContext';
import { friendlyPreview } from '../../src/lib/messagePreview';

interface Post {
  id: number;
  user_id: number;
  content: string;
  category?: string;
  image_url: string | null;
  author_name: string;
  author_department: string | null;
  author_photo: string | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_reposted?: boolean;
  reposts_count?: number;
  created_at: string;
  post_subtype?: string | null;
  discussion_title?: string | null;
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
  onMenu: (post: Post) => void;
}

const PostCard = memo(function PostCard({ post, currentUserId, onOpenProfile, onToggleLike, onOpenComments, onRepost, onMenu }: PostCardProps) {
  const s = useThemedStyles(make_s);
  const { palette } = useTheme();
  return (
    <View style={s.card}>
      <View style={s.row}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          activeOpacity={0.7}
          onPress={() => onOpenProfile(post.user_id)}
        >
          {post.author_photo ? (
            <Image source={{ uri: post.author_photo }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.fallback]}>
              <Text style={s.letter}>{post.author_name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.author}>{post.author_name}</Text>
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

      {post.content ? <Text style={s.content}>{post.content}</Text> : null}
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
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [category, setCategory] = useState('ALL');
  const [suggestions, setSuggestions] = useState<{ id: number; full_name: string; department: string | null; level: string | null; profile_photo_url: string | null }[]>([]);
  const [trending, setTrending] = useState<{ tag: string; post_count: number }[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: number; full_name: string; profile_photo_url: string | null }[]>([]);

  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
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
      const data = await apiFetch<{ conversations: typeof conversations }>('/api/messages/conversations');
      setConversations(data.conversations || []);
    } catch {
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => { if (feedTab === 'messages') loadConversations(); }, [feedTab, loadConversations]);

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
    apiFetch<{ users: typeof birthdays }>('/api/users/birthdays/today')
      .then(d => setBirthdays(d.users || [])).catch(() => {});
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
    const reasons: { label: string; value: string }[] = [
      { label: 'Spam', value: 'spam' },
      { label: 'Harassment', value: 'harassment' },
      { label: 'Hate speech', value: 'hate_speech' },
      { label: 'Misinformation', value: 'misinformation' },
      { label: 'Inappropriate content', value: 'inappropriate_content' },
    ];
    Alert.alert('Report post', 'Why are you reporting this?',
      [
        ...reasons.map(r => ({
          text: r.label,
          onPress: async () => {
            try {
              await apiFetch(`/api/moderation/report/post/${post.id}`, {
                method: 'POST',
                body: JSON.stringify({ reason: r.value }),
              });
              Alert.alert('Thanks', 'Your report has been submitted.');
            } catch (err) {
              const m = err instanceof Error ? err.message : '';
              Alert.alert(m.includes('already') ? 'Already reported' : 'Could not report', m);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
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
        { text: 'Report post', style: 'destructive', onPress: () => reportPost(post) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [user, deletePost, reportPost]);


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

  const submitPost = async () => {
    // An image on its own is a perfectly good post — don't require text.
    if (!newPost.trim() && !newImage) return;
    setPosting(true);
    try {
      // If there's a photo, upload it to Cloudinary FIRST and post only the URL.
      // Sending the file through the backend hangs on Railway's timeout — this is
      // exactly what web does, and why text posts worked but image posts didn't.
      let imageUrl: string | null = null;
      if (newImage) imageUrl = await uploadImage(newImage, 'abukonn/posts');

      await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: newPost.trim(),
          category: 'GENERAL',
          ...(imageUrl ? { image_url: imageUrl } : {}),
        }),
      });

      setNewPost('');
      setNewImage(null);
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

      {/* Trending hashtags */}
      {trending.length > 0 ? (
        <View style={s.trendWrap}>
          <Text style={s.wtfTitle}>Trending</Text>
          <View style={s.trendChips}>
            {trending.map(t => (
              <View key={t.tag} style={s.trendChip}>
                <Text style={s.trendTag}>#{t.tag}</Text>
                <Text style={s.trendCount}>{t.post_count} {t.post_count === 1 ? 'post' : 'posts'}</Text>
              </View>
            ))}
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
          <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')} hitSlop={8} style={s.bellWrap}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {notifUnread > 0 ? (
              <View style={s.bellBadge}><Text style={s.bellBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text></View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={s.newBtn} onPress={() => setComposeOpen(true)}>
            <Text style={s.newBtnText}>+ Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />

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
          data={conversations}
          keyExtractor={c => String(c.id)}
          refreshControl={
            <RefreshControl refreshing={conversationsLoading}
              onRefresh={loadConversations} tintColor={colors.brand} />
          }
          ListEmptyComponent={
            conversationsLoading ? null : (
              <View style={s.center}>
                <Text style={s.muted}>No conversations yet</Text>
                <Text style={s.mutedSmall}>Start a chat from someone&apos;s profile</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.convoRow}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: String(item.id), name: item.other_user_name } })}
            >
              {item.other_user_photo ? (
                <Image source={{ uri: item.other_user_photo }} style={s.convoAvatar} />
              ) : (
                <View style={[s.convoAvatar, s.fallback]}>
                  <Text style={s.letter}>{item.other_user_name?.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={s.convoTop}>
                  <Text style={s.convoName} numberOfLines={1}>{item.other_user_name}</Text>
                  <Text style={s.mutedSmall}>{item.last_message_at ? timeAgo(item.last_message_at) : ''}</Text>
                </View>
                <Text style={s.convoPreview} numberOfLines={1}>{friendlyPreview(item.last_message)}</Text>
              </View>
              {item.unread_count > 0 ? (
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
              onMenu={openPostMenu}
            />
          )}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          removeClippedSubviews
        />
      )}

      {/* Compose */}
      <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setComposeOpen(false)} hitSlop={12} style={s.modalClose}>
                <Text style={s.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>New post</Text>
              <TouchableOpacity
                onPress={submitPost}
                disabled={posting || (!newPost.trim() && !newImage)}
              >
                {posting ? <ActivityIndicator color={colors.brand} />
                  : (
                    <Text style={[s.post, (!newPost.trim() && !newImage) ? { opacity: 0.4 } : null]}>
                      Post
                    </Text>
                  )}
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.composeInput}
              placeholder="What's happening on campus?"
              placeholderTextColor={colors.muted}
              value={newPost}
              onChangeText={setNewPost}
              multiline
              autoFocus
            />

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
                <Text style={s.toolText}>🖼  Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.tool} onPress={takePhoto}>
                <Text style={s.toolText}>📷  Camera</Text>
              </TouchableOpacity>
            </View>
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
              <View style={{ width: 50 }} />
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
  trendChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  trendChip: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12,
  },
  trendTag: { fontSize: 14, fontWeight: '700', color: colors.brand },
  trendCount: { fontSize: 11, color: colors.muted, marginTop: 1 },
  modalClose: { paddingVertical: 4, paddingHorizontal: 4 },
  modalCloseText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  menuBtn: { fontSize: 24, color: colors.text },
  newBtn: { backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
  author: { fontSize: 14, fontWeight: '700', color: colors.text },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  content: { fontSize: 15, color: colors.text, lineHeight: 22 },
  image: { width: '100%', height: 300, borderRadius: 12, marginTop: 10, backgroundColor: colors.surfaceSubtle },
  actions: { flexDirection: 'row', gap: 24, marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontSize: 14, color: colors.textSecondary },
  menuDots: { padding: 4, marginLeft: 8 },
  liked: { color: colors.danger, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  post: { color: colors.brand, fontWeight: '700', fontSize: 15 },
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
  tool: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  toolText: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text },
});
