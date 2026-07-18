import { useEffect, useState, useCallback } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { friendlyPreview } from '../../src/lib/messagePreview';
import { colors, radius, shadow } from '../../src/theme';

interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_photo: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function Messages() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>('/api/messages/conversations');
      setConvos(data.conversations || []);
    } catch {
      setConvos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}><Text style={s.title}>Messages</Text></View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={c => String(c.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No conversations yet</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => router.push({
                pathname: '/chat/[id]',
                params: { id: String(item.id), name: item.other_user_name },
              })}
            >
              {item.other_user_photo ? (
                <Image source={{ uri: item.other_user_photo }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.fallback]}>
                  <Text style={s.letter}>{item.other_user_name?.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <Text style={s.name}>{item.other_user_name}</Text>
                  <Text style={s.muted}>{timeAgo(item.last_message_at)}</Text>
                </View>
                <Text style={s.preview} numberOfLines={1}>
                  {friendlyPreview(item.last_message)}
                </Text>
              </View>
              {item.unread_count > 0 ? (
                <View style={s.badge}><Text style={s.badgeText}>{item.unread_count}</Text></View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted: { color: colors.muted, fontSize: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 17 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  preview: { fontSize: 14, color: colors.muted, marginTop: 2 },
  badge: { backgroundColor: colors.brand, borderRadius: 11, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
