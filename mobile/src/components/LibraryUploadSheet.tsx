import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { radius } from '../theme';
import { DEPARTMENT_GROUPS, LEVELS } from '../lib/departments';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, formatBytes, validateFileSize } from '../lib/libraryFile';
import { pickLibraryFile, uploadLibraryMaterial, UploadCancelled, type PickedFile } from '../lib/libraryUpload';

// Same material types as the web form (and the only ones the library has).
const TYPES = [
  { key: 'past_question', label: 'Past Question' },
  { key: 'lecture_note', label: 'Lecture Note' },
  { key: 'textbook', label: 'Textbook' },
  { key: 'other', label: 'Other' },
];

// The upload form for Library Contributors and admins. Mirrors web's
// LibraryUploadForm: same fields, same limits, and it posts to the same endpoint
// (see lib/libraryUpload.ts), so the server's rules and error messages apply
// unchanged. Only offered to users /api/library/permissions says may upload; the
// endpoint is what actually enforces it.
export function LibraryUploadSheet({
  visible, onClose, onUploaded,
}: {
  visible: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const s = useThemedStyles(make_s);
  const { palette } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('past_question');
  const [dept, setDept] = useState('');
  const [level, setLevel] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [deptOpen, setDeptOpen] = useState(false);

  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Faculty is implied by the department; derive it so the material is
  // filterable by faculty (same as web's form).
  const facultyFor = (d: string) => DEPARTMENT_GROUPS.find(g => g.departments.includes(d))?.faculty ?? '';

  const reset = () => {
    setTitle(''); setDescription(''); setType('past_question'); setDept(''); setLevel('');
    setCourseCode(''); setCourseTitle(''); setFile(null); setDeptOpen(false);
    setError(''); setProgress(0);
  };

  const chooseFile = async () => {
    setError('');
    try {
      const picked = await pickLibraryFile();
      if (!picked) return;
      const tooBig = validateFileSize(picked.size);
      if (tooBig) { setFile(null); setError(tooBig); return; }
      setFile(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the file picker.');
    }
  };

  const submit = async () => {
    if (!title.trim() || !file) { setError('Title, type and file are required'); return; }
    const tooBig = validateFileSize(file.size);
    if (tooBig) { setError(tooBig); return; }

    setError('');
    setProgress(0);
    setUploading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await uploadLibraryMaterial(
        file,
        {
          title: title.trim(),
          description,
          type,
          faculty: facultyFor(dept),
          department: dept,
          level,
          course_code: courseCode,
          course_title: courseTitle,
        },
        setProgress,
        controller.signal,
      );
      reset();
      onUploaded();
    } catch (err) {
      if (!(err instanceof UploadCancelled)) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      abortRef.current = null;
      setUploading(false);
    }
  };

  const close = () => { if (!uploading) onClose(); };
  const percent = Math.round(progress * 100);
  // Once every byte has been sent the server still has to store the file, so say
  // so instead of leaving a full bar that looks stuck.
  const processing = uploading && progress >= 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Upload material</Text>
            <TouchableOpacity onPress={close} disabled={uploading} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={uploading ? palette.muted : palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

            <Text style={s.label}>Title *</Text>
            <TextInput
              style={s.input} value={title} onChangeText={setTitle} editable={!uploading}
              placeholder="e.g. CSC 301 Past Questions 2023" placeholderTextColor={palette.muted}
            />

            <Text style={s.label}>Type *</Text>
            <View style={s.chips}>
              {TYPES.map(t => (
                <TouchableOpacity key={t.key} disabled={uploading} onPress={() => setType(t.key)}
                  style={[s.chip, type === t.key ? s.chipOn : null]}>
                  <Text style={type === t.key ? s.chipTextOn : s.chipText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Department</Text>
            <TouchableOpacity style={s.select} disabled={uploading} onPress={() => setDeptOpen(o => !o)}>
              <Text style={dept ? s.selectText : s.selectPlaceholder} numberOfLines={1}>{dept || 'Select department'}</Text>
              <Ionicons name={deptOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
            </TouchableOpacity>
            {deptOpen ? (
              <ScrollView style={s.deptList} nestedScrollEnabled>
                <TouchableOpacity style={s.deptRow} onPress={() => { setDept(''); setDeptOpen(false); }}>
                  <Text style={s.deptNone}>None</Text>
                </TouchableOpacity>
                {DEPARTMENT_GROUPS.map(g => (
                  <View key={g.faculty}>
                    <Text style={s.deptFaculty}>{g.faculty}</Text>
                    {g.departments.map(d => (
                      <TouchableOpacity key={d} style={s.deptRow} onPress={() => { setDept(d); setDeptOpen(false); }}>
                        <Text style={[s.deptName, dept === d ? s.deptNameOn : null]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Text style={s.label}>Level</Text>
            <View style={s.chips}>
              {LEVELS.map(l => (
                <TouchableOpacity key={l} disabled={uploading} onPress={() => setLevel(level === l ? '' : l)}
                  style={[s.chip, level === l ? s.chipOn : null]}>
                  <Text style={level === l ? s.chipTextOn : s.chipText}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Course Code</Text>
            <TextInput
              style={s.input} value={courseCode} onChangeText={setCourseCode} editable={!uploading}
              placeholder="e.g. CSC 301" placeholderTextColor={palette.muted} autoCapitalize="characters"
            />
            <Text style={s.label}>Course Title</Text>
            <TextInput
              style={s.input} value={courseTitle} onChangeText={setCourseTitle} editable={!uploading}
              placeholder="e.g. Data Structures" placeholderTextColor={palette.muted}
            />
            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.multiline]} value={description} onChangeText={setDescription} editable={!uploading}
              placeholder="Brief description of the material..." placeholderTextColor={palette.muted} multiline
            />

            <Text style={s.label}>File * (max {MAX_FILE_SIZE / (1024 * 1024)}MB)</Text>
            {file ? (
              <View style={s.fileRow}>
                <Ionicons name="document-text-outline" size={22} color={palette.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                  {file.size ? <Text style={s.fileSize}>{formatBytes(file.size)}</Text> : null}
                </View>
                {!uploading ? (
                  <TouchableOpacity onPress={() => { setFile(null); setError(''); }} hitSlop={10} accessibilityLabel="Remove file">
                    <Ionicons name="close-circle" size={22} color={palette.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity style={s.pickBtn} onPress={chooseFile}>
                <Ionicons name="cloud-upload-outline" size={26} color={palette.muted} />
                <Text style={s.pickTitle}>Choose file</Text>
                <Text style={s.pickHint}>{ALLOWED_EXTENSIONS.map(e => e.toUpperCase()).join(', ')}</Text>
              </TouchableOpacity>
            )}

            {uploading ? (
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${percent}%` }]} />
                </View>
                <View style={s.progressRow}>
                  {processing ? <ActivityIndicator size="small" color={palette.brand} /> : null}
                  <Text style={s.progressText}>{processing ? 'Processing…' : `Uploading… ${percent}%`}</Text>
                </View>
                <TouchableOpacity onPress={() => abortRef.current?.abort()} hitSlop={8}>
                  <Text style={s.cancelText}>Cancel upload</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.submit, (!title.trim() || !file) ? s.submitDisabled : null]}
                disabled={!title.trim() || !file}
                onPress={submit}
              >
                <Text style={s.submitText}>Upload Material</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, backgroundColor: colors.surface,
  },
  selectText: { flex: 1, fontSize: 15, color: colors.text },
  selectPlaceholder: { flex: 1, fontSize: 15, color: colors.muted },
  deptList: {
    maxHeight: 260, marginTop: 6, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
  },
  deptFaculty: {
    fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
  },
  deptRow: { paddingHorizontal: 14, paddingVertical: 10 },
  deptName: { fontSize: 14, color: colors.text },
  deptNameOn: { color: colors.brand, fontWeight: '700' },
  deptNone: { fontSize: 14, color: colors.muted },
  pickBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 22,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md,
  },
  pickTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pickHint: { fontSize: 12, color: colors.muted },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderWidth: 1, borderColor: colors.brand, borderRadius: radius.md, backgroundColor: colors.brand100,
  },
  fileName: { fontSize: 14, fontWeight: '700', color: colors.text },
  fileSize: { fontSize: 12, color: colors.muted, marginTop: 1 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 12 },
  errorText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  progressWrap: { marginTop: 20, gap: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: colors.brand },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  submit: { marginTop: 20, backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
