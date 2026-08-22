import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert, FlatList,
  ActivityIndicator, RefreshControl, ScrollView, Share, Linking,
} from 'react-native';
import { MediaCarousel } from '../../src/components/MediaCarousel';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { RoleBadge } from '../../src/components/RoleBadge';
import { ProUpsellBanner } from '../../src/components/ProUpsellBanner';
import { apiFetch } from '../../src/lib/api';
import { optimizedAvatar, optimizedImage } from '../../src/lib/image';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import { useTabScrollToTop } from '../../src/lib/useScrollToTop';
import { colors, radius, shadow } from '../../src/theme';

interface ProfilePost {
  id: number;
  content: string;
  image_url: string | null;
  media?: Array<{ id: number; media_url: string; media_type: 'image' | 'video'; thumbnail_url: string | null; duration_seconds: number | null; position: number }>;
  likes_count: number;
  comments_count: number;
  created_at: string;
  discussion_title?: string | null;
}
interface ProfileReply {
  id: number;
  content: string;
  post_id: number;
  created_at: string;
}
interface MyStatusStory {
  id: number;
  media_url: string | null;
  story_type: 'image' | 'video' | 'text';
  text_content: string | null;
  bg_color: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function Profile() {
  const s = useThemedStyles(make_s);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { ref: listRef, setRefresh } = useTabScrollToTop<ProfilePost | ProfileReply>();

  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [replies, setReplies] = useState<ProfileReply[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myStories, setMyStories] = useState<MyStatusStory[]>([]);
  const [deletingStoryId, setDeletingStoryId] = useState<number | null>(null);
  const [classRepFor, setClassRepFor] = useState<Array<{ id: number; department: string; level: string }>>([]);
  // Profile views (Pro perk): count on the stats row, same "list length IS
  // the count" approach as web (no separate count endpoint).
  const [viewersCount, setViewersCount] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // /api/users/me never includes followers_count/following_count -- that
      // endpoint's user object comes from User.toPrivateUser, which doesn't
      // add them (unlike /api/users/:id, which merges in a live
      // Follow.getStats() count). Web already knows this and makes a second
      // call to /api/follows/:id/stats for its own-profile counts; mobile
      // was reading a field that never existed on this response, so it
      // silently fell back to 0 every time. Match web: fetch real counts
      // from the same stats endpoint web uses.
      const [data, storiesData, viewersData, statsData] = await Promise.all([
        apiFetch<{
          user: { followers_count: number; following_count: number };
          posts: ProfilePost[];
          replies: ProfileReply[];
          class_rep_for?: Array<{ id: number; department: string; level: string }>;
        }>('/api/users/me'),
        apiFetch<{ stories: MyStatusStory[] }>('/api/stories/mine').catch(() => ({ stories: [] })),
        apiFetch<{ viewers: unknown[] }>('/api/users/me/profile-viewers').catch(() => ({ viewers: [] })),
        apiFetch<{ followers_count: number; following_count: number }>(`/api/follows/${user?.id}/stats`)
          .catch(() => ({ followers_count: 0, following_count: 0 })),
      ]);
      setPosts(data.posts || []);
      setReplies(data.replies || []);
      setClassRepFor(data.class_rep_for || []);
      setFollowers(statsData.followers_count || 0);
      setFollowing(statsData.following_count || 0);
      setViewersCount(viewersData.viewers?.length || 0);
      setMyStories(storiesData.stories || []);
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const deleteStory = async (storyId: number) => {
    setDeletingStoryId(storyId);
    try {
      await apiFetch(`/api/stories/${storyId}`, { method: 'DELETE' });
      setMyStories(prev => prev.filter(st => st.id !== storyId));
    } catch {
      Alert.alert('Could not delete', 'Please try again.');
    } finally {
      setDeletingStoryId(null);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setRefresh(load); }, [load, setRefresh]);

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  const header = (
    <View>
      <View style={s.top}>
        {user?.profile_photo_url ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUrl(user.profile_photo_url)}>
            <Image source={{ uri: optimizedAvatar(user.profile_photo_url, 96) }} style={s.avatar} />
          </TouchableOpacity>
        ) : (
          <View style={[s.avatar, s.fallback]}>
            <Text style={s.letter}>{user?.full_name?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.name}>{user?.full_name}</Text>
        <View style={s.badgeRow}>
          <RoleBadge role={user?.role || (user?.is_admin ? 'admin' : user?.is_verified ? 'verified' : 'user')} />
          {user?.is_content_creator ? (
            <View style={s.creatorBadge}><Text style={s.creatorBadgeText}>✎ Creator</Text></View>
          ) : null}
          {classRepFor.length > 0 ? (
            <View style={s.classRepBadge}><Text style={s.classRepBadgeText}>🎓 Class Rep</Text></View>
          ) : null}
        </View>
        {classRepFor.length > 0 ? (
          <Text style={s.muted}>Rep for {classRepFor.map(c => `${c.department} (${c.level})`).join(', ')}</Text>
        ) : null}
        {user?.department ? (
          <Text style={s.muted}>{user.department}{user.level ? ` · ${user.level}` : ''}</Text>
        ) : null}
        {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNum}>{posts.length}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </View>
          <TouchableOpacity
            style={s.stat}
            onPress={() => user && router.push({ pathname: '/follows/[id]', params: { id: String(user.id), type: 'followers', name: user.full_name } })}
          >
            <Text style={s.statNum}>{followers}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.stat}
            onPress={() => user && router.push({ pathname: '/follows/[id]', params: { id: String(user.id), type: 'following', name: user.full_name } })}
          >
            <Text style={s.statNum}>{following}</Text>
            <Text style={s.statLabel}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.stat}
            onPress={() => user && router.push({ pathname: '/follows/[id]', params: { id: String(user.id), type: 'viewers', name: user.full_name } })}
          >
            <Text style={s.statNum}>{viewersCount}</Text>
            <Text style={s.statLabel}>Profile views</Text>
          </TouchableOpacity>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="create-outline" size={16} color={colors.brand} />
            <Text style={s.editText}>Edit profile</Text>
          </TouchableOpacity>
          {user?.username ? (
            <TouchableOpacity style={s.iconBtn} onPress={() => {
              Share.share({
                message: `Check out my profile on ABUkonn: https://abukonn.com/u/${user.username}`,
              }).catch(() => { /* dismissed */ });
            }}>
              <Ionicons name="share-social-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/analytics')}>
            <Ionicons name="bar-chart-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ProUpsellBanner style={{ marginHorizontal: 16, marginBottom: 4 }} />

      {/* My Status — mirrors web's profile page section: a compact story
          strip (Add + thumbnails with inline delete) plus a link to the
          full My Stories screen. Reuses the same /api/stories/mine data
          my-stories.tsx already established. */}
      <View style={s.statusSection}>
        <View style={s.statusHeaderRow}>
          <Text style={s.statusTitle}>My Status</Text>
          <TouchableOpacity onPress={() => router.push('/my-stories')} hitSlop={6}>
            <Text style={s.statusManageLink}>Manage all →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusRow}>
          <TouchableOpacity style={s.statusItem} onPress={() => router.push('/(tabs)/feed')}>
            <View style={s.statusAddCircle}>
              <Ionicons name="add" size={22} color={colors.brand} />
            </View>
            <Text style={s.statusItemLabel}>Add</Text>
          </TouchableOpacity>
          {myStories.map(story => (
            <View key={story.id} style={s.statusItem}>
              <TouchableOpacity style={s.statusThumbWrap} onPress={() => router.push('/my-stories')}>
                {story.story_type === 'text' ? (
                  <View style={[s.statusThumb, { backgroundColor: story.bg_color || colors.brand, alignItems: 'center', justifyContent: 'center', padding: 4 }]}>
                    <Text style={s.statusThumbText} numberOfLines={3}>{story.text_content}</Text>
                  </View>
                ) : story.story_type === 'video' ? (
                  <View style={[s.statusThumb, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="play" size={16} color="#fff" />
                  </View>
                ) : (
                  <Image source={{ uri: optimizedImage(story.media_url, 120) }} style={s.statusThumb} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.statusDeleteBtn}
                disabled={deletingStoryId === story.id}
                onPress={() => deleteStory(story.id)}
              >
                {deletingStoryId === story.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="close" size={11} color="#fff" />}
              </TouchableOpacity>
              <Text style={s.statusItemLabel}>{timeAgo(story.created_at)}</Text>
            </View>
          ))}
        </ScrollView>
        <Text style={s.statusFootnote}>Stories disappear after 24 hours</Text>
      </View>

      <View style={s.tabBar}>
        {(['posts', 'replies'] as const).map(t => (
          <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)}>
            <Text style={tab === t ? s.tabOn : s.tabOff}>
              {t === 'posts' ? 'Posts' : 'Replies'}
            </Text>
            {tab === t ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const data = tab === 'posts' ? posts : replies;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerBar}>
        <Text style={s.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={onLogout} hitSlop={10}>
          <Text style={s.logoutLink}>Log out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={data as (ProfilePost | ProfileReply)[]}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>{tab === 'posts' ? 'No posts yet' : 'No replies yet'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            tab === 'posts' ? (
              <TouchableOpacity
                style={s.post}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(item.id) } })}
              >
                {(item as ProfilePost).discussion_title ? (
                  <Text style={s.postTitle}>{(item as ProfilePost).discussion_title}</Text>
                ) : null}
                {item.content ? <Text style={s.postContent}>{item.content}</Text> : null}
                {(item as ProfilePost).media && (item as ProfilePost).media!.length > 0 ? (
                  <MediaCarousel items={(item as ProfilePost).media} onOpenImage={(url) => Linking.openURL(url)} />
                ) : (item as ProfilePost).image_url ? (
                  <Image source={{ uri: (item as ProfilePost).image_url! }} style={s.postImage} resizeMode="contain" />
                ) : null}
                <View style={s.postMeta}>
                  <Text style={s.muted}>{'\u2665'} {(item as ProfilePost).likes_count}   {'\uD83D\uDCAC'} {(item as ProfilePost).comments_count}</Text>
                  <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.post}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: String((item as ProfileReply).post_id) } })}
              >
                <Text style={s.replyLabel}>Replied</Text>
                <Text style={s.postContent}>{item.content}</Text>
                <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
              </TouchableOpacity>
            )
          )}
        />
      )}
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  logoutLink: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  center: { paddingVertical: 48, alignItems: 'center' },
  top: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, paddingBottom: 8, backgroundColor: colors.surface },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 32, fontWeight: '800', color: colors.brand },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  creatorBadge: { backgroundColor: 'rgba(217,119,6,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  classRepBadge: { backgroundColor: 'rgba(22,163,74,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  classRepBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  creatorBadgeText: { fontSize: 11, fontWeight: '700', color: '#d97706' },
  muted: { fontSize: 14, color: colors.muted },
  bio: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: 32, marginTop: 18 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.brand, borderRadius: radius.full,
    paddingVertical: 9, paddingHorizontal: 20,
  },
  editText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  iconBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    padding: 9, backgroundColor: colors.surface,
  },
  statusSection: {
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  statusTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  statusManageLink: { fontSize: 12, fontWeight: '600', color: colors.brand },
  statusRow: { flexDirection: 'row', gap: 14 },
  statusItem: { alignItems: 'center', width: 56 },
  statusAddCircle: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.brand, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },
  statusItemLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  statusThumbWrap: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.brand, overflow: 'hidden',
  },
  statusThumb: { width: '100%', height: '100%', backgroundColor: colors.surfaceSubtle },
  statusThumbText: { color: '#fff', fontSize: 8, fontWeight: '700', textAlign: 'center' },
  statusDeleteBtn: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  statusFootnote: { fontSize: 11, color: colors.muted, marginTop: 10 },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13 },
  tabOn: { fontSize: 14, fontWeight: '800', color: colors.text },
  tabOff: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2.5, width: 40, borderRadius: 2, backgroundColor: colors.brand },
  post: {
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card, padding: 14,
  },
  postTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 21 },
  postImage: { width: '100%', height: 240, borderRadius: 10, marginTop: 10, backgroundColor: colors.surfaceSubtle },
  postMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  replyLabel: { fontSize: 12, color: colors.brand, fontWeight: '700', marginBottom: 4 },
});
