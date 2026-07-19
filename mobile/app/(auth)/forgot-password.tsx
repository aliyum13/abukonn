import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme';
import { forgotPassword, verifyOtp, resetPassword } from '../../src/lib/api';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPassword() {
  const s = useThemedStyles(make_s);
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds until resend allowed
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const RESEND_COOLDOWN = 60;

  useEffect(() => () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { if (cooldownTimer.current) clearInterval(cooldownTimer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const requestCode = async () => {
    setError('');
    if (!email.trim()) { setError('Enter your email.'); return; }
    setBusy(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      // Backend always returns the same message (doesn't reveal if the email
      // exists), so we simply advance to the code step.
      setStep('otp');
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setError('');
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    setBusy(true);
    try {
      const res = await verifyOtp(email.trim().toLowerCase(), otp.trim());
      setResetToken(res.reset_token);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async () => {
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await resetPassword({ reset_token: resetToken, new_password: newPassword });
      Alert.alert('Password reset', 'You can now log in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>ABUkonn</Text>
        <Text style={s.subtitle}>
          {step === 'email' ? 'Reset your password'
            : step === 'otp' ? `Enter the code sent to ${email}`
            : 'Set a new password'}
        </Text>

        {step === 'email' ? (
          <>
            <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted}
              value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.button, busy && { opacity: 0.6 }]} onPress={requestCode} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send code</Text>}
            </TouchableOpacity>
          </>
        ) : step === 'otp' ? (
          <>
            <TextInput style={[s.input, s.otpInput]} placeholder="000000" placeholderTextColor={colors.muted}
              value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoFocus />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.button, busy && { opacity: 0.6 }]} onPress={submitCode} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Verify code</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.resend} onPress={requestCode} disabled={busy || cooldown > 0}>
              <Text style={[s.link, cooldown > 0 ? { color: colors.muted } : null]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput style={s.input} placeholder="New password (min 6 characters)" placeholderTextColor={colors.muted}
              value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoFocus />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.button, busy && { opacity: 0.6 }]} onPress={submitNewPassword} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Reset password</Text>}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.backRow} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.link}>Back to login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '800', color: colors.brand, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, marginBottom: 12 },
  otpInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  button: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, marginBottom: 8, textAlign: 'center' },
  resend: { alignItems: 'center', marginTop: 16 },
  backRow: { alignItems: 'center', marginTop: 24 },
  link: { color: colors.brand, fontSize: 14, fontWeight: '700' },
});
