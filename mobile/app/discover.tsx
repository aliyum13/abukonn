import { useEffect, useState, useCallback } from 'react';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import { RoleBadge } from '../src/components/RoleBadge';
import { colors, radius, shadow } from '../src/theme';

interface Person {
  id: number;
  full_name: string;
  username: string | null;
  department: string | null;
  level: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  is_verified?: boolean;
  is_content_creator?: boolean;
  is_admin?: boolean;
  role?: string;
  followers_count?: number;
  is_following?: boolean;
}

interface Section {
  key: string;
  title: string;
  people: Person[];
}

function PersonRow({ person, onOpen }: { person: Person; onOpen: (id: number) => void }) {
  const s = useThemedStyles(make_s);
  const [following, setFollowing] = useState(!!person.is_following);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const was = following;
    setBusy(true);
    setFollowing(!was); // optimistic
    try {
      await apiFetch(`/api/follows/${person.id}`, { method: was ? 'DELETE' : 'POST' });
    } catch {
      setFollowing(was);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => onOpen(person.id)}>
      {person.profile_photo_url ? (
        <Image source={{ uri: person.profile_photo_url }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.fallback]}>
          <Text style={s.letter}>{person.full_name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{person.full_name}</Text>
          <RoleBadge role={person.role || (person.is_admin ? 'admin' : person.is_verified ? 'verified' : 'user')} iconOnly />
          {person.is_content_creator ? <Text style={s.creatorIcon}>✎</Text> : null}
        </View>
        {person.department ? (
          <Text style={s.sub} numberOfLines={1}>
            {person.department}{person.level ? ` · ${person.level}` : ''}
          </Text>
        ) : person.bio ? (
          <Text style={s.sub} numberOfLines={1}>{person.bio}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[s.followBtn, following ? s.followingBtn : null]}
        onPress={toggle}
        disabled={busy}
      >
        <Text style={following ? s.followingText : s.followText}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function Discover() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  const [sections, setSections] = useState<Section[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [disc, foll] = await Promise.all([
        apiFetch<{ sections: Section[] }>('/api/follows/discover'),
        apiFetch<{ following: Person[] }>('/api/follows/following'),
      ]);
      setSections((disc.sections || []).filter(sec => sec.people?.length));
      setFollowing(foll.following || []);
    } catch {
      setSections([]);
      setFollowing([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced search across the whole directory.
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const d = await apiFetch<{ results: Person[] }>(
          `/api/follows/search?q=${encodeURIComponent(query.trim())}`);
        setResults(d.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const openProfile = (id: number) =>
    router.push({ pathname: '/user/[id]', params: { id: String(id) } });

  const searchMode = query.trim().length >= 2;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Discover People</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Search students by name..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {!searchMode ? (
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'discover' ? s.tabOn : null]}
            onPress={() => setTab('discover')}
          >
            <Text style={tab === 'discover' ? s.tabTextOn : s.tabText}>Discover</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'following' ? s.tabOn : null]}
            onPress={() => setTab('following')}
          >
            <Text style={tab === 'following' ? s.tabTextOn : s.tabText}>Following</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : searchMode ? (
        searching ? (
          <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={s.listPad}
            ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No one found</Text></View>}
            renderItem={({ item }) => (
              <View style={s.card}><PersonRow person={item} onOpen={openProfile} /></View>
            )}
          />
        )
      ) : tab === 'following' ? (
        <FlatList
          data={following}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={s.listPad}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>You're not following anyone yet</Text></View>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <PersonRow person={{ ...item, is_following: true }} onOpen={openProfile} />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={sec => sec.key}
          contentContainerStyle={s.listPad}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No suggestions yet</Text></View>}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 8 }}>
              <Text style={s.sectionTitle}>{item.title}</Text>
              <View style={s.card}>
                {item.people.map((p, i) => (
                  <View key={p.id} style={i > 0 ? s.divider : null}>
                    <PersonRow person={p} onOpen={openProfile} />
                  </View>
                ))}
              </View>
            </View>
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
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  search: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, color: colors.text,
  },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  tabTextOn: { color: colors.white, fontWeight: '700', fontSize: 14 },
  listPad: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted: { color: colors.muted, fontSize: 15 },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: colors.textSecondary,
    marginLeft: 4, marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  creatorIcon: { fontSize: 13, color: '#d97706', fontWeight: '800' },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  followBtn: {
    backgroundColor: colors.brand, borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 88, alignItems: 'center',
  },
  followingBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  followText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  followingText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
