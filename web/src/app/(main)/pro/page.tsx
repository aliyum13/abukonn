'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// The perks shown on the Pro screen. Kept in one list so the marketing copy
// stays in sync with what actually gates once is_pro is switched on.
const PERKS: { title: string; desc: string }[] = [
  { title: 'Verified badge', desc: 'Stand out with a verification badge on your profile.' },
  { title: 'See who viewed your profile', desc: 'Get the full list of people who visited your profile.' },
  { title: 'Post analytics', desc: 'See views, unique viewers, and engagement on every post.' },
  { title: 'Multi-photo & video posts', desc: 'Share up to 3 photos or videos in a single post.' },
  { title: 'Edit posts after publishing', desc: 'Fix a typo or update a caption any time.' },
  { title: 'Unlimited stories', desc: 'Post as many stories a day as you like.' },
  { title: 'Bigger uploads', desc: 'Larger photos and longer, higher-quality videos.' },
];

export default function ProPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isPro, setIsPro] = useState(false);
  const [proExpires, setProExpires] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  // Read current Pro status from the server (authoritative — enforces expiry).
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/pro/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setIsPro(!!d.is_pro); setProExpires(d.pro_expires_at || null); })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, [token]);

  const handleSubscribe = async () => {
    if (!token) return;
    setSubscribing(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/pro/subscribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.authorization_url) {
        throw new Error(data.message || 'Could not start subscription.');
      }
      // Hand off to Paystack's hosted checkout. Paystack redirects back to
      // /pro/callback (set as callback_url server-side) after payment, where
      // we verify and confirm Pro.
      window.location.href = data.authorization_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 dark:border-[#222] bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-surface-muted">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-[17px] font-semibold text-ink">ABUkonn Pro</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide opacity-90">ABUkonn Pro</div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold">₦2,000</span>
            <span className="text-lg opacity-90">/month</span>
          </div>
          <p className="mt-2 text-sm opacity-90">
            Unlock the full ABUkonn experience and support your campus community.
          </p>
        </div>

        {/* Status / CTA */}
        {statusLoading ? (
          <div className="mt-6 h-12 animate-pulse rounded-full bg-surface-muted" />
        ) : isPro ? (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-center dark:border-brand-900 dark:bg-brand-950">
            <p className="font-semibold text-brand-700 dark:text-brand-300">You&apos;re a Pro member 🎉</p>
            {proExpires && (
              <p className="mt-1 text-[13px] text-brand-600 dark:text-brand-400">
                Renews on {new Date(proExpires).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <Button onClick={handleSubscribe} disabled={subscribing} size="lg" className="w-full rounded-full">
              {subscribing ? 'Starting checkout…' : 'Go Pro — ₦2,000/month'}
            </Button>
            {error && <p className="mt-2 text-center text-[13px] text-red-600">{error}</p>}
            <p className="mt-2 text-center text-[12px] text-ink-muted">
              Secure payment via Paystack. Cancel anytime.
            </p>
          </div>
        )}

        {/* Perks */}
        <div className="mt-8">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">What you get</h2>
          <ul className="space-y-3">
            {PERKS.map((perk) => (
              <li key={perk.title} className="flex gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950">
                  <svg className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-ink">{perk.title}</p>
                  <p className="text-[13px] text-ink-muted">{perk.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-center text-[12px] text-ink-muted">
          By subscribing you agree to our{' '}
          <Link href="/terms" className="underline">Terms</Link> and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
