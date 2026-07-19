import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList, ScrollView,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../src/lib/api';
import { PostContent } from '../src/components/PostContent';
import { colors, radius } from '../src/theme';

interface SearchUser {
  id: number; full_name: string; department: string | null; level: string | null;
  profile_photo_url: string | null; is_following: boolean;
}
interface SearchPost {
  id: number; content: string; author_name: string; author_department: string | null;
  author_photo: string | null; user_id: number;
  likes_count?: number; comments_count?: number; created_at?: string;
}
interface Hashtag { tag: string; post_count: number }

type Tab = 'all' | 'students' | 'posts' | 'hashtags' | 'trending';

export default function Search() {
  const s = useThemedStyles(make_s);
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [trending, setTrending] = useState<Hashtag[]>([]);
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

  // Trending hashtags load once and show regardless of the query, like web.
  useEffect(() => {
    apiFetch<{ hashtags: Hashtag[] }>('/api/hashtags/trending?limit=10')
      .then(d => setTrending(d.hashtags || []))
      .catch(() => setTrending([]));
  }, []);

  const toggleFollow = async (id: number, following: boolean) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_following: !following } : u));
    try {
      await apiFetch(`/api/follows/${id}`, { method: following ? 'DELETE' : 'POST' });
    } catch {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_following: following } : u));
    }
  };

  const renderHashtagRow = (item: Hashtag, index: number, list: Hashtag[]) => {
    const maxCount = Math.max(...list.map(h => h.post_count), 1);
    const hot = index < 3;
    return (
      <TouchableOpacity
        style={s.hashRow}
        onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: item.tag } })}
      >
        <View style={[s.hashIcon, hot ? s.hashIconHot : null]}>
          <Text style={s.hashIconText}>{hot ? '🔥' : '#'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.hashTagRow}>
            <Text style={s.hashTag}>#{item.tag}</Text>
            {hot ? <View style={s.hotBadge}><Text style={s.hotBadgeText}>Hot</Text></View> : null}
          </View>
          <View style={s.hashBarRow}>
            <View style={s.hashBarTrack}>
              <View style={[s.hashBarFill, { width: `${Math.max(6, (item.post_count / maxCount) * 100)}%` }]} />
            </View>
            <Text style={s.muted}>{item.post_count} {item.post_count === 1 ? 'post' : 'posts'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const TABS: { id: Tab; label: string; count: number | null }[] = [
    { id: 'all', label: 'All', count: null },
    { id: 'students', label: 'Students', count: users.length },
    { id: 'posts', label: 'Posts', count: posts.length },
    { id: 'hashtags', label: 'Hashtags', count: hashtags.length },
    { id: 'trending', label: '🔥 Trending', count: null },
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ alignItems: 'center' }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={s.tab} onPress={() => setTab(t.id)}>
            <Text style={tab === t.id ? s.tabOn : s.tabOff}>
              {t.label}{t.count != null && t.count > 0 ? ` (${t.count})` : ''}
            </Text>
            {tab === t.id ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : tab === 'trending' ? (
        <FlatList
          data={trending}
          keyExtractor={h => h.tag}
          ListHeaderComponent={<Text style={s.sectionHeader}>Trending on campus</Text>}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No trending hashtags yet</Text></View>}
          renderItem={({ item, index }) => renderHashtagRow(item, index, trending)}
        />
      ) : !query.trim() ? (
        <View style={s.center}><Text style={s.muted}>Search for students, posts, or hashtags</Text></View>
      ) : tab === 'all' ? (
        <ScrollView keyboardShouldPersistTaps="handled">
          {users.length === 0 && posts.length === 0 && hashtags.length === 0 ? (
            <View style={s.center}><Text style={s.muted}>No results found</Text></View>
          ) : null}
          {hashtags.length > 0 ? (
            <>
              <Text style={s.sectionHeader}>Hashtags ({hashtags.length})</Text>
              {hashtags.slice(0, 5).map((item, index) => renderHashtagRow(item, index, hashtags))}
            </>
          ) : null}
          {users.length > 0 ? (
            <>
              <Text style={s.sectionHeader}>Students ({users.length})</Text>
              {users.slice(0, 3).map(item => (
                <View key={`u${item.id}`} style={s.row}>
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
                  <TouchableOpacity style={item.is_following ? s.followingBtn : s.followBtn} onPress={() => toggleFollow(item.id, item.is_following)}>
                    <Text style={item.is_following ? s.followingText : s.followText}>{item.is_following ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}
          {posts.length > 0 ? (
            <>
              <Text style={s.sectionHeader}>Posts ({posts.length})</Text>
              {posts.slice(0, 3).map(item => (
                <View key={`p${item.id}`} style={s.postRow}>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.user_id) } })} style={s.postAuthor}>
                    {item.author_photo ? (
                      <Image source={{ uri: item.author_photo }} style={s.smallAvatar} />
                    ) : (
                      <View style={[s.smallAvatar, s.fallback]}><Text style={s.smallLetter}>{item.author_name.charAt(0).toUpperCase()}</Text></View>
                    )}
                    <Text style={s.postAuthorName}>{item.author_name}</Text>
                  </TouchableOpacity>
                  <PostContent content={item.content} style={s.postContent} numberOfLines={3} />
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
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
              <PostContent content={item.content} style={s.postContent} numberOfLines={3} />
              <View style={s.postStats}>
                <Text style={s.postStat}>♥ {item.likes_count ?? 0}</Text>
                <Text style={s.postStat}>💬 {item.comments_count ?? 0}</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={hashtags}
          keyExtractor={h => h.tag}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No hashtags found</Text></View>}
          renderItem={({ item, index }) => renderHashtagRow(item, index, hashtags)}
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
  tabBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
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
  postStats: { flexDirection: 'row', gap: 16, marginTop: 8 },
  postStat: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  hashRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  hashIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  hashIconHot: { backgroundColor: 'rgba(245,158,11,0.15)' },
  hashIconText: { fontSize: 20, fontWeight: '800', color: colors.brand },
  hashTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hashTag: { fontSize: 16, fontWeight: '700', color: colors.text },
  hotBadge: { backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  hotBadgeText: { fontSize: 10, fontWeight: '700', color: '#b45309' },
  hashBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  hashBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  hashBarFill: { height: '100%', borderRadius: 3, backgroundColor: 'rgba(22,163,74,0.55)' },
});
