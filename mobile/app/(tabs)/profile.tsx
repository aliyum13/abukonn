import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/lib/api';
import { colors, radius, shadow } from '../../src/theme';

interface ProfilePost {
  id: number;
  content: string;
  image_url: string | null;
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

  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [replies, setReplies] = useState<ProfileReply[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        user: { followers_count: number; following_count: number };
        posts: ProfilePost[];
        replies: ProfileReply[];
      }>('/api/users/me');
      setPosts(data.posts || []);
      setReplies(data.replies || []);
      setFollowers(data.user?.followers_count || 0);
      setFollowing(data.user?.following_count || 0);
    } catch {
      // keep whatever we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
          <Image source={{ uri: user.profile_photo_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.fallback]}>
            <Text style={s.letter}>{user?.full_name?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.name}>{user?.full_name}</Text>
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
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="create-outline" size={16} color={colors.brand} />
            <Text style={s.editText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
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
              <View style={s.post}>
                {(item as ProfilePost).discussion_title ? (
                  <Text style={s.postTitle}>{(item as ProfilePost).discussion_title}</Text>
                ) : null}
                {item.content ? <Text style={s.postContent}>{item.content}</Text> : null}
                {(item as ProfilePost).image_url ? (
                  <Image source={{ uri: (item as ProfilePost).image_url! }} style={s.postImage} resizeMode="contain" />
                ) : null}
                <View style={s.postMeta}>
                  <Text style={s.muted}>{'\u2665'} {(item as ProfilePost).likes_count}   {'\uD83D\uDCAC'} {(item as ProfilePost).comments_count}</Text>
                  <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>
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
