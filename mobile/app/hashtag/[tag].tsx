import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/lib/api';
import { PostContent } from '../../src/components/PostContent';
import { colors } from '../../src/theme';

interface Post {
  id: number; user_id: number; content: string; image_url: string | null;
  author_name: string; author_department: string | null; author_photo: string | null;
  likes_count: number; comments_count: number; created_at: string; is_liked?: boolean;
  discussion_title?: string | null;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function HashtagFeed() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag: string }>();

  const [posts, setPosts] = useState<Post[]>([]);
  const [postCount, setPostCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ posts: Post[]; meta?: { post_count?: number } }>(`/api/hashtags/${encodeURIComponent(tag)}/posts`);
      setPosts(d.posts || []);
      setPostCount(d.meta?.post_count ?? d.posts?.length ?? 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  const toggleLike = async (postId: number, wasLiked: boolean) => {
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, is_liked: !wasLiked, likes_count: p.likes_count + (wasLiked ? -1 : 1) }
      : p));
    try {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, is_liked: wasLiked, likes_count: p.likes_count + (wasLiked ? 1 : -1) }
        : p));
    }
  };

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ width: 60 }}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.title} numberOfLines={1}>#{tag}</Text>
          {postCount != null ? (
            <Text style={s.postCount}>{postCount.toLocaleString()} {postCount === 1 ? 'post' : 'posts'}</Text>
          ) : null}
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No posts with #{tag} yet</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.post}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(item.id) } })}
            >
              <TouchableOpacity
                style={s.authorRow}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.user_id) } })}
              >
                {item.author_photo ? (
                  <Image source={{ uri: item.author_photo }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{item.author_name?.charAt(0).toUpperCase()}</Text></View>
                )}
                <View>
                  <Text style={s.author}>{item.author_name}</Text>
                  <Text style={s.muted}>{item.author_department} · {timeAgo(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
              {item.discussion_title ? <Text style={s.postTitle}>{item.discussion_title}</Text> : null}
              {item.content ? <PostContent content={item.content} style={s.content} /> : null}
              {item.image_url ? <Image source={{ uri: item.image_url }} style={s.image} resizeMode="contain" /> : null}
              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(item.id, !!item.is_liked)}>
                  <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={19} color={item.is_liked ? colors.danger : colors.textSecondary} />
                  <Text style={[s.actionText, item.is_liked ? { color: colors.danger } : null]}>{item.likes_count}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(item.id) } })}>
                  <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                  <Text style={s.actionText}>{item.comments_count}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  backText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: colors.brand },
  postCount: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  center: { paddingVertical: 48, alignItems: 'center' },
  muted: { fontSize: 13, color: colors.muted },
  post: {
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 16, fontWeight: '800', color: colors.brand },
  author: { fontSize: 14, fontWeight: '700', color: colors.text },
  postTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  content: { fontSize: 15, color: colors.text, lineHeight: 21 },
  image: { width: '100%', height: 240, borderRadius: 10, marginTop: 10, backgroundColor: colors.surfaceSubtle },
  actions: { flexDirection: 'row', gap: 22, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
});
