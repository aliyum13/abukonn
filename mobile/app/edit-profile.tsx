import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, API_URL } from '../src/lib/api';
import { getToken } from '../src/lib/storage';
import { useAuth } from '../src/context/AuthContext';
import { colors } from '../src/theme';

export default function EditProfile() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [level, setLevel] = useState(user?.level ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const save = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      // 1) Text fields.
      await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim(),
          bio: bio.trim(),
          department: department.trim() || null,
          level: level.trim() || null,
        }),
      });

      // 2) Photo, if a new one was chosen — separate multipart endpoint.
      if (photo) {
        const token = await getToken();
        const form = new FormData();
        form.append('photo', { uri: photo, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob);
        const res = await fetch(`${API_URL}/api/users/me/photo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error('Photo upload failed');
      }

      // Pull the fresh user into context so the change shows immediately.
      await refresh();
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const currentPhoto = photo ?? user?.profile_photo_url ?? null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.title}>Edit profile</Text>
        <TouchableOpacity onPress={save} disabled={saving} hitSlop={10}>
          {saving ? <ActivityIndicator color={colors.brand} /> : <Text style={s.save}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.photoWrap} onPress={pickPhoto}>
            {currentPhoto ? (
              <Image source={{ uri: currentPhoto }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.fallback]}>
                <Text style={s.letter}>{fullName.charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
            <Text style={s.changePhoto}>Change photo</Text>
          </TouchableOpacity>

          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={colors.muted} />

          <Text style={s.label}>Bio</Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={200}
          />

          <Text style={s.label}>Department</Text>
          <TextInput style={s.input} value={department} onChangeText={setDepartment} placeholder="e.g. Computer Science" placeholderTextColor={colors.muted} />

          <Text style={s.label}>Level</Text>
          <TextInput style={s.input} value={level} onChangeText={setLevel} placeholder="e.g. 300 Level" placeholderTextColor={colors.muted} />
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
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { color: colors.muted, fontSize: 15 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  save: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  photoWrap: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 36, fontWeight: '800', color: colors.brand },
  changePhoto: { color: colors.brand, fontWeight: '600', fontSize: 14, marginTop: 10 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
