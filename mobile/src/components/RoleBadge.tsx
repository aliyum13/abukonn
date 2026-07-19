import { View, Text, StyleSheet } from 'react-native';

// Mirrors web's RoleBadge: labeled pill for verified/bod/influencer/admin.
const CONFIGS: Record<string, { label: string; icon: string; bg: string; fg: string }> = {
  verified:   { label: 'Verified',   icon: '✓', bg: 'rgba(59,130,246,0.15)', fg: '#2563eb' },
  bod:        { label: 'BOD',        icon: '★', bg: 'rgba(234,179,8,0.18)',  fg: '#a16207' },
  influencer: { label: 'Influencer', icon: '⭐', bg: 'rgba(168,85,247,0.15)', fg: '#9333ea' },
  admin:      { label: 'Admin',      icon: '🛡', bg: 'rgba(22,163,74,0.15)',  fg: '#16a34a' },
};

export function usesFollowSystem(role?: string | null): boolean {
  return ['verified', 'bod', 'influencer', 'admin'].includes(role || '');
}

export function RoleBadge({ role, iconOnly }: { role?: string | null; iconOnly?: boolean }) {
  if (!role || role === 'user') return null;
  const cfg = CONFIGS[role];
  if (!cfg) return null;
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.icon, { color: cfg.fg }]}>{cfg.icon}</Text>
      {!iconOnly ? <Text style={[s.label, { color: cfg.fg }]}>{cfg.label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  icon: { fontSize: 11, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700' },
});
