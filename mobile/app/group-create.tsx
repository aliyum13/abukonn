import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Switch, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { colors, radius, shadow } from '../src/theme';

export default function CreateGroup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) { Alert.alert('Group name is required'); return; }
    setCreating(true);
    try {
      const res = await apiFetch<{ group: { id: number; name: string } }>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          is_public: isPublic,
          // Approval only makes sense for a public group others can find & request.
          require_approval: isPublic ? requireApproval : false,
        }),
      });
      // Straight into the new group's chat.
      router.replace({
        pathname: '/group/[id]',
        params: { id: String(res.group.id), name: res.group.name },
      });
    } catch (err) {
      Alert.alert('Could not create group', err instanceof Error ? err.message : '');
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>New Group</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.label}>Group name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. CSC 300 Study Group"
              placeholderTextColor={colors.muted}
              autoFocus
            />

            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this group about?"
              placeholderTextColor={colors.muted}
              multiline
            />
          </View>

          <Text style={s.sectionTitle}>Privacy</Text>
          <View style={s.card}>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Public</Text>
                <Text style={s.toggleHint}>
                  {isPublic ? 'Anyone can find this group in Discover' : 'Invite-only — hidden from Discover'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.brand, false: colors.faint }}
                thumbColor={colors.white}
              />
            </View>

            {isPublic ? (
              <View style={[s.toggleRow, s.divider]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>Require approval to join</Text>
                  <Text style={s.toggleHint}>
                    {requireApproval ? 'You approve each join request' : 'Anyone can join instantly'}
                  </Text>
                </View>
                <Switch
                  value={requireApproval}
                  onValueChange={setRequireApproval}
                  trackColor={{ true: colors.brand, false: colors.faint }}
                  thumbColor={colors.white}
                />
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={s.createBtn} onPress={create} disabled={creating}>
            {creating ? <ActivityIndicator color={colors.white} /> : <Text style={s.createText}>Create group</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: colors.textSecondary,
    marginBottom: 8, marginTop: 18, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.card, padding: 16,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  toggleHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  createBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: 22,
  },
  createText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
