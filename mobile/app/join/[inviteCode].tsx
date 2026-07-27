import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { colors, radius, shadow } from '../../src/theme';
import { apiFetch } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';

interface GroupPreview {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
  invite_enabled: boolean;
  require_approval: boolean;
  is_member: boolean;
}

/**
 * Deep-link target for abukonn.com/join/<inviteCode> — mirrors web's
 * JoinPage. This is what a universal/App Link resolves to when someone taps
 * a shared group invite link on their phone (see app.json's
 * associatedDomains / intentFilters). Same backend endpoints web uses:
 * GET to preview the group, POST to actually join.
 */
export default function JoinGroup() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>();

  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [result, setResult] = useState<{ pending?: boolean; already?: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) { setPageLoading(false); return; }
    apiFetch<{ group?: GroupPreview; message?: string }>(`/api/groups/join/${inviteCode}`)
      .then((d) => {
        if (d.group) setGroup(d.group);
        else setError(d.message || 'Invalid invite link');
      })
      .catch(() => setError('Could not load group'))
      .finally(() => setPageLoading(false));
  }, [authLoading, user, inviteCode]);

  const handleJoin = async () => {
    if (!group) return;
    setJoining(true);
    setError('');
    try {
      const data = await apiFetch<{ message?: string; pending?: boolean; already_member?: boolean; group?: GroupPreview }>(
        `/api/groups/join/${inviteCode}`,
        { method: 'POST' }
      );
      setResult({ pending: data.pending, already: data.already_member });
      if (data.group) setGroup(data.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || pageLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      </SafeAreaView>
    );
  }

  // Not logged in — keep this simple rather than building a generic
  // redirect-after-login mechanism just for this one entry point.
  if (!user) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.title}>Log in to join this group</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.push('/(auth)/login')}>
            <Text style={s.btnText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !group) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.emoji}>🔗</Text>
          <Text style={s.title}>Link expired or invalid</Text>
          <Text style={s.sub}>{error}</Text>
          <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={() => router.replace('/(tabs)/messages')}>
            <Text style={s.btnOutlineText}>Go to messages</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!group) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.center}>
        <View style={s.card}>
          <View style={s.iconWrap}><Text style={s.icon}>💬</Text></View>
          <Text style={s.groupName}>{group.name}</Text>
          {group.description ? <Text style={s.sub}>{group.description}</Text> : null}
          <Text style={s.sub}>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {result?.already || group.is_member ? (
            <>
              <Text style={s.success}>You are already a member of this group.</Text>
              <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)/messages')}>
                <Text style={s.btnText}>Open in Messages</Text>
              </TouchableOpacity>
            </>
          ) : result?.pending ? (
            <>
              <Text style={s.pending}>Your request to join is pending admin approval.</Text>
              <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={() => router.replace('/(tabs)/messages')}>
                <Text style={s.btnOutlineText}>Back to Messages</Text>
              </TouchableOpacity>
            </>
          ) : result ? (
            <>
              <Text style={s.success}>You joined the group!</Text>
              <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)/messages')}>
                <Text style={s.btnText}>Open in Messages</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={s.btn} onPress={handleJoin} disabled={joining}>
              {joining
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnText}>{group.require_approval ? 'Request to Join' : 'Join Group'}</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 28, alignItems: 'center', ...shadow.card,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  icon: { fontSize: 26 },
  groupName: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' },
  emoji: { fontSize: 28, marginBottom: 8 },
  error: {
    marginTop: 14, fontSize: 13, color: colors.danger, textAlign: 'center',
    backgroundColor: colors.brand50, padding: 10, borderRadius: radius.sm, width: '100%',
  },
  success: { marginTop: 14, fontSize: 13, fontWeight: '700', color: colors.brand, textAlign: 'center' },
  pending: { marginTop: 14, fontSize: 13, fontWeight: '700', color: '#d97706', textAlign: 'center' },
  btn: {
    marginTop: 18, backgroundColor: colors.brand, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 999, width: '100%', alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnOutlineText: { color: colors.text, fontWeight: '700', fontSize: 14 },
});
