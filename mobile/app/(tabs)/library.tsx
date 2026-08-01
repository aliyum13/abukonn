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
import { DEPARTMENTS, DEPARTMENT_GROUPS, LEVELS } from '../../src/lib/departments';

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

// Must match the only values that can ever actually exist: the admin
// upload form (backend/src/routes/library.js's single POST /admin/upload,
// the only material-creation path -- there's no non-admin upload route) is
// hardcoded to exactly these four: past_question, lecture_note, textbook,
// other. Confirmed by reading web/src/app/admin/library/page.tsx's own
// TYPES array directly, not assumed.
//
// This wasn't just a wording mismatch -- it was two live bugs. 'note' never
// matched anything (real materials are always 'lecture_note'), so tapping
// "Notes" always showed zero results. 'slide' could never have data at all,
// since nothing in the admin form (the only place that creates materials)
// ever produces that value -- a permanently dead filter.
const TYPES = [
  { key: 'all', label: 'All Materials' },
  { key: 'past_question', label: 'Past Questions' },
  { key: 'lecture_note', label: 'Lecture Notes' },
  { key: 'textbook', label: 'Textbooks' },
  { key: 'other', label: 'Other' },
];

const TYPE_ICON: Record<string, string> = {
  past_question: '📄',
  lecture_note: '📝',
  textbook: '📚',
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
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_LIMIT = 20; // must match backend Library.getMaterials limit

  // Loads a page. page 1 replaces the list; higher pages append (infinite
  // scroll). Mirrors web's server-side paging + filters, using append instead
  // of Previous/Next since that's the native pattern.
  const load = useCallback(async (t: string, q: string, fac = '', dept = '', lvl = '', pg = 1) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (t && t !== 'all') params.append('type', t);
      if (q.trim()) params.append('search', q.trim());
      if (fac) params.append('faculty', fac);
      if (dept) params.append('department', dept);
      if (lvl) params.append('level', lvl);
      params.append('page', String(pg));
      const data = await apiFetch<{ materials: Material[]; total: number }>(`/api/library?${params.toString()}`);
      const rows = data.materials || [];
      setMaterials(prev => (pg === 1 ? rows : [...prev, ...rows]));
      setTotal(data.total || 0);
      setPage(pg);
    } catch {
      if (pg === 1) setMaterials([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  // Filter/search changes reset to page 1.
  useEffect(() => { load(type, search, faculty, department, level, 1); }, [type, faculty, department, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRefresh(() => load(type, search, faculty, department, level, 1)); }, [type, search, faculty, department, level, load, setRefresh]);

  // Debounce search so we're not firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(type, search, faculty, department, level, 1), 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll: fetch the next page when the list nears its end, but only
  // if there's more to load and we're not already fetching.
  const loadMore = useCallback(() => {
    if (loadingMore || loading) return;
    if (materials.length >= total) return; // all loaded
    load(type, search, faculty, department, level, page + 1);
  }, [loadingMore, loading, materials.length, total, type, search, faculty, department, level, page, load]);

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
        <TouchableOpacity style={s.quickCard} onPress={() => router.push('/cgpa-calculator')}>
          <View style={s.quickIcon}><Ionicons name="calculator-outline" size={22} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.quickTitle}>CGPA Calculator</Text>
            <Text style={s.quickSub} numberOfLines={1}>Track your GPA every semester</Text>
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
        <TouchableOpacity style={[s.filterBtn, (faculty || department || level) ? s.filterBtnActive : null]} onPress={() => setFilterOpen(true)}>
          <Ionicons name="options-outline" size={18} color={(faculty || department || level) ? '#fff' : colors.textSecondary} />
          {(faculty || department || level) ? <View style={s.filterDot} /> : null}
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
              onRefresh={() => { setRefreshing(true); load(type, search, faculty, department, level, 1); }}
              tintColor={colors.brand} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={s.footerLoad}><ActivityIndicator color={colors.brand} /></View>
            ) : null
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
              <TouchableOpacity onPress={() => { setFaculty(''); setDepartment(''); setLevel(''); }} hitSlop={8}>
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
              <Text style={s.fLabel}>Faculty</Text>
              <View style={s.fChips}>
                <TouchableOpacity style={[s.fChip, !faculty ? s.fChipOn : null]} onPress={() => { setFaculty(''); setDepartment(''); }}>
                  <Text style={!faculty ? s.fChipTextOn : s.fChipText}>All</Text>
                </TouchableOpacity>
                {DEPARTMENT_GROUPS.map(g => (
                  <TouchableOpacity key={g.faculty} style={[s.fChip, faculty === g.faculty ? s.fChipOn : null]}
                    onPress={() => { setFaculty(g.faculty); setDepartment(''); }}>
                    <Text style={faculty === g.faculty ? s.fChipTextOn : s.fChipText} numberOfLines={1}>{g.faculty}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.fLabel}>Department</Text>
              <View style={s.fChips}>
                <TouchableOpacity style={[s.fChip, !department ? s.fChipOn : null]} onPress={() => setDepartment('')}>
                  <Text style={!department ? s.fChipTextOn : s.fChipText}>All</Text>
                </TouchableOpacity>
                {(faculty
                  ? (DEPARTMENT_GROUPS.find(g => g.faculty === faculty)?.departments ?? [])
                  : DEPARTMENTS
                ).map(d => (
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
  footerLoad: { paddingVertical: 20, alignItems: 'center' },
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
