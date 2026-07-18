import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../src/lib/api';
import { colors, radius } from '../src/theme';

interface RepClass { id: number; department: string; level: string }
interface Override {
  id: number; override_date: string; kind: 'add' | 'edit' | 'cancel';
  course_code: string | null; course_title: string | null;
  start_time: string | null; end_time: string | null;
  venue: string | null; note: string | null;
}

export default function ClassRep() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [classes, setClasses] = useState<RepClass[]>([]);
  const [active, setActive] = useState<RepClass | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  // Create-override modal
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<'add' | 'cancel'>('add');
  const [date, setDate] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const d = await apiFetch<{ classes: RepClass[] }>('/api/class-reps/my-classes');
      setClasses(d.classes || []);
      if (d.classes?.length) setActive(prev => prev || d.classes[0]);
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverrides = useCallback(async (cls: RepClass) => {
    try {
      const d = await apiFetch<{ overrides: Override[] }>(
        `/api/class-reps/overrides?department=${encodeURIComponent(cls.department)}&level=${encodeURIComponent(cls.level)}`);
      setOverrides(d.overrides || []);
    } catch {
      setOverrides([]);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { if (active) loadOverrides(active); }, [active, loadOverrides]);

  const resetForm = () => {
    setKind('add'); setDate(''); setCourseTitle(''); setCourseCode('');
    setStartTime(''); setEndTime(''); setVenue(''); setNote('');
  };

  const submit = async () => {
    if (!active) return;
    if (!date.trim()) { Alert.alert('Date required', 'Enter the date (YYYY-MM-DD).'); return; }
    if (kind === 'add' && (!courseTitle.trim() || !startTime.trim())) {
      Alert.alert('Missing details', 'Course title and start time are required for an extra class.'); return;
    }
    if (kind === 'cancel' && !courseTitle.trim()) {
      Alert.alert('Which class?', 'Enter the course title to cancel.'); return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/class-reps/overrides', {
        method: 'POST',
        body: JSON.stringify({
          department: active.department, level: active.level,
          override_date: date.trim(), kind,
          course_code: courseCode.trim() || null,
          course_title: courseTitle.trim() || null,
          start_time: startTime.trim() || null,
          end_time: endTime.trim() || null,
          venue: venue.trim() || null,
          note: note.trim() || null,
        }),
      });
      resetForm();
      setModalOpen(false);
      loadOverrides(active);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = (id: number) => {
    Alert.alert('Remove change', 'Delete this timetable change?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setOverrides(prev => prev.filter(o => o.id !== id));
          try {
            await apiFetch(`/api/class-reps/overrides/${id}`, { method: 'DELETE' });
          } catch { if (active) loadOverrides(active); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      </SafeAreaView>
    );
  }

  if (classes.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ width: 60 }}>
            <Text style={s.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Class Rep</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="school-outline" size={48} color={colors.muted} />
          <Text style={s.muted}>You&apos;re not a class rep for any class.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ width: 60 }}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Class Rep</Text>
        <TouchableOpacity onPress={() => { resetForm(); setModalOpen(true); }} hitSlop={10} style={{ width: 60, alignItems: 'flex-end' }}>
          <Ionicons name="add-circle" size={26} color={colors.brand} />
        </TouchableOpacity>
      </View>

      {/* Class selector when a rep covers more than one */}
      {classes.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.classRow}>
          {classes.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[s.classChip, active?.id === c.id ? s.classChipOn : null]}
              onPress={() => setActive(c)}
            >
              <Text style={active?.id === c.id ? s.classChipTextOn : s.classChipText}>{c.department} · {c.level}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={s.singleClass}>
          <Text style={s.singleClassText}>{active?.department} · {active?.level}</Text>
        </View>
      )}

      <FlatList
        data={overrides}
        keyExtractor={o => String(o.id)}
        ListHeaderComponent={<Text style={s.listHeading}>Upcoming timetable changes</Text>}
        ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No changes posted yet</Text></View>}
        renderItem={({ item }) => (
          <View style={s.override}>
            <View style={[s.kindBadge, item.kind === 'cancel' ? s.cancelBadge : item.kind === 'add' ? s.addBadge : s.editBadge]}>
              <Text style={s.kindText}>{item.kind === 'cancel' ? 'CANCELLED' : item.kind === 'add' ? 'EXTRA' : 'CHANGED'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ovTitle}>{item.course_title || item.course_code || 'Class'}</Text>
              <Text style={s.muted}>{item.override_date}{item.start_time ? ` · ${item.start_time}${item.end_time ? `–${item.end_time}` : ''}` : ''}</Text>
              {item.venue ? <Text style={s.muted}>📍 {item.venue}</Text> : null}
              {item.note ? <Text style={s.ovNote}>{item.note}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => removeOverride(item.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Create override */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={12}>
                <Text style={s.backText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.title}>New change</Text>
              <TouchableOpacity onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.brand} /> : <Text style={s.saveText}>Post</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
              <View style={s.kindToggle}>
                <TouchableOpacity style={[s.kindOpt, kind === 'add' ? s.kindOptOn : null]} onPress={() => setKind('add')}>
                  <Text style={kind === 'add' ? s.kindOptTextOn : s.kindOptText}>Extra class</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.kindOpt, kind === 'cancel' ? s.kindOptOn : null]} onPress={() => setKind('cancel')}>
                  <Text style={kind === 'cancel' ? s.kindOptTextOn : s.kindOptText}>Cancel a class</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Date</Text>
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />

              <Text style={s.label}>Course title</Text>
              <TextInput style={s.input} value={courseTitle} onChangeText={setCourseTitle} placeholder="e.g. Financial Accounting" placeholderTextColor={colors.muted} />

              <Text style={s.label}>Course code (optional)</Text>
              <TextInput style={s.input} value={courseCode} onChangeText={setCourseCode} placeholder="e.g. ACC302" placeholderTextColor={colors.muted} autoCapitalize="characters" />

              {kind === 'add' ? (
                <>
                  <Text style={s.label}>Start time</Text>
                  <TextInput style={s.input} value={startTime} onChangeText={setStartTime} placeholder="e.g. 10:00 AM" placeholderTextColor={colors.muted} />
                  <Text style={s.label}>End time (optional)</Text>
                  <TextInput style={s.input} value={endTime} onChangeText={setEndTime} placeholder="e.g. 12:00 PM" placeholderTextColor={colors.muted} />
                  <Text style={s.label}>Venue (optional)</Text>
                  <TextInput style={s.input} value={venue} onChangeText={setVenue} placeholder="e.g. LT1" placeholderTextColor={colors.muted} />
                </>
              ) : null}

              <Text style={s.label}>Note (optional)</Text>
              <TextInput style={[s.input, { height: 80 }]} value={note} onChangeText={setNote} placeholder="Anything students should know" placeholderTextColor={colors.muted} multiline />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
  backText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  saveText: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { fontSize: 13, color: colors.muted },
  classRow: { padding: 12, gap: 8 },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  classChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  classChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  classChipTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  singleClass: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  singleClassText: { fontSize: 15, fontWeight: '700', color: colors.text },
  listHeading: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, padding: 16, paddingBottom: 8 },
  override: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  kindBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  cancelBadge: { backgroundColor: '#fee2e2' },
  addBadge: { backgroundColor: '#dcfce7' },
  editBadge: { backgroundColor: '#fef9c3' },
  kindText: { fontSize: 10, fontWeight: '800', color: '#374151' },
  ovTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  ovNote: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  kindToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kindOpt: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  kindOptOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  kindOptText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  kindOptTextOn: { fontSize: 14, fontWeight: '700', color: '#fff' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text,
  },
});
