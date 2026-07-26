import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { colors, radius, shadow } from '../src/theme';
import {
  Semester, GRADES, computeSemester, computeCumulative, classification, round2,
  loadSemesters, saveSemesters, newSemester, newCourse,
} from '../src/lib/cgpa';

export default function CgpaCalculator() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await loadSemesters();
      setSemesters(loaded.length > 0 ? loaded : [newSemester('Semester 1')]);
      setLoading(false);
    })();
  }, []);

  // Debounced-by-nature: this fires on every edit, but saveSemesters() itself
  // is a single small JSON write — cheap enough not to need debouncing here.
  const persist = useCallback(async (next: Semester[]) => {
    setSemesters(next);
    setSaving(true);
    await saveSemesters(next);
    setSaving(false);
  }, []);

  const addSemester = () => {
    persist([...semesters, newSemester(`Semester ${semesters.length + 1}`)]);
  };

  const removeSemester = (id: string) => {
    if (semesters.length <= 1) {
      Alert.alert('Cannot remove', 'Keep at least one semester.');
      return;
    }
    Alert.alert('Remove semester?', 'This deletes all courses entered for it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => persist(semesters.filter(sem => sem.id !== id)) },
    ]);
  };

  const updateSemesterLabel = (id: string, label: string) => {
    persist(semesters.map(sem => sem.id === id ? { ...sem, label } : sem));
  };

  const addCourse = (semId: string) => {
    persist(semesters.map(sem => sem.id === semId ? { ...sem, courses: [...sem.courses, newCourse()] } : sem));
  };

  const removeCourse = (semId: string, courseId: string) => {
    persist(semesters.map(sem =>
      sem.id === semId ? { ...sem, courses: sem.courses.filter(c => c.id !== courseId) } : sem
    ));
  };

  const updateCourse = (semId: string, courseId: string, patch: Partial<{ code: string; creditUnit: number; grade: string }>) => {
    persist(semesters.map(sem =>
      sem.id === semId
        ? { ...sem, courses: sem.courses.map(c => c.id === courseId ? { ...c, ...patch } : c) }
        : sem
    ));
  };

  const resetAll = () => {
    Alert.alert('Reset everything?', 'This clears all semesters and courses. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => persist([newSemester('Semester 1')]) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      </SafeAreaView>
    );
  }

  const cumulative = computeCumulative(semesters);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>CGPA Calculator</Text>
        <TouchableOpacity onPress={resetAll} hitSlop={10}>
          <Text style={s.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Cumulative summary card */}
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Cumulative GPA</Text>
            <Text style={s.summaryValue}>{round2(cumulative.cgpa)}</Text>
            {cumulative.cgpa !== null ? (
              <Text style={s.summaryClass}>{classification(cumulative.cgpa)}</Text>
            ) : (
              <Text style={s.summaryClass}>Enter courses below to get started</Text>
            )}
            <Text style={s.summarySub}>
              TCP {cumulative.tcp} / TCUR {cumulative.tcur}
              {saving ? '  ·  saving…' : ''}
            </Text>
          </View>

          {semesters.map((sem) => {
            const result = computeSemester(sem);
            return (
              <View key={sem.id} style={s.semCard}>
                <View style={s.semHeader}>
                  <TextInput
                    style={s.semLabelInput}
                    value={sem.label}
                    onChangeText={(t) => updateSemesterLabel(sem.id, t)}
                    placeholder="Semester name"
                    placeholderTextColor={colors.muted}
                  />
                  <TouchableOpacity onPress={() => removeSemester(sem.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={19} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {sem.courses.map((course) => (
                  <View key={course.id} style={s.courseRow}>
                    <TextInput
                      style={[s.courseInput, s.codeInput]}
                      value={course.code}
                      onChangeText={(t) => updateCourse(sem.id, course.id, { code: t })}
                      placeholder="Code"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                    />
                    <TextInput
                      style={[s.courseInput, s.cuInput]}
                      value={course.creditUnit ? String(course.creditUnit) : ''}
                      onChangeText={(t) => updateCourse(sem.id, course.id, { creditUnit: parseInt(t, 10) || 0 })}
                      placeholder="CU"
                      placeholderTextColor={colors.muted}
                      keyboardType="number-pad"
                    />
                    <View style={s.gradeRow}>
                      {GRADES.map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[s.gradeChip, course.grade === g ? s.gradeChipOn : null]}
                          onPress={() => updateCourse(sem.id, course.id, { grade: g })}
                        >
                          <Text style={course.grade === g ? s.gradeChipTextOn : s.gradeChipText}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => removeCourse(sem.id, course.id)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={s.addCourseBtn} onPress={() => addCourse(sem.id)}>
                  <Ionicons name="add" size={16} color={colors.brand} />
                  <Text style={s.addCourseText}>Add course</Text>
                </TouchableOpacity>

                <View style={s.semFooter}>
                  <Text style={s.semGpa}>GPA: {round2(result.gpa)}</Text>
                  <Text style={s.semDetail}>TCP {result.tcp} / TCUR {result.tcur}</Text>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={s.addSemBtn} onPress={addSemester}>
            <Ionicons name="add-circle-outline" size={18} color={colors.brand} />
            <Text style={s.addSemText}>Add semester</Text>
          </TouchableOpacity>

          <Text style={s.footnote}>
            Saved on this device only. Grading scale: A=5, B=4, C=3, D=2, E=1, F=0.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  resetText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  summaryCard: {
    margin: 16, padding: 20, borderRadius: radius.lg, backgroundColor: colors.brand,
    alignItems: 'center', ...shadow.card,
  },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 44, fontWeight: '900', color: '#fff', marginTop: 4 },
  summaryClass: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 2 },
  summarySub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
  semCard: {
    marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  semHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  semLabelInput: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text, padding: 0 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  courseInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.text,
  },
  codeInput: { flex: 1.3 },
  cuInput: { width: 44, textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: 4 },
  gradeChip: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  gradeChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  gradeChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  gradeChipTextOn: { fontSize: 12, fontWeight: '800', color: '#fff' },
  addCourseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  addCourseText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  semFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  semGpa: { fontSize: 15, fontWeight: '800', color: colors.text },
  semDetail: { fontSize: 12, color: colors.muted },
  addSemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 20, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, borderStyle: 'dashed',
  },
  addSemText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  footnote: { fontSize: 11, color: colors.muted, textAlign: 'center', paddingHorizontal: 30 },
});
