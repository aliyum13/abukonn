import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  Image, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../src/lib/api';
import { colors, radius, shadow } from '../../src/theme';
import { useTabScrollToTop } from '../../src/lib/useScrollToTop';

interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  author_name: string | null;
  created_at: string;
}

// Same set the web News page uses.
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'admission', label: 'Admission' },
  { key: 'examination', label: 'Exams' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'sports', label: 'Sports' },
  { key: 'events', label: 'Events' },
  { key: 'general', label: 'General' },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function News() {
  const { ref: listRef, setRefresh } = useTabScrollToTop<Article>();
  const [news, setNews] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState<Article | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ news: Article[] }>('/api/news', {}, false);
      setNews(data.news || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); setRefresh(load); }, [load, setRefresh]);

  const filtered = cat === 'all' ? news : news.filter(n => n.category === cat);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}><Text style={s.title}>News</Text></View>

      <View style={s.filterRow}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.key}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chip, cat === item.key ? s.chipOn : null]}
              onPress={() => setCat(item.key)}
            >
              <Text style={cat === item.key ? s.chipTextOn : s.chipText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={n => String(n.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}><Text style={s.muted}>No news yet</Text></View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} activeOpacity={0.8} onPress={() => setOpen(item)}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={s.cardImg} resizeMode="cover" />
              ) : null}
              <View style={s.cardBody}>
                <Text style={s.cat}>{item.category.toUpperCase()}</Text>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.preview} numberOfLines={2}>{item.content}</Text>
                <Text style={s.meta}>
                  {item.author_name ? `${item.author_name} · ` : ''}{timeAgo(item.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Full article */}
      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={s.back}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>News</Text>
            <View style={{ width: 50 }} />
          </View>
          {open ? (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {open.image_url ? (
                <Image source={{ uri: open.image_url }} style={s.fullImg} resizeMode="cover" />
              ) : null}
              <Text style={s.cat}>{open.category.toUpperCase()}</Text>
              <Text style={s.fullTitle}>{open.title}</Text>
              <Text style={s.meta}>
                {open.author_name ? `${open.author_name} · ` : ''}{timeAgo(open.created_at)}
              </Text>
              <Text style={s.fullBody}>{open.content}</Text>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  filterRow: { marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chipTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted: { color: colors.muted, fontSize: 15 },
  card: {
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card,
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: 180, backgroundColor: '#f3f4f6' },
  cardBody: { padding: 16 },
  cat: { fontSize: 11, fontWeight: '800', color: colors.brand, letterSpacing: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 },
  preview: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 8 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  fullImg: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16, backgroundColor: '#f3f4f6' },
  fullTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  fullBody: { fontSize: 16, color: colors.text, lineHeight: 26, marginTop: 16 },
});
