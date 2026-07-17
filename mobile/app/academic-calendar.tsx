import { useEffect, useState, useCallback } from 'react';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { colors, radius, shadow } from '../src/theme';

interface Entry {
  id: number;
  session: string;
  semester: 'first' | 'second';
  activity: string;
  from_date: string | null;
  to_date: string | null;
  period: string | null;
}

function fmt(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dateRange(e: Entry): string {
  if (e.period) return e.period;
  if (e.from_date && e.to_date) {
    if (e.from_date === e.to_date) return fmt(e.from_date);
    return `${fmt(e.from_date)} – ${fmt(e.to_date)}`;
  }
  return fmt(e.from_date);
}

export default function AcademicCalendar() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const d = await apiFetch<{ sessions: string[] }>('/api/academic-calendar/sessions');
      setSessions(d.sessions || []);
    } catch {
      setSessions([]);
    }
  }, []);

  const load = useCallback(async (sess: string | null) => {
    try {
      const url = sess
        ? `/api/academic-calendar?session=${encodeURIComponent(sess)}`
        : '/api/academic-calendar';
      const d = await apiFetch<{ session: string; entries: Entry[] }>(url);
      setEntries(d.entries || []);
      if (d.session && !sess) setSession(d.session);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSessions(); load(null); }, [loadSessions, load]);

  const pickSession = (sess: string) => {
    setSession(sess);
    setPickerOpen(false);
    setLoading(true);
    load(sess);
  };

  const first = entries.filter(e => e.semester === 'first');
  const second = entries.filter(e => e.semester === 'second');

  const renderSemester = (title: string, items: Entry[]) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 18 }}>
        <Text style={s.semesterTitle}>{title}</Text>
        <View style={s.card}>
          {items.map((e, i) => (
            <View key={e.id} style={[s.entry, i > 0 ? s.divider : null]}>
              <View style={{ flex: 1 }}>
                <Text style={s.activity}>{e.activity}</Text>
              </View>
              <Text style={s.date}>{dateRange(e)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Academic Calendar</Text>
        <View style={{ width: 50 }} />
      </View>

      {sessions.length > 0 ? (
        <TouchableOpacity style={s.sessionBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.sessionText}>{session || 'Current session'}</Text>
          <Text style={s.sessionCaret}>▾</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Text style={s.muted}>No calendar published yet</Text>
        </View>
      ) : (
        <FlatList
          data={[{ key: 'body' }]}
          keyExtractor={i => i.key}
          contentContainerStyle={s.listPad}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(session); }} tintColor={colors.brand} />}
          renderItem={() => (
            <View>
              {renderSemester('First Semester', first)}
              {renderSemester('Second Semester', second)}
            </View>
          )}
        />
      )}

      {/* Session picker */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Select session</Text>
            <ScrollView>
              {sessions.map(sess => (
                <TouchableOpacity key={sess} style={s.sessionRow} onPress={() => pickSession(sess)}>
                  <Text style={[s.sessionRowText, session === sess ? s.sessionRowOn : null]}>{sess}</Text>
                  {session === sess ? <Text style={s.checkMark}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sessionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  sessionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  sessionCaret: { fontSize: 12, color: colors.muted },
  listPad: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted: { color: colors.muted, fontSize: 15 },
  semesterTitle: {
    fontSize: 13, fontWeight: '800', color: colors.textSecondary,
    marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.card, overflow: 'hidden',
  },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  activity: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20 },
  date: { fontSize: 13, color: colors.brand, fontWeight: '700', textAlign: 'right', maxWidth: 130 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10, maxHeight: '60%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sessionRowText: { fontSize: 16, color: colors.text },
  sessionRowOn: { fontWeight: '800', color: colors.brand },
  checkMark: { color: colors.brand, fontSize: 16, fontWeight: '800' },
});
