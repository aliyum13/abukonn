import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../src/theme/ThemeContext';
import type { Palette } from '../src/theme';
import { colors } from '../src/theme';
import { apiFetch } from '../src/lib/api';

// Master switch — Pro isn't public yet. While false this screen bounces back,
// mirroring the web PRO_LAUNCHED flag so both platforms reveal together.
export const PRO_LAUNCHED = false;

const PERKS: { title: string; desc: string }[] = [
  { title: 'Verified badge', desc: 'Stand out with a verification badge on your profile.' },
  { title: 'See who viewed your profile', desc: 'Get the full list of people who visited your profile.' },
  { title: 'Post analytics', desc: 'See views, unique viewers, and engagement on every post.' },
  { title: 'Multi-photo & video posts', desc: 'Share up to 3 photos or videos in a single post.' },
  { title: 'Edit posts after publishing', desc: 'Fix a typo or update a caption any time.' },
  { title: 'Unlimited stories', desc: 'Post as many stories a day as you like.' },
  { title: 'Bigger uploads', desc: 'Larger photos and longer, higher-quality videos.' },
];

export default function ProScreen() {
  const s = useThemedStyles(make_s);
  const router = useRouter();

  const [isPro, setIsPro] = useState(false);
  const [proExpires, setProExpires] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);

  useEffect(() => {
    if (!PRO_LAUNCHED) router.replace('/(tabs)/feed');
  }, [router]);

  const loadStatus = useCallback(async () => {
    try {
      const d = await apiFetch<{ is_pro: boolean; pro_expires_at: string | null }>('/api/pro/status');
      setIsPro(!!d.is_pro);
      setProExpires(d.pro_expires_at || null);
    } catch {
      /* leave defaults */
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // When the user returns to this screen from the Paystack browser, verify the
  // pending payment (the webhook is the real source of truth, but this gives
  // instant confirmation) and refresh Pro status.
  useFocusEffect(useCallback(() => {
    if (!pendingRef) return;
    let active = true;
    (async () => {
      try {
        const d = await apiFetch<{ is_pro: boolean }>(`/api/pro/verify/${encodeURIComponent(pendingRef)}`);
        if (active && d.is_pro) {
          setIsPro(true);
          setPendingRef(null);
          Alert.alert('Welcome to Pro! 🎉', 'Your ABUkonn Pro membership is now active.');
          loadStatus();
        }
      } catch {
        /* webhook will still grant it; user can re-check later */
      }
    })();
    return () => { active = false; };
  }, [pendingRef, loadStatus]));

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const d = await apiFetch<{ authorization_url: string; reference: string }>(
        '/api/pro/subscribe', { method: 'POST' }
      );
      if (!d.authorization_url) throw new Error('Could not start checkout.');
      setPendingRef(d.reference);
      // Open Paystack's hosted checkout in the system browser. On return to the
      // app, useFocusEffect above verifies the payment.
      await Linking.openURL(d.authorization_url);
    } catch (e) {
      Alert.alert('Could not start subscription', e instanceof Error ? e.message : '');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ABUkonn Pro</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>ABUKONN PRO</Text>
          <View style={s.priceRow}>
            <Text style={s.price}>₦2,000</Text>
            <Text style={s.priceUnit}>/month</Text>
          </View>
          <Text style={s.heroSub}>Unlock the full ABUkonn experience and support your campus community.</Text>
        </View>

        {/* Status / CTA */}
        {statusLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} />
        ) : isPro ? (
          <View style={s.proBox}>
            <Text style={s.proBoxTitle}>You&apos;re a Pro member 🎉</Text>
            {proExpires ? (
              <Text style={s.proBoxSub}>Renews on {new Date(proExpires).toLocaleDateString()}</Text>
            ) : null}
          </View>
        ) : (
          <>
            <TouchableOpacity style={[s.cta, subscribing && s.ctaDisabled]} onPress={handleSubscribe} disabled={subscribing}>
              <Text style={s.ctaText}>{subscribing ? 'Starting checkout…' : 'Go Pro — ₦2,000/month'}</Text>
            </TouchableOpacity>
            <Text style={s.secure}>Secure payment via Paystack. Cancel anytime.</Text>
          </>
        )}

        {/* Perks */}
        <Text style={s.perksHeading}>What you get</Text>
        {PERKS.map((perk) => (
          <View key={perk.title} style={s.perkRow}>
            <View style={s.perkCheck}>
              <Ionicons name="checkmark" size={14} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.perkTitle}>{perk.title}</Text>
              <Text style={s.perkDesc}>{perk.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 18, backgroundColor: colors.brand, padding: 20 },
  heroLabel: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1, opacity: 0.9 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  price: { color: '#fff', fontSize: 34, fontWeight: '900' },
  priceUnit: { color: '#fff', fontSize: 16, opacity: 0.9, marginLeft: 4, marginBottom: 5 },
  heroSub: { color: '#fff', fontSize: 13, opacity: 0.9, marginTop: 8, lineHeight: 19 },
  cta: { marginTop: 18, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secure: { textAlign: 'center', color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  proBox: { marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brand100, padding: 16, alignItems: 'center' },
  proBoxTitle: { color: colors.brand, fontSize: 15, fontWeight: '800' },
  proBoxSub: { color: colors.brand, fontSize: 13, marginTop: 4 },
  perksHeading: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 28, marginBottom: 12 },
  perkRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  perkCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  perkTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  perkDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 1, lineHeight: 18 },
});
