'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionBanner, setSessionBanner] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_expired') {
      setSessionBanner('Your session expired. Please log in again.');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Sign in with your email address to continue."
    >
      {sessionBanner && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-body-sm text-amber-700" role="alert">
          {sessionBanner}
        </div>
      )}
      {error && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@abu.edu.ng"
          required
          autoComplete="email"
        />

        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
        />

        <Button type="submit" fullWidth size="lg" loading={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 text-center text-body-sm text-ink-secondary">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-brand-600 transition hover:text-brand-700"
        >
          Create one free
        </Link>
      </p>

      <p className="mt-4 text-center text-caption text-ink-muted">
        By using ABUkonn you agree to our{' '}
        <Link href="/terms" className="underline underline-offset-2 transition hover:text-brand-600">
          Terms &amp; Conditions
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
