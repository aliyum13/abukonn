import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, TextInput, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../src/lib/api';
import { colors, radius, shadow } from '../../src/theme';
import { useTabScrollToTop } from '../../src/lib/useScrollToTop';

interface Material {
  id: number;
  title: string;
  description: string | null;
  type: string;
  course_code: string | null;
  course_title: string | null;
  department: string | null;
  level: string | null;
  file_url: string;
  file_name: string | null;
  download_count: number;
  created_at: string;
}

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'past_question', label: 'Past Qs' },
  { key: 'note', label: 'Notes' },
  { key: 'textbook', label: 'Books' },
  { key: 'slide', label: 'Slides' },
  { key: 'other', label: 'Other' },
];

const TYPE_ICON: Record<string, string> = {
  past_question: '📄',
  note: '📝',
  textbook: '📚',
  slide: '📊',
  other: '📁',
};

export default function Library() {
  const { ref: listRef, setRefresh } = useTabScrollToTop<Material>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');

  const load = useCallback(async (t: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (t && t !== 'all') params.append('type', t);
      if (q.trim()) params.append('search', q.trim());
      const data = await apiFetch<{ materials: Material[] }>(`/api/library?${params.toString()}`);
      setMaterials(data.materials || []);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(type, search); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRefresh(() => load(type, search)); }, [type, search, load, setRefresh]);

  // Debounce search so we're not firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(type, search), 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = async (m: Material) => {
    try {
      const ok = await Linking.canOpenURL(m.file_url);
      if (ok) await Linking.openURL(m.file_url);
      else Alert.alert('Cannot open', 'This file could not be opened.');
    } catch {
      Alert.alert('Cannot open', 'This file could not be opened.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}><Text style={s.title}>Library</Text></View>

      <TextInput
        style={s.search}
        placeholder="Search by title or course code..."
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <View style={s.filterRow}>
        <FlatList
          data={TYPES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={t => t.key}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chip, type === item.key ? s.chipOn : null]}
              onPress={() => setType(item.key)}
            >
              <Text style={type === item.key ? s.chipTextOn : s.chipText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={materials}
          keyExtractor={m => String(m.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(type, search); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>Nothing found</Text>
              <Text style={s.mutedSmall}>Try a different filter or search term</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => openFile(item)} activeOpacity={0.7}>
              <Text style={s.icon}>{TYPE_ICON[item.type] ?? '📁'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.course_code ? (
                  <Text style={s.course}>
                    {item.course_code}{item.course_title ? ` · ${item.course_title}` : ''}
                  </Text>
                ) : null}
                <Text style={s.meta}>
                  {item.department ?? 'General'}
                  {item.level ? ` · ${item.level}` : ''}
                  {item.download_count ? ` · ${item.download_count} downloads` : ''}
                </Text>
              </View>
              <Text style={s.open}>Open</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  search: {
    marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15,
    color: colors.text, backgroundColor: colors.surface,
  },
  filterRow: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chipTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  muted: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  mutedSmall: { color: colors.muted, fontSize: 13 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  icon: { fontSize: 26 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  course: { fontSize: 13, color: colors.brand, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  open: { color: colors.brand, fontWeight: '700', fontSize: 13 },
});
