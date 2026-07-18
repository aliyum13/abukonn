import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert,
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
        <View style={{ width: 60 }} />
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
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, marginTop: 24, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, paddingVertical: 13,
  },
  leaveText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
