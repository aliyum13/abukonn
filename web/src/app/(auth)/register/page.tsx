'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button, Input, Select, PasswordInput, PasswordStrengthMeter, getPasswordStrength, COMMON_PASSWORDS } from '@/components/ui';
import { DEPARTMENTS_ALPHABETICAL } from '@/lib/departments';

const LEVELS = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
  'Spill Over',
  'Postgraduate',
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    department: '',
    level: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (COMMON_PASSWORDS.has(form.password.toLowerCase())) {
      setError('This password is too common. Please choose a unique password.');
      return;
    }
    if (getPasswordStrength(form.password) === 'weak') {
      setError('Password is too weak. Please choose a stronger password.');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      router.push('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      title="Create your account"
      subtitle="Join thousands of ABU students on campus."
      tagline="Join the community"
    >
      {error && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          label="Email address"
          type="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="you@abu.edu.ng"
          required
          autoComplete="email"
          hint="This will be your login email"
        />

        <Input
          id="name"
          label="Full Name"
          type="text"
          value={form.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          placeholder="Your full name"
          required
        />

        <Select
          id="department"
          label="Department"
          value={form.department}
          onChange={(e) => handleChange('department', e.target.value)}
          required
        >
          <option value="">Select department</option>
          {DEPARTMENTS_ALPHABETICAL.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </Select>

        <Select
          id="level"
          label="Level"
          value={form.level}
          onChange={(e) => handleChange('level', e.target.value)}
          required
        >
          <option value="">Select level</option>
          {LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </Select>

        <div>
          <PasswordInput
            id="password"
            label="Password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={form.password} />
        </div>

        {/* Terms checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-brand-600 cursor-pointer"
            />
            <span className="text-body-sm text-ink-secondary leading-snug">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-brand-600 underline underline-offset-2 transition hover:text-brand-700"
              >
                Terms &amp; Conditions
              </Link>
            </span>
          </label>
        </div>

        <div className="pt-1">
          <Button type="submit" fullWidth size="lg" loading={loading} disabled={!agreedToTerms}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </div>
      </form>

      <p className="mt-8 text-center text-body-sm text-ink-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-brand-600 transition hover:text-brand-700"
        >
          Sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
