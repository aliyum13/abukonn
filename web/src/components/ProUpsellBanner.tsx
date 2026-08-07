'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Master switch for whether ABUkonn Pro is public yet. Kept FALSE until the
// whole tier is live end-to-end (Paystack keys set in Railway, webhook
// registered, and the is_pro gates flipped on). While false, every Pro
// entry point (feed/profile/settings banners) stays hidden so users don't
// see a "Go Pro" prompt for something that isn't gated or purchasable yet.
// Flip to true in one place to reveal Pro everywhere.
export const PRO_LAUNCHED = false;

// A compact "Go Pro" banner linking to the Pro screen. Used in the feed,
// profile, and settings. Hidden entirely until PRO_LAUNCHED, and hidden for
// users who are already Pro (no point upselling them). Reads is_pro off the
// auth user, which the backend now returns in the user payload.
export function ProUpsellBanner({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  if (!PRO_LAUNCHED) return null;
  if (user?.is_pro) return null;

  return (
    <Link
      href="/pro"
      className={`flex items-center gap-3 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 p-3.5 text-white transition hover:opacity-95 ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6L12 2z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-tight">Go Pro</p>
        <p className="text-[12px] leading-tight opacity-90">Unlock the full ABUkonn — ₦2,000/mo</p>
      </div>
      <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}
