import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../src/lib/api';
import { colors, radius } from '../src/theme';

interface SearchUser {
  id: number; full_name: string; department: string | null; level: string | null;
  profile_photo_url: string | null; is_following: boolean;
}
interface SearchPost {
  id: number; content: string; author_name: string; author_department: string | null;
  author_photo: string | null; user_id: number;
}
interface Hashtag { tag: string; post_count: number }

type Tab = 'students' | 'posts' | 'hashtags';

export default function Search() {
  const s = useThemedStyles(make_s);
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('students');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setUsers([]); setPosts([]); setHashtags([]); return; }
    setLoading(true);
    try {
      const [main, tags] = await Promise.all([
        apiFetch<{ users: SearchUser[]; posts: SearchPost[] }>(`/api/search?q=${encodeURIComponent(q)}&type=all`),
        apiFetch<{ hashtags: Hashtag[] }>(`/api/hashtags/search?q=${encodeURIComponent(q)}`).catch(() => ({ hashtags: [] })),
      ]);
      setUsers(main.users || []);
      setPosts(main.posts || []);
      setHashtags(tags.hashtags || []);
    } catch {
      setUsers([]); setPosts([]); setHashtags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(query), 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, runSearch]);

  const toggleFollow = async (id: number, following: boolean) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_following: !following } : u));
    try {
      await apiFetch(`/api/follows/${id}`, { method: following ? 'DELETE' : 'POST' });
    } catch {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_following: following } : u));
    }
  };

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'students', label: 'Students', count: users.length },
    { id: 'posts', label: 'Posts', count: posts.length },
    { id: 'hashtags', label: 'Hashtags', count: hashtags.length },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search students, posts, hashtags"
            placeholderTextColor={colors.muted}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={s.tab} onPress={() => setTab(t.id)}>
            <Text style={tab === t.id ? s.tabOn : s.tabOff}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
            {tab === t.id ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : !query.trim() ? (
        <View style={s.center}><Text style={s.muted}>Search for students, posts, or hashtags</Text></View>
      ) : tab === 'students' ? (
        <FlatList
          data={users}
          keyExtractor={u => String(u.id)}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No students found</Text></View>}
          renderItem={({ item }) => (
            <View style={s.row}>
              <TouchableOpacity style={s.person} onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.id) } })}>
                {item.profile_photo_url ? (
                  <Image source={{ uri: item.profile_photo_url }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{item.full_name.charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  {item.department ? <Text style={s.muted}>{item.department}{item.level ? ` · ${item.level}` : ''}</Text> : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.followBtn, item.is_following ? s.followingBtn : null]}
                onPress={() => toggleFollow(item.id, item.is_following)}
              >
                <Text style={item.is_following ? s.followingText : s.followText}>{item.is_following ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : tab === 'posts' ? (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No posts found</Text></View>}
          renderItem={({ item }) => (
            <View style={s.postRow}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.user_id) } })} style={s.postAuthor}>
                {item.author_photo ? (
                  <Image source={{ uri: item.author_photo }} style={s.smallAvatar} />
                ) : (
                  <View style={[s.smallAvatar, s.fallback]}><Text style={s.smallLetter}>{item.author_name.charAt(0).toUpperCase()}</Text></View>
                )}
                <Text style={s.postAuthorName}>{item.author_name}</Text>
              </TouchableOpacity>
              <Text style={s.postContent} numberOfLines={3}>{item.content}</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={hashtags}
          keyExtractor={h => h.tag}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No hashtags found</Text></View>}
          renderItem={({ item }) => (
            <View style={s.hashRow}>
              <Text style={s.hashTag}>#{item.tag}</Text>
              <Text style={s.muted}>{item.post_count} {item.post_count === 1 ? 'post' : 'posts'}</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bg, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabOn: { fontSize: 14, fontWeight: '800', color: colors.text },
  tabOff: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2.5, width: 40, borderRadius: 2, backgroundColor: colors.brand },
  center: { paddingVertical: 48, alignItems: 'center' },
  muted: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 20, fontWeight: '800', color: colors.brand },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  followBtn: { backgroundColor: colors.brand, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 16 },
  followingBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  postRow: { padding: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand100 },
  smallLetter: { fontSize: 12, fontWeight: '800', color: colors.brand },
  postAuthorName: { fontSize: 14, fontWeight: '700', color: colors.text },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 21 },
  hashRow: { padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  hashTag: { fontSize: 16, fontWeight: '700', color: colors.brand },
});
