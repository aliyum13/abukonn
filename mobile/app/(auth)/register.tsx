import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from 'react-native';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';
import { DEPARTMENTS, LEVELS } from '../../src/lib/departments';

const COMMON_WEAK = new Set(['password', '123456', '12345678', 'qwerty', 'abc123', '111111', 'password1']);

export default function Register() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Which picker is open (department or level), or null.
  const [picker, setPicker] = useState<null | 'department' | 'level'>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !department || !level || !password) {
      setError('Please fill in all fields.'); return;
    }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (COMMON_WEAK.has(password.toLowerCase())) { setError('That password is too common. Choose a stronger one.'); return; }

    setBusy(true);
    try {
      await signUp({
        full_name: fullName.trim(), email: email.trim().toLowerCase(),
        department, level, password,
      });
      router.replace('/(tabs)/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const pickerData = picker === 'department'
    ? DEPARTMENTS.filter(d => d.toLowerCase().includes(pickerQuery.toLowerCase()))
    : LEVELS;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>ABUkonn</Text>
        <Text style={s.subtitle}>Create your account</Text>

        <TextInput style={s.input} placeholder="Full name" placeholderTextColor={colors.muted}
          value={fullName} onChangeText={setFullName} autoCapitalize="words" />

        <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted}
          value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />

        <TouchableOpacity style={s.select} onPress={() => { setPicker('department'); setPickerQuery(''); }}>
          <Text style={department ? s.selectValue : s.selectPlaceholder} numberOfLines={1}>
            {department || 'Select department'}
          </Text>
          <Text style={s.chevron}>▾</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.select} onPress={() => setPicker('level')}>
          <Text style={level ? s.selectValue : s.selectPlaceholder}>
            {level || 'Select level'}
          </Text>
          <Text style={s.chevron}>▾</Text>
        </TouchableOpacity>

        <TextInput style={s.input} placeholder="Password (min 6 characters)" placeholderTextColor={colors.muted}
          value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.button, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Create account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkRow} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.linkMuted}>Already have an account? </Text>
          <Text style={s.link}>Log in</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Department / Level picker */}
      <Modal visible={picker !== null} animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={s.pickerSheet}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>{picker === 'department' ? 'Select department' : 'Select level'}</Text>
            <TouchableOpacity onPress={() => setPicker(null)} hitSlop={10}>
              <Text style={s.link}>Close</Text>
            </TouchableOpacity>
          </View>
          {picker === 'department' ? (
            <TextInput
              style={s.pickerSearch}
              placeholder="Search departments"
              placeholderTextColor={colors.muted}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              autoFocus
            />
          ) : null}
          <FlatList
            data={pickerData}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.pickerRow}
                onPress={() => {
                  if (picker === 'department') setDepartment(item); else setLevel(item);
                  setPicker(null);
                }}
              >
                <Text style={s.pickerRowText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '800', color: colors.brand, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, marginBottom: 12 },
  select: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 15, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectValue: { fontSize: 16, color: colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 16, color: colors.muted, flex: 1 },
  chevron: { fontSize: 14, color: colors.muted, marginLeft: 8 },
  button: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, marginBottom: 8, textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkMuted: { color: colors.muted, fontSize: 14 },
  link: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  pickerSheet: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  pickerSearch: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, margin: 16, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text },
  pickerRow: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowText: { fontSize: 16, color: colors.text },
});
