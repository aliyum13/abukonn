import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator,
} from 'react-native';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { colors, radius } from '../../src/theme';

interface Person {
  id: number;
  full_name: string;
  username: string | null;
  department: string | null;
  level: string | null;
  profile_photo_url: string | null;
  is_following?: boolean;
}

export default function FollowsList() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { id, type, name } = useLocalSearchParams<{ id: string; type: string; name?: string }>();
  const isFollowers = type === 'followers';

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const endpoint = isFollowers
        ? `/api/follows/${id}/followers`
        : `/api/follows/${id}/following`;
      const data = await apiFetch<{ followers?: Person[]; following?: Person[] }>(endpoint);
      setPeople(data.followers || data.following || []);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [id, isFollowers]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async (personId: number, currentlyFollowing: boolean) => {
    setPeople(prev => prev.map(p => p.id === personId ? { ...p, is_following: !currentlyFollowing } : p));
    try {
      await apiFetch(`/api/follows/${personId}`, { method: currentlyFollowing ? 'DELETE' : 'POST' });
    } catch {
      setPeople(prev => prev.map(p => p.id === personId ? { ...p, is_following: currentlyFollowing } : p));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>{isFollowers ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={p => String(p.id)}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>
                {isFollowers ? 'No followers yet' : 'Not following anyone yet'}
              </Text>
            </View>
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
                  <View style={[s.avatar, s.fallback]}>
                    <Text style={s.letter}>{item.full_name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  {item.department ? (
                    <Text style={s.muted}>{item.department}{item.level ? ` · ${item.level}` : ''}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.followBtn, item.is_following ? s.followingBtn : null]}
                onPress={() => toggleFollow(item.id, !!item.is_following)}
              >
                <Text style={item.is_following ? s.followingText : s.followText}>
                  {item.is_following ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
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
  back: { width: 60 },
  backText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { paddingVertical: 48, alignItems: 'center' },
  muted: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 20, fontWeight: '800', color: colors.brand },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  followBtn: {
    backgroundColor: colors.brand, borderRadius: radius.full,
    paddingVertical: 7, paddingHorizontal: 16,
  },
  followingBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
});
