import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { colors } from '../src/theme';
import { PostContent } from '../src/components/PostContent';

interface PostAnalytics {
  id: number;
  content: string;
  image_url: string | null;
  created_at: string;
  view_count: number;
  unique_viewers: number;
  likes_count: number;
  comments_count: number;
  repost_count: number;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

// Aggregate stats per post -- view count, unique viewers, likes/comments/
// reposts. Deliberately NOT a per-viewer identity list, mirrors web's
// analytics page exactly (same confirmed design: a post can rack up
// hundreds of views, so a full viewer roster is a heavier privacy ask than
// profile views and isn't what "analytics" means as a paid perk elsewhere).
// Pro perk; free/ungated for now -- the gate is the marked insertion point
// in the backend's getPostAnalytics, not touched here.
export default function PostAnalyticsScreen() {
  const s = useThemedStyles(make_s);
  const router = useRouter();

  const [posts, setPosts] = useState<PostAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ analytics: PostAnalytics[] }>('/api/posts/analytics');
      setPosts(data.analytics || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Post analytics</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>Once you post, you&apos;ll see views, likes, and comments for each one here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(item.id) } })}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {item.image_url ? <Image source={{ uri: item.image_url }} style={s.thumb} /> : null}
                <View style={{ flex: 1 }}>
                  {item.content ? (
                    <PostContent content={item.content} style={s.content} numberOfLines={2} />
                  ) : (
                    <Text style={s.noCaption}>No caption</Text>
                  )}
                  <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <Text style={s.stat}><Text style={s.statNum}>{item.view_count}</Text> views</Text>
                <Text style={s.stat}><Text style={s.statNum}>{item.unique_viewers}</Text> unique</Text>
                <Text style={s.stat}><Text style={s.statNum}>{item.likes_count}</Text> likes</Text>
                <Text style={s.stat}><Text style={s.statNum}>{item.comments_count}</Text> comments</Text>
                {item.repost_count > 0 ? (
                  <Text style={s.stat}><Text style={s.statNum}>{item.repost_count}</Text> reposts</Text>
                ) : null}
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
  back: { width: 60 },
  backText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 32 },
  muted: { fontSize: 13, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  noCaption: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.border },
  content: { fontSize: 14, color: colors.text },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  stat: { fontSize: 13, color: colors.textSecondary },
  statNum: { fontWeight: '700', color: colors.text },
});
