import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  Image, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { colors } from '../../src/theme';

interface Actor {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
}

// The backend groups notifications, so one row can mean "Ali and 2 others liked
// your post" rather than three separate lines.
interface Grouped {
  id: string;
  notification_ids: number[];
  type: string;
  post_id: number | null;
  actors: Actor[];
  actor_count: number;
  is_read: boolean;
  latest_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function describe(n: Grouped): string {
  const first = n.actors[0]?.full_name ?? 'Someone';
  const others = n.actor_count - 1;
  const who = others > 0
    ? `${first} and ${others} other${others > 1 ? 's' : ''}`
    : first;

  switch (n.type) {
    case 'like': return `${who} liked your post`;
    case 'comment': return `${who} commented on your post`;
    case 'follow': return `${who} started following you`;
    case 'mention': return `${who} mentioned you`;
    case 'new_post': return `${who} shared a new post`;
    case 'new_event': return `${who} created an event`;
    case 'new_story': return `${who} added to their story`;
    case 'connect_request': return `${who} sent you a connection request`;
    case 'connect_accepted': return `${who} accepted your connection request`;
    default: return `${who} interacted with you`;
  }
}

const ICON: Record<string, string> = {
  like: '♥',
  comment: '💬',
  follow: '👤',
  mention: '@',
  new_post: '📝',
  new_event: '📅',
  new_story: '📸',
};

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Grouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: Grouped[] }>('/api/notifications');
      setItems(data.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    // Optimistic — this is cosmetic, so don't make the user wait on the network.
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    } catch {
      load(); // put the truth back if it failed
    }
  };

  const openOne = async (n: Grouped) => {
    if (n.is_read) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    try {
      await apiFetch('/api/notifications/read-many', {
        method: 'PATCH',
        body: JSON.stringify({ ids: n.notification_ids }),
      });
    } catch {
      load();
    }
  };

  const unread = items.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={s.readAll}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>Nothing yet</Text>
              <Text style={s.mutedSmall}>Likes, comments and follows will show up here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const actor = item.actors[0];
            return (
              <TouchableOpacity
                style={[s.row, !item.is_read ? s.unreadRow : null]}
                onPress={() => openOne(item)}
                activeOpacity={0.7}
              >
                <TouchableOpacity
                  onPress={() => actor && router.push({
                    pathname: '/user/[id]', params: { id: String(actor.id) },
                  })}
                >
                  {actor?.profile_photo_url ? (
                    <Image source={{ uri: actor.profile_photo_url }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.fallback]}>
                      <Text style={s.letter}>
                        {actor?.full_name?.charAt(0).toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={s.text}>
                    <Text style={s.icon}>{ICON[item.type] ?? '•'}  </Text>
                    {describe(item)}
                  </Text>
                  <Text style={s.time}>{timeAgo(item.latest_at)}</Text>
                </View>

                {!item.is_read ? <View style={s.dot} /> : null}
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
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  readAll: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  muted: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  mutedSmall: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  unreadRow: { backgroundColor: '#f0fdf4' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 16 },
  icon: { fontSize: 13 },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  time: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand },
});
