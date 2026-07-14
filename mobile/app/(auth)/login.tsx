import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';
import { API_URL } from '../../src/lib/api';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>ABUkonn</Text>
        <Text style={s.subtitle}>Sign in to your account</Text>

        <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted}
          value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor={colors.muted}
          value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.button, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Log in</Text>}
        </TouchableOpacity>

        {/* Deliberate: if login fails, the first thing to check is whether the
            app is pointing at the right backend. */}
        <Text style={s.debug}>{API_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '800', color: colors.brand, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, marginBottom: 12 },
  button: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, marginBottom: 8, textAlign: 'center' },
  debug: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 24 },
});
