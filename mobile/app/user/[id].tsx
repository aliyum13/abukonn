import { useEffect, useState, useCallback } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Image,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

interface ProfileUser {
  id: number;
  full_name: string;
  username: string;
  department: string | null;
  level: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_verified?: boolean;
}

interface Post {
  id: number;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  post_subtype?: string | null;
  discussion_title?: string | null;
}

interface ProfileReply {
  id: number;
  content: string;
  post_id: number;
  created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function UserProfile() {
  const s = useThemedStyles(make_s);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<ProfileReply[]>([]);
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isMe = me?.id === Number(id);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: ProfileUser; posts: Post[]; replies?: ProfileReply[] }>(`/api/users/${id}`);
      setUser(data.user);
      setPosts(data.posts || []);
      setReplies(data.replies || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Connect (mutual connection, separate from follow).
  const [connectStatus, setConnectStatus] = useState<{ status: string; request_id?: number; initiated_by_me?: boolean } | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ status: string; request_id?: number; initiated_by_me?: boolean }>(`/api/connect/${id}/status`)
      .then(setConnectStatus)
      .catch(() => setConnectStatus({ status: 'none' }));
  }, [id]);

  const handleConnect = async () => {
    if (connectBusy || !connectStatus) return;
    setConnectBusy(true);
    try {
      if (connectStatus.status === 'none') {
        const res = await apiFetch<{ request: { id: number } }>(`/api/connect/${id}`, { method: 'POST' });
        setConnectStatus({ status: 'pending', request_id: res.request?.id, initiated_by_me: true });
      } else if (connectStatus.status === 'pending' && connectStatus.initiated_by_me) {
        await apiFetch(`/api/connect/${id}`, { method: 'DELETE' });
        setConnectStatus({ status: 'none' });
      } else if (connectStatus.status === 'pending' && !connectStatus.initiated_by_me && connectStatus.request_id) {
        await apiFetch(`/api/connect/${connectStatus.request_id}/accept`, { method: 'PATCH' });
        setConnectStatus({ status: 'connected' });
      } else if (connectStatus.status === 'connected') {
        Alert.alert('Remove connection', `Disconnect from ${user?.full_name}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove', style: 'destructive',
            onPress: async () => {
              try {
                await apiFetch(`/api/connect/${id}/remove`, { method: 'DELETE' });
                setConnectStatus({ status: 'none' });
              } catch { /* ignore */ }
            },
          },
        ]);
      }
    } catch (err) {
      Alert.alert('Could not update connection', err instanceof Error ? err.message : '');
    } finally {
      setConnectBusy(false);
    }
  };

  const declineIncoming = async () => {
    if (!connectStatus?.request_id) return;
    try {
      await apiFetch(`/api/connect/${connectStatus.request_id}/decline`, { method: 'PATCH' });
      setConnectStatus({ status: 'none' });
    } catch { /* ignore */ }
  };

  // Optimistic follow: flip immediately, roll back if the server refuses.
  const toggleFollow = async () => {
    if (!user || busy) return;
    const was = user.is_following;
    setBusy(true);
    setUser({
      ...user,
      is_following: !was,
      followers_count: user.followers_count + (was ? -1 : 1),
    });
    try {
      await apiFetch(`/api/follows/${id}`, { method: was ? 'DELETE' : 'POST' });
    } catch {
      setUser(u => u ? {
        ...u,
        is_following: was,
        followers_count: u.followers_count + (was ? 1 : -1),
      } : u);
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    try {
      // NOTE: the endpoint takes `recipient_id` and returns { conversation: { id } }.
      const res = await apiFetch<{ conversation: { id: number } }>('/api/messages/start', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: Number(id) }),
      });
      router.push({
        pathname: '/chat/[id]',
        params: { id: String(res.conversation.id), name: user?.full_name ?? 'Chat' },
      });
    } catch {
      /* ignore — the button simply does nothing rather than showing an error */
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={s.back}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={s.error}>{error || 'Profile unavailable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.headerName} numberOfLines={1}>{user.full_name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={(tab === 'posts' ? posts : replies) as (Post | ProfileReply)[]}
        keyExtractor={item => `${tab}-${item.id}`}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brand} />
        }
        ListHeaderComponent={
          <View style={s.top}>
            {user.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.fallback]}>
                <Text style={s.letter}>{user.full_name.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            <Text style={s.name}>
              {user.full_name}{user.is_verified ? ' ✓' : ''}
            </Text>
            {user.department ? (
              <Text style={s.muted}>
                {user.department}{user.level ? ` · ${user.level}` : ''}
              </Text>
            ) : null}
            {user.bio ? <Text style={s.bio}>{user.bio}</Text> : null}

            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statNum}>{user.followers_count}</Text>
                <Text style={s.statLabel}>Followers</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{user.following_count}</Text>
                <Text style={s.statLabel}>Following</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{posts.length}</Text>
                <Text style={s.statLabel}>Posts</Text>
              </View>
            </View>

            {!isMe ? (
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.followBtn, user.is_following ? s.followingBtn : null]}
                  onPress={toggleFollow}
                  disabled={busy}
                >
                  <Text style={user.is_following ? s.followingText : s.followText}>
                    {user.is_following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.msgBtn} onPress={message}>
                  <Text style={s.msgText}>Message</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Connect (mutual) — separate from follow */}
            {!isMe && connectStatus ? (
              connectStatus.status === 'pending' && !connectStatus.initiated_by_me ? (
                <View style={s.connectRow}>
                  <TouchableOpacity style={s.connectBtn} onPress={handleConnect} disabled={connectBusy}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={s.connectText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.declineBtn} onPress={declineIncoming}>
                    <Text style={s.declineText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.connectBtnFull, connectStatus.status === 'connected' ? s.connectedBtn : null]}
                  onPress={handleConnect}
                  disabled={connectBusy}
                >
                  <Ionicons
                    name={
                      connectStatus.status === 'connected' ? 'people'
                      : connectStatus.status === 'pending' ? 'time-outline'
                      : 'person-add-outline'
                    }
                    size={16}
                    color={connectStatus.status === 'connected' ? colors.brand : '#fff'}
                  />
                  <Text style={connectStatus.status === 'connected' ? s.connectedText : s.connectText}>
                    {connectStatus.status === 'connected' ? 'Connected'
                      : connectStatus.status === 'pending' ? 'Requested'
                      : 'Connect'}
                  </Text>
                </TouchableOpacity>
              )
            ) : null}

            <View style={s.profileTabs}>
              {(['posts', 'replies'] as const).map(t => (
                <TouchableOpacity key={t} style={s.profileTab} onPress={() => setTab(t)}>
                  <Text style={tab === t ? s.profileTabOn : s.profileTabOff}>
                    {t === 'posts'
                      ? `Posts${posts.length > 0 ? ` (${posts.length})` : ''}`
                      : `Replies${replies.length > 0 ? ` (${replies.length})` : ''}`}
                  </Text>
                  {tab === t ? <View style={s.profileTabUnderline} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={s.center}><Text style={s.muted}>{tab === 'posts' ? 'No posts yet' : 'No replies yet'}</Text></View>
        }
        renderItem={({ item }) => (
          tab === 'replies' ? (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: String((item as unknown as ProfileReply).post_id) } })}
            >
              <Text style={s.replyLabel}>Replied</Text>
              <Text style={s.content}>{item.content}</Text>
              <Text style={s.meta}>{timeAgo(item.created_at)}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.card}>
              {((item as Post).post_subtype === 'question' || (item as Post).post_subtype === 'discussion')
                && (item as Post).discussion_title ? (
                  <Text style={s.postTitle}>{(item as Post).discussion_title}</Text>
                ) : null}
              {item.content ? <Text style={s.content}>{item.content}</Text> : null}
              {(item as Post).image_url ? (
                <Image source={{ uri: (item as Post).image_url! }} style={s.image} resizeMode="contain" />
              ) : null}
              <Text style={s.meta}>
                {(item as Post).likes_count} likes · {(item as Post).comments_count} comments · {timeAgo(item.created_at)}
              </Text>
            </View>
          )
        )}
      />
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
  top: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 32, fontWeight: '800', color: colors.brand },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12 },
  muted: { fontSize: 14, color: colors.muted, marginTop: 4, textAlign: 'center' },
  bio: { fontSize: 14, color: colors.text, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  stats: { flexDirection: 'row', gap: 32, marginTop: 18 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  connectRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  connectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 10,
  },
  connectBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 10, marginTop: 10,
  },
  connectedBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
  connectText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  connectedText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  declineBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 10,
  },
  declineText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  followBtn: {
    flex: 1, backgroundColor: colors.brand, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  followingBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  followText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  followingText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  msgBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  msgText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  sectionTitle: {
    alignSelf: 'flex-start', fontSize: 15, fontWeight: '700',
    color: colors.text, marginTop: 26, marginBottom: 4,
  },
  profileTabs: { flexDirection: 'row', gap: 28, marginTop: 22, alignSelf: 'stretch', paddingHorizontal: 4 },
  profileTab: { paddingBottom: 8 },
  profileTabOn: { fontSize: 15, fontWeight: '800', color: colors.brand },
  profileTabOff: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  profileTabUnderline: { height: 2, backgroundColor: colors.brand, borderRadius: 1, marginTop: 6 },
  replyLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  card: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  postTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  content: { fontSize: 15, color: colors.text, lineHeight: 22 },
  image: { width: '100%', height: 280, borderRadius: 12, marginTop: 10, backgroundColor: colors.surfaceSubtle },
  meta: { fontSize: 12, color: colors.muted, marginTop: 10 },
});
