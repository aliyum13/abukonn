import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { PRO_LAUNCHED } from '../../app/pro';

// Compact "Go Pro" banner used on the feed, profile, and settings. Hidden
// entirely until PRO_LAUNCHED (mirrors web), and hidden for existing Pro
// users. Reads is_pro off the auth user.
export function ProUpsellBanner({ style }: { style?: object }) {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { user } = useAuth();

  if (!PRO_LAUNCHED) return null;
  if (user?.is_pro) return null;

  return (
    <TouchableOpacity style={[s.banner, style]} onPress={() => router.push('/pro')} activeOpacity={0.9}>
      <View style={s.icon}>
        <Ionicons name="star" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Go Pro</Text>
        <Text style={s.sub}>Unlock the full ABUkonn — ₦2,000/mo</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </TouchableOpacity>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.brand, borderRadius: 14, padding: 14,
  },
  icon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#fff', fontSize: 12, opacity: 0.9, marginTop: 1 },
});
