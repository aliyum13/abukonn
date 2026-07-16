import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Switch, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../src/lib/api';
import { uploadImage } from '../src/lib/upload';
import { useAuth } from '../src/context/AuthContext';
import { colors, radius, shadow } from '../src/theme';

interface Settings {
  notif_likes: boolean;
  notif_comments: boolean;
  notif_follows: boolean;
  notif_messages: boolean;
  notif_connect_requests: boolean;
  show_birthday: boolean;
}

const NOTIF_ROWS: { key: keyof Settings; label: string }[] = [
  { key: 'notif_likes', label: 'Likes' },
  { key: 'notif_comments', label: 'Comments' },
  { key: 'notif_follows', label: 'New followers' },
  { key: 'notif_messages', label: 'Messages' },
  { key: 'notif_connect_requests', label: 'Connection requests' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [level, setLevel] = useState(user?.level ?? '');
  const [photo, setPhoto] = useState(user?.profile_photo_url ?? null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const d = await apiFetch<{ settings: Settings }>('/api/settings');
      setSettings(d.settings);
    } catch {
      // toggles just won't render until this loads
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to change your picture.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets[0]) return;
    try {
      // Upload straight to Cloudinary (like everywhere else), then save the URL.
      const url = await uploadImage(res.assets[0].uri, 'abukonn/posts');
      await apiFetch('/api/settings/photo', {
        method: 'POST',
        body: JSON.stringify({ photo_url: url }),
      });
      setPhoto(url);
      Alert.alert('Updated', 'Profile photo changed.');
    } catch (err) {
      Alert.alert('Could not update photo', err instanceof Error ? err.message : '');
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim()) { Alert.alert('Name required'); return; }
    setSavingProfile(true);
    try {
      await apiFetch('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName.trim(),
          bio: bio.trim(),
          department: department.trim(),
          level: level.trim(),
        }),
      });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : '');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggle = async (key: keyof Settings) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next); // optimistic
    try {
      await apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ [key]: next[key] }) });
    } catch {
      setSettings(settings); // revert
    }
  };

  const changePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) { Alert.alert('All password fields are required'); return; }
    if (pwNew.length < 6) { Alert.alert('New password must be at least 6 characters'); return; }
    if (pwNew !== pwConfirm) { Alert.alert('New passwords do not match'); return; }
    setSavingPw(true);
    try {
      await apiFetch('/api/settings/password', {
        method: 'PATCH',
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew, confirm_password: pwConfirm }),
      });
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      Alert.alert('Done', 'Your password has been changed.');
    } catch (err) {
      Alert.alert('Could not change password', err instanceof Error ? err.message : '');
    } finally {
      setSavingPw(false);
    }
  };

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Edit profile */}
          <Text style={s.sectionTitle}>Edit Profile</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.photoRow} onPress={changePhoto}>
              {photo ? (
                <Image source={{ uri: photo }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.fallback]}>
                  <Text style={s.letter}>{fullName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={s.changePhoto}>Change photo</Text>
            </TouchableOpacity>

            <Text style={s.label}>Full name</Text>
            <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={colors.muted} />

            <Text style={s.label}>Bio</Text>
            <TextInput style={[s.input, s.textarea]} value={bio} onChangeText={setBio} placeholder="Tell people about yourself" placeholderTextColor={colors.muted} multiline />

            <Text style={s.label}>Department</Text>
            <TextInput style={s.input} value={department} onChangeText={setDepartment} placeholder="Department" placeholderTextColor={colors.muted} />

            <Text style={s.label}>Level</Text>
            <TextInput style={s.input} value={level} onChangeText={setLevel} placeholder="e.g. 300" placeholderTextColor={colors.muted} />

            <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveText}>Save profile</Text>}
            </TouchableOpacity>
          </View>

          {/* Notifications */}
          <Text style={s.sectionTitle}>Notifications</Text>
          <View style={s.card}>
            {settings ? NOTIF_ROWS.map((r, i) => (
              <View key={r.key} style={[s.toggleRow, i > 0 ? s.divider : null]}>
                <Text style={s.toggleLabel}>{r.label}</Text>
                <Switch
                  value={settings[r.key]}
                  onValueChange={() => toggle(r.key)}
                  trackColor={{ true: colors.brand, false: colors.faint }}
                  thumbColor={colors.white}
                />
              </View>
            )) : (
              <View style={s.loadingRow}><ActivityIndicator color={colors.brand} /></View>
            )}
          </View>

          {/* Change password */}
          <Text style={s.sectionTitle}>Change Password</Text>
          <View style={s.card}>
            <TextInput style={s.input} value={pwCurrent} onChangeText={setPwCurrent} placeholder="Current password" placeholderTextColor={colors.muted} secureTextEntry />
            <TextInput style={s.input} value={pwNew} onChangeText={setPwNew} placeholder="New password" placeholderTextColor={colors.muted} secureTextEntry />
            <TextInput style={s.input} value={pwConfirm} onChangeText={setPwConfirm} placeholder="Confirm new password" placeholderTextColor={colors.muted} secureTextEntry />
            <TouchableOpacity style={s.saveBtn} onPress={changePassword} disabled={savingPw}>
              {savingPw ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveText}>Update password</Text>}
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={s.logout} onPress={onLogout}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: colors.textSecondary,
    marginBottom: 8, marginTop: 16, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.card, padding: 16,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '800', fontSize: 24 },
  changePhoto: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13,
    alignItems: 'center', marginTop: 16,
  },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  toggleLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
  loadingRow: { paddingVertical: 16, alignItems: 'center' },
  logout: {
    marginTop: 24, marginBottom: 8, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, paddingVertical: 13, alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
