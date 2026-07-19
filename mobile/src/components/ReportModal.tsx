import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { apiFetch } from '../lib/api';

// Same reasons and labels as web's ReportModal.
const REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'misinformation', label: 'False information' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];

export interface ReportTarget { type: 'post' | 'user'; id: number; name: string }

export function ReportModal({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const s = useThemedStyles(make_s);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setReason(''); setDetails(''); setSubmitting(false); };

  const submit = async () => {
    if (!target || !reason) return;
    setSubmitting(true);
    try {
      const endpoint = target.type === 'post'
        ? `/api/moderation/report/post/${target.id}`
        : `/api/moderation/report/user/${target.id}`;
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      reset();
      onClose();
      Alert.alert('Thanks', 'Your report has been submitted.');
    } catch (err) {
      const m = err instanceof Error ? err.message : '';
      Alert.alert(m.includes('already') ? 'Already reported' : 'Could not report', m);
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={target !== null} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>{target?.type === 'post' ? 'Report post' : `Report ${target?.name ?? ''}`}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={12}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>

          {REASONS.map(r => (
            <TouchableOpacity key={r.value} style={s.reasonRow} onPress={() => setReason(r.value)}>
              <View style={[s.radio, reason === r.value ? s.radioOn : null]}>
                {reason === r.value ? <View style={s.radioDot} /> : null}
              </View>
              <Text style={s.reasonLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={s.details}
            placeholder="Add more details (optional)"
            value={details}
            onChangeText={setDetails}
            multiline
          />

          <TouchableOpacity style={[s.submit, !reason ? { opacity: 0.5 } : null]} onPress={submit} disabled={!reason || submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit report</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  close: { fontSize: 20, color: colors.muted },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.brand },
  reasonLabel: { fontSize: 15, color: colors.text },
  details: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
    fontSize: 15, color: colors.text, minHeight: 70, marginTop: 12, textAlignVertical: 'top',
  },
  submit: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
