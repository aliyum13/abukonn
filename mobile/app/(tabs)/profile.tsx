import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.body}>
        {user?.profile_photo_url ? (
          <Image source={{ uri: user.profile_photo_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.fallback]}>
            <Text style={s.letter}>{user?.full_name?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.name}>{user?.full_name}</Text>
        <TouchableOpacity style={s.editBtn} onPress={() => router.push('/edit-profile')}>
          <Text style={s.editText}>Edit profile</Text>
        </TouchableOpacity>
        {user?.email ? <Text style={s.muted}>{user.email}</Text> : null}
        {user?.department ? (
          <Text style={s.muted}>{user.department}{user.level ? ` · ${user.level}` : ''}</Text>
        ) : null}

        <View style={s.links}>
          <TouchableOpacity style={s.link} onPress={() => router.push('/timetable')}>
            <Text style={s.linkText}>📅  Timetable</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.link} onPress={() => router.push('/groups')}>
            <Text style={s.linkText}>👥  Groups</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.logout} onPress={onLogout}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 32, fontWeight: '800', color: colors.brand },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 14 },
  editBtn: { marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 7 },
  editText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  muted: { fontSize: 14, color: colors.muted, marginTop: 4 },
  links: { width: '100%', marginTop: 32 },
  link: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.text },
  linkArrow: { fontSize: 22, color: colors.muted },
  logout: { marginTop: 24, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
