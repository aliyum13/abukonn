import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { colors, radius } from '../src/theme';
import { apiFetch } from '../src/lib/api';
import { optimizedImage } from '../src/lib/image';
import { StoryComposer } from '../src/components/Stories';

interface MyStory {
  id: number;
  media_url: string | null;
  story_type: 'image' | 'video' | 'text';
  text_content: string | null;
  bg_color: string | null;
  caption: string | null;
  created_at: string;
  view_count: number;
}

// Same shape as messages.tsx/feed.tsx's own local timeAgo — this codebase
// doesn't centralize it into a shared lib, matching that existing pattern
// rather than introducing a new one here.
function timeAgo(iso: string | null) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Mirrors web's /mystories page: a dedicated list of your own active
 * stories with view counts and a way to delete each one, rather than only
 * seeing the view count inline while watching a story in the viewer.
 *
 * Story creation itself is not duplicated here — "Add Story" below opens
 * Stories.tsx's exported StoryComposer, the same modal StoryBar's own "Add"
 * ring uses on Feed, rather than maintaining a second copy of it.
 */
export default function MyStoriesScreen() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [stories, setStories] = useState<MyStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ stories: MyStory[] }>('/api/stories/mine');
      setStories(data.stories || []);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = (story: MyStory) => {
    Alert.alert('Delete story?', 'This story will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeletingId(story.id);
          try {
            await apiFetch(`/api/stories/${story.id}`, { method: 'DELETE' });
            setStories(prev => prev.filter(st => st.id !== story.id));
          } catch {
            Alert.alert('Could not delete', 'Please try again.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>My Stories</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity style={s.addRow} onPress={() => setComposing(true)}>
        <View style={s.addIcon}><Ionicons name="add" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.addTitle}>Add Story</Text>
          <Text style={s.addSub}>Share a photo, video, or text</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : stories.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="images-outline" size={48} color={colors.muted} />
          <Text style={s.emptyTitle}>No active stories</Text>
          <Text style={s.emptySub}>Your stories will appear here. They disappear after 24 hours.</Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={s.thumb}>
                {item.story_type === 'text' ? (
                  <View style={[s.thumb, { backgroundColor: item.bg_color || colors.brand, alignItems: 'center', justifyContent: 'center', padding: 4 }]}>
                    <Text style={s.thumbText} numberOfLines={3}>{item.text_content}</Text>
                  </View>
                ) : item.story_type === 'video' ? (
                  <View style={[s.thumb, { backgroundColor: '#000' }]}>
                    <View style={s.playBadge}><Ionicons name="play" size={12} color="#fff" /></View>
                  </View>
                ) : (
                  <Image source={{ uri: optimizedImage(item.media_url, 120) }} style={s.thumb} />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.rowTime}>{timeAgo(item.created_at)}</Text>
                {item.caption && item.story_type !== 'text' ? (
                  <Text style={s.rowCaption} numberOfLines={1}>{item.caption}</Text>
                ) : null}
                <View style={s.viewsRow}>
                  <Ionicons name="eye-outline" size={14} color={colors.muted} />
                  <Text style={s.viewsText}>{item.view_count} {item.view_count === 1 ? 'view' : 'views'}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                disabled={deletingId === item.id}
                hitSlop={8}
                style={{ padding: 6 }}
              >
                {deletingId === item.id
                  ? <ActivityIndicator size="small" color={colors.muted} />
                  : <Ionicons name="trash-outline" size={19} color={colors.danger} />}
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={<Text style={s.footnote}>Stories disappear after 24 hours</Text>}
        />
      )}

      {composing ? (
        <StoryComposer
          onClose={() => setComposing(false)}
          onPosted={() => { setComposing(false); load(); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 14,
    borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
  },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  addSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  thumbText: { color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' },
  playBadge: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTime: { fontSize: 13, color: colors.textSecondary },
  rowCaption: { fontSize: 13, color: colors.text, marginTop: 2 },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  viewsText: { fontSize: 13, color: colors.muted },
  footnote: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 16 },
});
