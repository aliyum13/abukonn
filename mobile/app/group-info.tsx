import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../src/lib/api';
import { useAuth } from '../src/context/AuthContext';
import { colors, radius } from '../src/theme';

interface Member {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string | null;
  role: string;
}
interface Pending {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string | null;
}

export default function GroupInfo() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [myRole, setMyRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);

  const isAdmin = myRole === 'admin';

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        members: Member[]; pending: Pending[]; my_role: string;
        group?: { name: string; description: string | null; require_approval?: boolean; only_admins_can_add?: boolean; invite_enabled?: boolean; is_public?: boolean };
      }>(`/api/groups/${id}/messages`);
      setMembers(data.members || []);
      setPending(data.pending || []);
      setMyRole(data.my_role || 'member');
      if (data.group) {
        setSettings({
          name: data.group.name,
          description: data.group.description || '',
          require_approval: !!data.group.require_approval,
          only_admins_can_add: !!data.group.only_admins_can_add,
          invite_enabled: data.group.invite_enabled !== false,
        });
      }
    } catch {
      // keep what we have
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ name: '', description: '', require_approval: false, only_admins_can_add: false, invite_enabled: true });
  const [savingSettings, setSavingSettings] = useState(false);

  const saveSettings = async () => {
    if (!settings.name.trim()) { Alert.alert('Group name is required'); return; }
    setSavingSettings(true);
    try {
      await apiFetch(`/api/groups/${id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: settings.name.trim(),
          description: settings.description.trim(),
          require_approval: settings.require_approval,
          only_admins_can_add: settings.only_admins_can_add,
          invite_enabled: settings.invite_enabled,
        }),
      });
      setSettingsOpen(false);
      load();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : '');
    } finally {
      setSavingSettings(false);
    }
  };

  const deleteGroup = () => {
    Alert.alert('Delete group', 'This permanently deletes the group and all its messages. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
            router.replace('/groups');
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  const [followers, setFollowers] = useState<{ id: number; full_name: string; profile_photo_url: string | null }[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const openAddMembers = async () => {
    setAddOpen(true);
    setAddedIds(new Set());
    try {
      const d = await apiFetch<{ following: { id: number; full_name: string; profile_photo_url: string | null }[] }>('/api/follows/following');
      setFollowers(d.following || []);
    } catch {
      setFollowers([]);
    }
  };

  const addMember = async (person: { id: number }) => {
    if (addingId !== null) return;
    setAddingId(person.id);
    try {
      await apiFetch(`/api/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ user_id: person.id }) });
      setAddedIds(prev => new Set([...prev, person.id]));
      load(); // refresh member list
    } catch (err) {
      Alert.alert('Could not add', err instanceof Error ? err.message : '');
    } finally {
      setAddingId(null);
    }
  };

  const approve = async (userId: number) => {
    setPending(prev => prev.filter(p => p.id !== userId));
    try {
      await apiFetch(`/api/groups/${id}/members/${userId}/approve`, { method: 'PATCH' });
      load();
    } catch { load(); }
  };

  const reject = async (userId: number) => {
    setPending(prev => prev.filter(p => p.id !== userId));
    try {
      await apiFetch(`/api/groups/${id}/members/${userId}/reject`, { method: 'PATCH' });
    } catch { load(); }
  };

  const removeMember = (userId: number, memberName: string) => {
    Alert.alert('Remove member', `Remove ${memberName} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setMembers(prev => prev.filter(m => m.id !== userId));
          try {
            await apiFetch(`/api/groups/${id}/members/${userId}`, { method: 'DELETE' });
          } catch { load(); }
        },
      },
    ]);
  };

  const setMemberRole = async (userId: number, role: 'admin' | 'member') => {
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
    try {
      await apiFetch(`/api/groups/${id}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    } catch (err) {
      load(); // revert to server truth (e.g. can't demote the last admin)
      Alert.alert('Could not change role', err instanceof Error ? err.message : '');
    }
  };

  const openMemberMenu = (m: Member) => {
    const isMemberAdmin = m.role === 'admin';
    Alert.alert(m.full_name, undefined, [
      isMemberAdmin
        ? { text: 'Demote to member', onPress: () => setMemberRole(m.id, 'member') }
        : { text: 'Promote to admin', onPress: () => setMemberRole(m.id, 'admin') },
      { text: 'Remove from group', style: 'destructive', onPress: () => removeMember(m.id, m.full_name) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const leaveGroup = () => {
    Alert.alert('Leave group', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/groups/${id}/leave`, { method: 'DELETE' });
            router.replace('/groups');
          } catch (err) {
            Alert.alert('Could not leave', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ width: 60 }}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{name || 'Group'}</Text>
        {isAdmin ? (
          <View style={{ flexDirection: 'row', gap: 16, width: 60, justifyContent: 'flex-end' }}>
            <TouchableOpacity onPress={openAddMembers} hitSlop={10}>
              <Ionicons name="person-add-outline" size={21} color={colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsOpen(true)} hitSlop={10}>
              <Ionicons name="settings-outline" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={m => String(m.id)}
          ListHeaderComponent={
            isAdmin && pending.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Pending requests ({pending.length})</Text>
                {pending.map(p => (
                  <View key={p.id} style={s.row}>
                    <View style={s.person}>
                      {p.profile_photo_url ? (
                        <Image source={{ uri: p.profile_photo_url }} style={s.avatar} />
                      ) : (
                        <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{p.full_name.charAt(0).toUpperCase()}</Text></View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{p.full_name}</Text>
                        {p.department ? <Text style={s.muted}>{p.department}</Text> : null}
                      </View>
                    </View>
                    <View style={s.pendingActions}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => approve(p.id)}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => reject(p.id)}>
                        <Ionicons name="close" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <Text style={[s.sectionTitle, { marginTop: 20 }]}>Members ({members.length})</Text>
              </View>
            ) : (
              <Text style={[s.sectionTitle, { margin: 16 }]}>Members ({members.length})</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <TouchableOpacity
                style={s.person}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.id) } })}
              >
                {item.profile_photo_url ? (
                  <Image source={{ uri: item.profile_photo_url }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{item.full_name.charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  {item.department ? <Text style={s.muted}>{item.department}</Text> : null}
                </View>
              </TouchableOpacity>
              <View style={s.memberRight}>
                {item.role === 'admin' ? (
                  <View style={s.adminBadge}><Text style={s.adminText}>Admin</Text></View>
                ) : null}
                {isAdmin && item.id !== user?.id ? (
                  <TouchableOpacity onPress={() => openMemberMenu(item)} hitSlop={8}>
                    <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity style={s.leaveBtn} onPress={leaveGroup}>
              <Ionicons name="exit-outline" size={18} color={colors.danger} />
              <Text style={s.leaveText}>Leave group</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Add members sheet */}
      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={s.addBackdrop}>
          <View style={s.addSheet}>
            <View style={s.addHeader}>
              <Text style={s.addTitle}>Add members</Text>
              <TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={12}><Text style={s.addClose}>✕</Text></TouchableOpacity>
            </View>
            <FlatList
              data={followers.filter(f => !members.some(m => m.id === f.id))}
              keyExtractor={f => String(f.id)}
              style={{ maxHeight: 380 }}
              ListEmptyComponent={<Text style={s.addEmpty}>No one to add — people you follow who aren&apos;t already in the group appear here.</Text>}
              renderItem={({ item }) => {
                const done = addedIds.has(item.id);
                return (
                  <View style={s.addRow}>
                    {item.profile_photo_url ? (
                      <Image source={{ uri: item.profile_photo_url }} style={s.addAvatar} />
                    ) : (
                      <View style={[s.addAvatar, s.fallback]}><Text style={s.letter}>{item.full_name.charAt(0).toUpperCase()}</Text></View>
                    )}
                    <Text style={s.addName} numberOfLines={1}>{item.full_name}</Text>
                    <TouchableOpacity
                      style={[s.addBtn, done ? s.addBtnDone : null]}
                      onPress={() => addMember(item)}
                      disabled={done || addingId === item.id}
                    >
                      {addingId === item.id
                        ? <ActivityIndicator size="small" />
                        : <Text style={done ? s.addBtnDoneText : s.addBtnText}>{done ? 'Added' : 'Add'}</Text>}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Group settings sheet (admin) */}
      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={s.addBackdrop}>
          <View style={s.addSheet}>
            <View style={s.addHeader}>
              <Text style={s.addTitle}>Group settings</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)} hitSlop={12}><Text style={s.addClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput
                style={s.field}
                value={settings.name}
                onChangeText={t => setSettings(p => ({ ...p, name: t }))}
                placeholder="Group name"
                placeholderTextColor={colors.muted}
              />
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.field, { height: 80, textAlignVertical: 'top' }]}
                value={settings.description}
                onChangeText={t => setSettings(p => ({ ...p, description: t }))}
                placeholder="What's this group about?"
                placeholderTextColor={colors.muted}
                multiline
              />
              {([
                { key: 'require_approval', label: 'Require approval to join' },
                { key: 'only_admins_can_add', label: 'Only admins can add members' },
                { key: 'invite_enabled', label: 'Invite link enabled' },
              ] as const).map(row => (
                <TouchableOpacity
                  key={row.key}
                  style={s.toggleRow}
                  onPress={() => setSettings(p => ({ ...p, [row.key]: !p[row.key] }))}
                >
                  <Text style={s.toggleLabel}>{row.label}</Text>
                  <View style={[s.toggle, settings[row.key] ? s.toggleOn : null]}>
                    <View style={[s.knob, settings[row.key] ? s.knobOn : null]} />
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.saveBtn, savingSettings ? { opacity: 0.6 } : null]} onPress={saveSettings} disabled={savingSettings}>
                <Text style={s.saveText}>{savingSettings ? 'Saving…' : 'Save changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={deleteGroup}>
                <Text style={s.deleteText}>Delete group</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  center: { paddingVertical: 48, alignItems: 'center' },
  section: {},
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  muted: { fontSize: 13, color: colors.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 18, fontWeight: '800', color: colors.brand },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  memberRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminBadge: { backgroundColor: colors.brand100, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 },
  adminText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: colors.brand, borderRadius: radius.full, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.full, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  addBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  addSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  addHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  addClose: { fontSize: 20, color: colors.muted },
  addEmpty: { textAlign: 'center', color: colors.muted, marginTop: 24, fontSize: 14, paddingHorizontal: 20 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  addAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand100 },
  addName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  addBtn: { borderWidth: 1, borderColor: colors.brand, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  addBtnText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  addBtnDone: { borderColor: colors.border },
  addBtnDoneText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 12, marginBottom: 4 },
  field: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  toggleLabel: { fontSize: 15, color: colors.text, flex: 1 },
  toggle: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.brand },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  saveBtn: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  deleteBtn: { paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, marginTop: 24, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, paddingVertical: 13,
  },
  leaveText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
