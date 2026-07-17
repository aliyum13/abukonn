import { useState } from 'react';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { useAuth } from '../src/context/AuthContext';
import { colors, radius, shadow } from '../src/theme';

// Must match the backend whitelist exactly, or the ticket is rejected.
const CATEGORIES = ['Bug Report', 'Feature Request', 'Account Issue', 'Content Report', 'Other'];

export default function Support() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { user } = useAuth();

  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!category || !subject.trim() || !message.trim()) {
      setError('Please choose a category and fill in both fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          email: user?.email,
          full_name: user?.full_name,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={s.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Support</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={s.doneWrap}>
          <Text style={s.doneCheck}>✓</Text>
          <Text style={s.doneTitle}>Ticket submitted</Text>
          <Text style={s.doneText}>
            Thanks — we've received your message and will get back to you by email.
          </Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Support & Feedback</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.intro}>
            Found a bug, have an idea, or need help? Send us a message.
          </Text>

          <View style={s.card}>
            <Text style={s.label}>Category</Text>
            <View style={s.chips}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.chip, category === c ? s.chipOn : null]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={category === c ? s.chipTextOn : s.chipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Subject</Text>
            <TextInput
              style={s.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of your issue"
              placeholderTextColor={colors.muted}
            />

            <Text style={s.label}>Message</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what's going on..."
              placeholderTextColor={colors.muted}
              multiline
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={s.submitText}>Submit ticket</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  intro: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.card, padding: 16,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextOn: { fontSize: 13, color: colors.white, fontWeight: '700' },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  submitBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  doneCheck: {
    fontSize: 34, color: colors.white, fontWeight: '800',
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand,
    textAlign: 'center', lineHeight: 72, overflow: 'hidden',
  },
  doneTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 20 },
  doneText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  doneBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 40, marginTop: 24 },
  doneBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
