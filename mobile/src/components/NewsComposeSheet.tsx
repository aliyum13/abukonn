import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { radius } from '../theme';
import { uploadImage } from '../lib/upload';
import { publishNews, publishErrorMessage } from '../lib/newsPublish';

// Mirrors the web admin News form: Title, Content, optional cover image. Only mounted
// for users GET /api/news/permissions said can publish; POST /api/news is what enforces it.
// Publishing pushes a notification to everyone and the app has no way to take an article
// back, so Publish asks once before sending.
const TITLE_MAX = 255; // news.title is VARCHAR(255)

export function NewsComposeSheet({
  visible, onClose, onPublished,
}: {
  visible: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const s = useThemedStyles(make_s);
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cover, setCover] = useState<{ uri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dirty = !!(title.trim() || content.trim() || cover);
  const canSubmit = !!title.trim() && !!content.trim() && !busy;

  const reset = () => { setTitle(''); setContent(''); setCover(null); setError(''); };

  const close = () => {
    if (busy) return;
    if (!dirty) { reset(); onClose(); return; }
    Alert.alert('Discard this post?', 'What you wrote will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { reset(); onClose(); } },
    ]);
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to add a cover image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setCover({ uri: result.assets[0].uri });
  };

  const publish = async () => {
    setError('');
    setBusy(true);
    try {
      // Image first: if it fails nothing has been published and the text is still here.
      const imageUrl = cover ? await uploadImage(cover.uri, 'abukonn/news') : null;
      await publishNews({ title: title.trim(), content: content.trim(), imageUrl });
      reset();
      onPublished();
    } catch (err) {
      setError(publishErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmPublish = () => {
    Alert.alert(
      'Publish to everyone?',
      "This sends a notification to everyone on ABUkonn. You can't take it back from the app.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', onPress: publish },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={close} disabled={busy} hitSlop={10}>
              <Text style={[s.cancel, busy ? { opacity: 0.4 } : null]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>New post</Text>
            <TouchableOpacity onPress={confirmPublish} disabled={!canSubmit} hitSlop={10} style={{ width: 64, alignItems: 'flex-end' }}>
              {busy
                ? <ActivityIndicator color={palette.brand} />
                : <Text style={[s.publish, !canSubmit ? { opacity: 0.4 } : null]}>Publish</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

            <Text style={s.label}>Title *</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              editable={!busy}
              maxLength={TITLE_MAX}
              placeholder="Headline"
              placeholderTextColor={palette.muted}
              selectionColor={palette.brand}
            />

            <Text style={s.label}>Content *</Text>
            <TextInput
              style={[s.input, s.contentInput]}
              value={content}
              onChangeText={setContent}
              editable={!busy}
              multiline
              placeholder="Write the article..."
              placeholderTextColor={palette.muted}
              selectionColor={palette.brand}
            />

            <Text style={s.label}>Cover image (optional)</Text>
            {cover ? (
              <View>
                <Image source={{ uri: cover.uri }} style={s.coverPreview} resizeMode="cover" />
                {!busy ? (
                  <TouchableOpacity style={s.removeCover} onPress={() => setCover(null)} hitSlop={8} accessibilityLabel="Remove cover image">
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity style={s.pickCover} onPress={pickCover} disabled={busy}>
                <Ionicons name="image-outline" size={24} color={palette.muted} />
                <Text style={s.pickCoverText}>Choose an image</Text>
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
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  publish: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  // Explicit text and background colours on every input: an input with no colour set
  // takes the platform default (near-black text), which is unreadable on the dark theme's
  // dark surface -- the same mistake the web News form's Content box had.
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
  contentInput: { minHeight: 180, textAlignVertical: 'top' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 12 },
  errorText: { color: '#b91c1c', fontSize: 14 },
  pickCover: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 22, alignItems: 'center', gap: 6, backgroundColor: colors.surface,
  },
  pickCoverText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  coverPreview: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle },
  removeCover: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
});
