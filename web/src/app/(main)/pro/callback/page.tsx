'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Paystack redirects here after checkout with ?reference=... (and ?trxref=).
// We verify server-side (the webhook is the real source of truth, but this
// gives the user immediate confirmation without waiting on the webhook).
export default function ProCallbackPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');

  const [state, setState] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    if (!token || !reference) {
      if (token && !reference) setState('failed');
      return;
    }
    fetch(`${API_URL}/api/pro/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setState(d.is_pro ? 'success' : 'failed'))
      .catch(() => setState('failed'));
  }, [token, reference]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-sm text-center">
        {state === 'verifying' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="text-[15px] font-medium text-ink">Confirming your payment…</p>
            <p className="mt-1 text-[13px] text-ink-muted">This only takes a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950">
              <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-ink">Welcome to Pro! 🎉</h1>
            <p className="mt-2 text-[14px] text-ink-muted">
              Your ABUkonn Pro membership is now active. Enjoy everything Pro has to offer.
            </p>
            <Button onClick={() => router.push('/feed')} size="lg" className="mt-6 w-full rounded-full">
              Back to ABUkonn
            </Button>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-ink">Payment not confirmed</h1>
            <p className="mt-2 text-[14px] text-ink-muted">
              We couldn&apos;t confirm your payment yet. If you were charged, your Pro access will
              activate shortly — otherwise you can try again.
            </p>
            <Button onClick={() => router.push('/pro')} size="lg" className="mt-6 w-full rounded-full">
              Back to Pro
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
