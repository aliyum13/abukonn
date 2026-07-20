import { useEffect, useState, useCallback } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, TextInput, Linking, Alert, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/lib/api';
import { colors, radius, shadow } from '../../src/theme';
import { useTabScrollToTop } from '../../src/lib/useScrollToTop';
import { DEPARTMENTS, LEVELS } from '../../src/lib/departments';

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
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { ref: listRef, setRefresh } = useTabScrollToTop<Material>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async (t: string, q: string, dept = '', lvl = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (t && t !== 'all') params.append('type', t);
      if (q.trim()) params.append('search', q.trim());
      if (dept) params.append('department', dept);
      if (lvl) params.append('level', lvl);
      const data = await apiFetch<{ materials: Material[] }>(`/api/library?${params.toString()}`);
      setMaterials(data.materials || []);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(type, search, department, level); }, [type, department, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRefresh(() => load(type, search, department, level)); }, [type, search, department, level, load, setRefresh]);

  // Debounce search so we're not firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(type, search, department, level), 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = async (m: Material) => {
    // Office files (Word/PPT/Excel) don't render natively — route them through
    // Microsoft's web viewer, matching web. PDFs/images open directly.
    const OFFICE = new Set(['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);
    const ext = ((m.file_name || m.title).split('.').pop() || '').toLowerCase();
    const url = OFFICE.has(ext)
      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(m.file_url)}`
      : m.file_url;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Cannot open', 'This file could not be opened.');
    } catch {
      Alert.alert('Cannot open', 'This file could not be opened.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}><Text style={s.title}>Library</Text></View>

      <View style={s.quickRow}>
        <TouchableOpacity style={s.quickCard} onPress={() => router.push('/academic-calendar')}>
          <View style={s.quickIcon}><Ionicons name="calendar-outline" size={22} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.quickTitle}>Academic Calendar</Text>
            <Text style={s.quickSub} numberOfLines={1}>Semester dates, exams & breaks</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={s.quickCard} onPress={() => router.push('/timetable')}>
          <View style={s.quickIcon}><Ionicons name="time-outline" size={22} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.quickTitle}>Timetable</Text>
            <Text style={s.quickSub} numberOfLines={1}>Your department's class schedule</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

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
        <TouchableOpacity style={[s.filterBtn, (department || level) ? s.filterBtnActive : null]} onPress={() => setFilterOpen(true)}>
          <Ionicons name="options-outline" size={18} color={(department || level) ? '#fff' : colors.textSecondary} />
          {(department || level) ? <View style={s.filterDot} /> : null}
        </TouchableOpacity>
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
              onRefresh={() => { setRefreshing(true); load(type, search, department, level); }}
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

      {/* Department / Level filter */}
      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <View style={s.fBackdrop}>
          <View style={s.fSheet}>
            <View style={s.fHeader}>
              <Text style={s.fTitle}>Filter</Text>
              <TouchableOpacity onPress={() => { setDepartment(''); setLevel(''); }} hitSlop={8}>
                <Text style={s.fClear}>Clear all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
              <Text style={s.fLabel}>Level</Text>
              <View style={s.fChips}>
                <TouchableOpacity style={[s.fChip, !level ? s.fChipOn : null]} onPress={() => setLevel('')}>
                  <Text style={!level ? s.fChipTextOn : s.fChipText}>All</Text>
                </TouchableOpacity>
                {LEVELS.map(l => (
                  <TouchableOpacity key={l} style={[s.fChip, level === l ? s.fChipOn : null]} onPress={() => setLevel(l)}>
                    <Text style={level === l ? s.fChipTextOn : s.fChipText}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.fLabel}>Department</Text>
              <View style={s.fChips}>
                <TouchableOpacity style={[s.fChip, !department ? s.fChipOn : null]} onPress={() => setDepartment('')}>
                  <Text style={!department ? s.fChipTextOn : s.fChipText}>All</Text>
                </TouchableOpacity>
                {DEPARTMENTS.map(d => (
                  <TouchableOpacity key={d} style={[s.fChip, department === d ? s.fChipOn : null]} onPress={() => setDepartment(d)}>
                    <Text style={department === d ? s.fChipTextOn : s.fChipText} numberOfLines={1}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={s.fApply} onPress={() => setFilterOpen(false)}>
              <Text style={s.fApplyText}>Show results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  quickRow: { paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  quickCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  quickIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  quickSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  search: {
    marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15,
    color: colors.text, backgroundColor: colors.surface,
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  filterBtn: { marginHorizontal: 12, width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  fBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  fSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  fHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  fClear: { fontSize: 14, color: colors.brand, fontWeight: '700' },
  fLabel: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  fChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, maxWidth: '100%' },
  fChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  fChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  fChipTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  fApply: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  fApplyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
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
