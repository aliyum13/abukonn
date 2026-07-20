import { useEffect, useState, useCallback } from 'react';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { colors, radius, shadow } from '../src/theme';

interface Override {
  kind: 'cancel' | 'edit' | 'add';
  note?: string | null;
  new?: {
    start_time?: string;
    end_time?: string;
    course_code?: string | null;
    course_title?: string;
    venue?: string | null;
    lecturer?: string | null;
  };
}

interface ClassItem {
  id: number | string;
  day_of_week?: string;
  start_time: string;
  end_time: string;
  course_code: string | null;
  course_title: string;
  venue: string | null;
  lecturer: string | null;
  override?: Override | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Timetable() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [mode, setMode] = useState<'today' | 'week'>('today');
  const [today, setToday] = useState<ClassItem[]>([]);
  const [todayName, setTodayName] = useState<string | null>(null);
  const [week, setWeek] = useState<ClassItem[]>([]);
  const [dept, setDept] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (m: 'today' | 'week') => {
    setLoading(true);
    try {
      if (m === 'today') {
        const d = await apiFetch<{ classes: ClassItem[]; day: string | null; no_profile?: boolean }>(
          '/api/timetable/today');
        setToday(d.classes || []);
        setTodayName(d.day);
        setNoProfile(!!d.no_profile);
      } else {
        const d = await apiFetch<{ classes: ClassItem[]; department: string | null; level: string | null; no_profile?: boolean }>(
          '/api/timetable/week');
        setWeek(d.classes || []);
        setDept(d.department);
        setLevel(d.level);
        setNoProfile(!!d.no_profile);
      }
    } catch {
      if (m === 'today') setToday([]); else setWeek([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(mode); }, [mode, load]);

  const renderClass = (c: ClassItem) => {
    const cancelled = c.override?.kind === 'cancel';
    const changed = c.override?.kind === 'edit';
    const added = c.override?.kind === 'add';
    const nv = c.override?.new;
    return (
      <View style={[s.class, cancelled ? s.cancelled : added ? s.added : null]}>
        <View style={s.timeCol}>
          <Text style={[s.time, cancelled ? s.strike : null]}>{c.start_time}</Text>
          <Text style={s.timeEnd}>{c.end_time}</Text>
        </View>
        <View style={s.bar} />
        <View style={{ flex: 1 }}>
          <Text style={[s.course, cancelled ? s.strike : null]}>
            {c.course_code ? `${c.course_code} · ` : ''}{c.course_title}
          </Text>
          {c.venue ? <Text style={s.detail}>📍 {c.venue}</Text> : null}
          {c.lecturer ? <Text style={s.detail}>👤 {c.lecturer}</Text> : null}

          {cancelled ? (
            <Text style={s.cancelTag}>
              Cancelled{c.override?.note ? ` — ${c.override.note}` : ''}
            </Text>
          ) : null}
          {changed ? (
            <Text style={s.changeTag}>
              Rescheduled{nv?.venue ? ` → ${nv.venue}` : ''}
              {nv?.start_time ? ` at ${nv.start_time}` : ''}
              {c.override?.note ? ` — ${c.override.note}` : ''}
            </Text>
          ) : null}
          {added ? (
            <Text style={s.addedTag}>
              Extra class{c.override?.note ? ` — ${c.override.note}` : ''}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  // Group week classes by day.
  const weekByDay = DAYS
    .map(day => ({ day, items: week.filter(c => c.day_of_week === day) }))
    .filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Timetable</Text>
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, mode === 'today' ? s.toggleOn : null]}
            onPress={() => setMode('today')}
          >
            <Text style={mode === 'today' ? s.toggleTextOn : s.toggleText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, mode === 'week' ? s.toggleOn : null]}
            onPress={() => setMode('week')}
          >
            <Text style={mode === 'week' ? s.toggleTextOn : s.toggleText}>Week</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : noProfile ? (
        <View style={s.center}>
          <Text style={s.muted}>Set your department and level</Text>
          <Text style={s.mutedSmall}>Your timetable is based on your profile</Text>
        </View>
      ) : mode === 'today' ? (
        today.length === 0 ? (
          <View style={s.center}>
            <Text style={s.muted}>No classes {todayName ? `on ${todayName}` : 'today'}</Text>
            <Text style={s.mutedSmall}>Enjoy the free day</Text>
          </View>
        ) : (
          <FlatList
            data={today}
            keyExtractor={c => String(c.id)}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load('today'); }}
                tintColor={colors.brand} />
            }
            ListHeaderComponent={todayName ? <Text style={s.dayLabel}>{todayName}</Text> : null}
            renderItem={({ item }) => renderClass(item)}
          />
        )
      ) : (
        <FlatList
          data={weekByDay}
          keyExtractor={g => g.day}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load('week'); }}
              tintColor={colors.brand} />
          }
          ListHeaderComponent={
            dept ? <Text style={s.mutedSmall}>{dept}{level ? ` · ${level}` : ''}</Text> : null
          }
          ListEmptyComponent={
            <View style={s.center}><Text style={s.muted}>No timetable yet</Text></View>
          }
          renderItem={({ item }) => (
            <View style={{ marginBottom: 18 }}>
              <Text style={s.dayLabel}>{item.day}</Text>
              {item.items.map(c => <View key={c.id}>{renderClass(c)}</View>)}
            </View>
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
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  toggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 2 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  toggleOn: { backgroundColor: colors.surface },
  toggleText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  toggleTextOn: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  muted: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  mutedSmall: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  dayLabel: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  class: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  cancelled: { opacity: 0.6 },
  added: { borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  timeCol: { width: 58 },
  time: { fontSize: 14, fontWeight: '700', color: colors.text },
  timeEnd: { fontSize: 12, color: colors.muted, marginTop: 2 },
  strike: { textDecorationLine: 'line-through' },
  bar: { width: 3, borderRadius: 2, backgroundColor: colors.brand },
  course: { fontSize: 15, fontWeight: '700', color: colors.text },
  detail: { fontSize: 13, color: colors.muted, marginTop: 3 },
  cancelTag: { fontSize: 12, color: colors.danger, fontWeight: '700', marginTop: 5 },
  changeTag: { fontSize: 12, color: '#0ea5e9', fontWeight: '700', marginTop: 5 },
  addedTag: { fontSize: 12, color: '#16a34a', fontWeight: '700', marginTop: 5 },
});
