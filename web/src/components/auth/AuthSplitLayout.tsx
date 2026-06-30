import Link from 'next/link';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuthSplitLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  tagline?: string;
  className?: string;
}

export function AuthSplitLayout({
  children,
  title,
  subtitle,
  tagline = "ABU's Digital Campus",
  className,
}: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-brand-950 px-6 py-10 sm:px-10 lg:w-1/2 lg:px-14 lg:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-brand-800/30 blur-2xl" />

        <Link href="/" className="relative z-10 flex items-center gap-3">
          <img src="/logo-white.png" alt="ABUkonn" className="h-11 w-11 object-contain drop-shadow-lg" />
          <span className="text-xl font-bold text-white">ABUkonn</span>
        </Link>

        <div className="relative z-10 mt-10 lg:mt-0 lg:max-w-md">
          <p className="text-body-sm font-medium uppercase tracking-widest text-brand-400">
            Ahmadu Bello University
          </p>
          <h1 className="mt-3 text-display-sm text-white sm:text-display-md">
            {tagline}
          </h1>
          <p className="mt-4 text-body-md leading-relaxed text-brand-200/90 sm:text-body-lg">
            Connect with coursemates, stay on top of campus news, and be part of
            ABU&apos;s growing digital community.
          </p>
        </div>

        <p className="relative z-10 mt-10 hidden text-caption text-brand-400/80 lg:block">
          © {new Date().getFullYear()} ABUkonn · Zaria, Nigeria
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col justify-center bg-white dark:bg-[#0a0a0a] px-6 py-10 sm:px-10 lg:w-1/2 lg:px-14 lg:py-16">
        <div className={cn('mx-auto w-full max-w-md', className)}>
          <div className="mb-8">
            <h2 className="text-display-sm text-ink">{title}</h2>
            <p className="mt-2 text-body-sm text-ink-secondary">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
