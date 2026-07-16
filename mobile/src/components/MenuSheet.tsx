import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../lib/api';
import { colors } from '../theme';

// Mirrors the web logo menu: destinations that aren't in the bottom tab bar.
// Feed / News / Library / Profile are tabs; everything else lives here.
const LINKS: { path: string; label: string; icon: string; badge?: 'messages' | 'alerts' }[] = [
  { path: '/(tabs)/messages', label: 'Messages', icon: '💬', badge: 'messages' },
  { path: '/(tabs)/notifications', label: 'Notifications', icon: '🔔', badge: 'alerts' },
  { path: '/discover', label: 'Discover People', icon: '🧭' },
  { path: '/groups', label: 'Groups', icon: '👥' },
  { path: '/timetable', label: 'Timetable', icon: '🗓️' },
  // Added as their screens are built: Discover, Academic Calendar, Settings, Support.
];

export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [msgUnread, setMsgUnread] = useState(0);
  const [alertUnread, setAlertUnread] = useState(0);

  // Web shows unread counts next to these — match that. Fetched each time the
  // menu opens so the numbers are fresh without polling in the background.
  useEffect(() => {
    if (!visible) return;
    apiFetch<{ count: number }>('/api/messages/unread-count')
      .then(d => setMsgUnread(d.count || 0)).catch(() => {});
    apiFetch<{ count: number }>('/api/notifications/unread-count')
      .then(d => setAlertUnread(d.count || 0)).catch(() => {});
  }, [visible]);

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  const badgeFor = (b?: 'messages' | 'alerts') => {
    const n = b === 'messages' ? msgUnread : b === 'alerts' ? alertUnread : 0;
    if (!n) return null;
    return (
      <View style={s.badge}>
        <Text style={s.badgeText}>{n > 99 ? '99+' : n}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.handle} />
          <Text style={s.title}>Menu</Text>
          <ScrollView>
            {LINKS.map(l => (
              <TouchableOpacity key={l.path} style={s.row} onPress={() => go(l.path)}>
                <Text style={s.icon}>{l.icon}</Text>
                <Text style={s.label}>{l.label}</Text>
                {badgeFor(l.badge)}
                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10, maxHeight: '70%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { fontSize: 22 },
  label: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  arrow: { fontSize: 22, color: colors.muted },
  badge: {
    backgroundColor: colors.brand, borderRadius: 11, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
