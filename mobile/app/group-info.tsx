import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../src/lib/api';
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

  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [myRole, setMyRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);

  const isAdmin = myRole === 'admin';

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        members: Member[]; pending: Pending[]; my_role: string;
      }>(`/api/groups/${id}/messages`);
      setMembers(data.members || []);
      setPending(data.pending || []);
      setMyRole(data.my_role || 'member');
    } catch {
      // keep what we have
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const [addOpen, setAddOpen] = useState(false);
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
          <TouchableOpacity onPress={openAddMembers} hitSlop={12} style={{ width: 60, alignItems: 'flex-end' }}>
            <Ionicons name="person-add-outline" size={22} color={colors.brand} />
          </TouchableOpacity>
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
              {item.role === 'admin' ? (
                <View style={s.adminBadge}><Text style={s.adminText}>Admin</Text></View>
              ) : isAdmin ? (
                <TouchableOpacity onPress={() => removeMember(item.id, item.full_name)} hitSlop={8}>
                  <Ionicons name="remove-circle-outline" size={22} color={colors.danger} />
                </TouchableOpacity>
              ) : null}
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
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, marginTop: 24, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, paddingVertical: 13,
  },
  leaveText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
