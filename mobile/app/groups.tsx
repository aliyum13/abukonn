import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { colors, radius, shadow } from '../src/theme';

interface Group {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  require_approval?: boolean;
  my_status?: string | null; // 'active' | 'pending' | null (discover only)
}

export default function Groups() {
  const router = useRouter();
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [mine, setMine] = useState<Group[]>([]);
  const [discover, setDiscover] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);

  const load = useCallback(async (t: 'mine' | 'discover') => {
    setLoading(true);
    try {
      if (t === 'mine') {
        const d = await apiFetch<{ groups: Group[] }>('/api/groups');
        setMine(d.groups || []);
      } else {
        const d = await apiFetch<{ groups: Group[] }>('/api/groups/discover');
        setDiscover(d.groups || []);
      }
    } catch {
      if (t === 'mine') setMine([]); else setDiscover([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const join = async (g: Group) => {
    setJoining(g.id);
    try {
      await apiFetch(`/api/groups/${g.id}/join`, { method: 'POST' });
      // require_approval groups go to 'pending'; open groups become 'active'.
      const status = g.require_approval ? 'pending' : 'active';
      setDiscover(prev => prev.map(x => x.id === g.id ? { ...x, my_status: status } : x));
      if (status === 'active') {
        router.push({ pathname: '/group/[id]', params: { id: String(g.id), name: g.name } });
      } else {
        Alert.alert('Request sent', 'The group admins will review your request.');
      }
    } catch (err) {
      Alert.alert('Could not join', err instanceof Error ? err.message : '');
    } finally {
      setJoining(null);
    }
  };

  const data = tab === 'mine' ? mine : discover;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Groups</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'mine' ? s.tabOn : null]}
          onPress={() => setTab('mine')}
        >
          <Text style={tab === 'mine' ? s.tabTextOn : s.tabText}>My Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'discover' ? s.tabOn : null]}
          onPress={() => setTab('discover')}
        >
          <Text style={tab === 'discover' ? s.tabTextOn : s.tabText}>Discover</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={g => String(g.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(tab); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>
                {tab === 'mine' ? 'You have no groups yet' : 'No public groups found'}
              </Text>
              {tab === 'mine' ? (
                <Text style={s.mutedSmall}>Find one in Discover</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const isMember = tab === 'mine' || item.my_status === 'active';
            const isPending = item.my_status === 'pending';
            return (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => {
                  if (isMember) {
                    router.push({ pathname: '/group/[id]', params: { id: String(item.id), name: item.name } });
                  }
                }}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}>
                    <Text style={s.letter}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  {item.description ? (
                    <Text style={s.desc} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <Text style={s.meta}>{item.member_count} members</Text>
                </View>

                {tab === 'discover' && !isMember ? (
                  isPending ? (
                    <View style={[s.joinBtn, s.pendingBtn]}>
                      <Text style={s.pendingText}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.joinBtn}
                      onPress={() => join(item)}
                      disabled={joining === item.id}
                    >
                      {joining === item.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.joinText}>{item.require_approval ? 'Request' : 'Join'}</Text>}
                    </TouchableOpacity>
                  )
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  tabTextOn: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  muted: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  mutedSmall: { color: colors.muted, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  avatar: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 20 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  desc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  joinBtn: {
    backgroundColor: colors.brand, borderRadius: 18, paddingHorizontal: 16,
    paddingVertical: 8, minWidth: 74, alignItems: 'center',
  },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingBtn: { backgroundColor: '#f3f4f6' },
  pendingText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
