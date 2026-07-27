import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { colors } from '../../src/theme';
import { apiFetch } from '../../src/lib/api';

/**
 * Deep-link target for abukonn.com/u/<username> — mirrors web's
 * UsernameRedirectPage exactly. This is what a universal/App Link resolves
 * to when someone taps a shared profile link on their phone (see app.json's
 * associatedDomains / intentFilters). Resolves the username to a user id via
 * the same public, no-auth endpoint web uses, then forwards to the real
 * profile screen. A leading @ is accepted and stripped, matching web.
 */
export default function UsernameRedirect() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  const username = decodeURIComponent(raw || '').replace(/^@/, '').trim();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) { setNotFound(true); return; }
    let cancelled = false;
    apiFetch<{ id: number }>(`/api/users/username/${encodeURIComponent(username)}`, {}, false)
      .then((data) => {
        if (cancelled) return;
        if (data?.id) router.replace({ pathname: '/user/[id]', params: { id: String(data.id) } });
        else setNotFound(true);
      })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [username, router]);

  if (notFound) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.title}>User not found</Text>
          <Text style={s.sub}>@{username} doesn&apos;t exist or is unavailable.</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)/feed')}>
            <Text style={s.btnText}>Go to feed</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 20, backgroundColor: colors.brand, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
