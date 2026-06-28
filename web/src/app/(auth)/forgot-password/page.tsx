'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button, Input } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');

  // Step 1
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Step 2
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: Send OTP ────────────────────────────────────────────────────────
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      setStep('otp');
      startCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Step 2: OTP input handlers ──────────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    const next = [...otp];
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setOtpError('Please enter all 6 digits'); return; }
    setOtpError('');
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const data = await res.json() as { valid?: boolean; reset_token?: string; message?: string };
      if (!res.ok || !data.valid) throw new Error(data.message || 'Invalid or expired code');
      setResetToken(data.reset_token!);
      setStep('password');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed');
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setOtp(Array(OTP_LENGTH).fill(''));
      setOtpError('');
      startCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch { /* ignore */ }
  };

  // ── Step 3: Set new password ─────────────────────────────────────────────────
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      router.push('/login?reason=password_reset');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (step === 'email') {
    return (
      <AuthSplitLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a reset code.">
        {emailError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">{emailError}</div>
        )}
        <form onSubmit={handleSendCode} className="space-y-5">
          <Input id="email" label="Email address" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@abu.edu.ng"
            required autoComplete="email" />
          <Button type="submit" fullWidth size="lg" loading={emailLoading}>
            {emailLoading ? 'Sending code…' : 'Send Code'}
          </Button>
        </form>
        <p className="mt-8 text-center text-body-sm text-ink-secondary">
          Remember your password?{' '}
          <Link href="/login" className="font-medium text-brand-600 transition hover:text-brand-700">Sign in</Link>
        </p>
      </AuthSplitLayout>
    );
  }

  if (step === 'otp') {
    return (
      <AuthSplitLayout title="Check your email" subtitle={`We sent a 6-digit code to ${email}`}>
        {otpError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">{otpError}</div>
        )}
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          {/* 6-box OTP input */}
          <div>
            <label className="mb-3 block text-body-sm font-medium text-ink-secondary">Enter the 6-digit code</label>
            <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  className="h-14 w-12 rounded-xl border border-border bg-white text-center text-xl font-bold text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#0a0a0a] dark:border-[#333]"
                />
              ))}
            </div>
          </div>

          <Button type="submit" fullWidth size="lg" loading={otpLoading}
            disabled={otp.join('').length < OTP_LENGTH}>
            {otpLoading ? 'Verifying…' : 'Verify Code'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          {cooldown > 0 ? (
            <p className="text-body-sm text-ink-muted">Resend code in <span className="font-semibold text-ink">{cooldown}s</span></p>
          ) : (
            <button type="button" onClick={handleResend}
              className="text-body-sm font-medium text-brand-600 transition hover:text-brand-700">
              Resend code
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-body-sm text-ink-secondary">
          Wrong email?{' '}
          <button type="button" onClick={() => { setStep('email'); setOtp(Array(OTP_LENGTH).fill('')); setOtpError(''); }}
            className="font-medium text-brand-600 transition hover:text-brand-700">Go back</button>
        </p>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout title="Set new password" subtitle="Choose a strong password you haven't used before.">
      {passwordError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">{passwordError}</div>
      )}
      <form onSubmit={handleResetPassword} className="space-y-5">
        <Input id="new-password" label="New password" type="password"
          value={newPassword} onChange={e => setNewPassword(e.target.value)}
          placeholder="At least 6 characters" required minLength={6}
          hint="Must be at least 6 characters" autoComplete="new-password" />
        <Input id="confirm-password" label="Confirm new password" type="password"
          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password" required autoComplete="new-password" />
        <Button type="submit" fullWidth size="lg" loading={passwordLoading}>
          {passwordLoading ? 'Updating password…' : 'Update Password'}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
