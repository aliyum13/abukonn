import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../src/lib/api';
import { colors, radius } from '../src/theme';

interface Request {
  id: number; sender_id: number; sender_name: string;
  sender_department: string | null; sender_photo: string | null;
}
interface Connection {
  id: number; full_name: string; department: string | null;
  level: string | null; profile_photo_url: string | null;
}

export default function Connect() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [tab, setTab] = useState<'requests' | 'connections'>('requests');
  const [requests, setRequests] = useState<Request[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, conns] = await Promise.all([
        apiFetch<{ requests: Request[] }>('/api/connect/requests/incoming'),
        apiFetch<{ connections: Connection[] }>('/api/connect/connections'),
      ]);
      setRequests(inc.requests || []);
      setConnections(conns.connections || []);
    } catch {
      setRequests([]); setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accept = async (req: Request) => {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      await apiFetch(`/api/connect/${req.id}/accept`, { method: 'PATCH' });
      load();
    } catch { load(); }
  };
  const decline = async (req: Request) => {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      await apiFetch(`/api/connect/${req.id}/decline`, { method: 'PATCH' });
    } catch { load(); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ width: 60 }}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Connections</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.tabBar}>
        {(['requests', 'connections'] as const).map(t => (
          <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)}>
            <Text style={tab === t ? s.tabOn : s.tabOff}>
              {t === 'requests' ? `Requests${requests.length ? ` (${requests.length})` : ''}` : 'Connections'}
            </Text>
            {tab === t ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={r => String(r.id)}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No pending requests</Text></View>}
          renderItem={({ item }) => (
            <View style={s.row}>
              <TouchableOpacity style={s.person} onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.sender_id) } })}>
                {item.sender_photo ? (
                  <Image source={{ uri: item.sender_photo }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{item.sender_name.charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.sender_name}</Text>
                  {item.sender_department ? <Text style={s.muted}>{item.sender_department}</Text> : null}
                </View>
              </TouchableOpacity>
              <View style={s.reqActions}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => accept(item)}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => decline(item)}>
                  <Ionicons name="close" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={c => String(c.id)}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No connections yet</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.id) } })}>
              {item.profile_photo_url ? (
                <Image source={{ uri: item.profile_photo_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{item.full_name.charAt(0).toUpperCase()}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.full_name}</Text>
                {item.department ? <Text style={s.muted}>{item.department}{item.level ? ` · ${item.level}` : ''}</Text> : null}
              </View>
              <Ionicons name="people" size={20} color={colors.brand} />
            </TouchableOpacity>
          )}
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
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabOn: { fontSize: 14, fontWeight: '800', color: colors.text },
  tabOff: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2.5, width: 40, borderRadius: 2, backgroundColor: colors.brand },
  center: { paddingVertical: 48, alignItems: 'center' },
  muted: { fontSize: 13, color: colors.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 20, fontWeight: '800', color: colors.brand },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  reqActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: colors.brand, borderRadius: 999, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 999, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
