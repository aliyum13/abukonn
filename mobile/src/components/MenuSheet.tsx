import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../theme';

// Matches the web app's logo menu: the destinations that don't fit in the
// bottom tab bar. Feed / Library / Messages / Alerts / Profile are tabs; this
// holds the rest.
const LINKS: { path: string; label: string; icon: string }[] = [
  { path: '/groups', label: 'Groups', icon: '👥' },
  { path: '/timetable', label: 'Timetable', icon: '🗓️' },
];

export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();

  const go = (path: string) => {
    onClose();
    router.push(path as never);
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
});
