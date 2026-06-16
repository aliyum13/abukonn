'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button, Input, Select } from '@/components/ui';

const DEPARTMENTS = [
  'Computer Science',
  'Software Engineering',
  'Information Technology',
  'Electrical Engineering',
  'Civil Engineering',
  'Mechanical Engineering',
  'Medicine & Surgery',
  'Law',
  'Economics',
  'Accounting',
  'Mass Communication',
  'Political Science',
  'Sociology',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biochemistry',
  'Microbiology',
  'Pharmacy',
  'Nursing Science',
];

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
    matric_number: '',
    full_name: '',
    email: '',
    department: '',
    level: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
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
          id="matric"
          label="Matric Number"
          type="text"
          value={form.matric_number}
          onChange={(e) => handleChange('matric_number', e.target.value)}
          placeholder="e.g. UG20/CS/1001"
          required
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

        <Input
          id="email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="you@abu.edu.ng"
          required
          autoComplete="email"
        />

        <Select
          id="department"
          label="Department"
          value={form.department}
          onChange={(e) => handleChange('department', e.target.value)}
          required
        >
          <option value="">Select department</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
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

        <Input
          id="password"
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => handleChange('password', e.target.value)}
          placeholder="At least 6 characters"
          required
          minLength={6}
          hint="Must be at least 6 characters"
          autoComplete="new-password"
        />

        <div className="pt-2">
          <Button type="submit" fullWidth size="lg" loading={loading}>
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
