'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IBM_Plex_Mono } from 'next/font/google';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});

const FEATURES = [
  {
    tag: 'FEED',
    title: 'Campus feed',
    description: 'Posts, polls, questions and events from coursemates across every faculty.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    tag: 'CHAT',
    title: 'Direct & group messaging',
    description: 'Real-time chats and group threads — no more scattered WhatsApp groups per class.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    tag: 'STORY',
    title: 'Stories',
    description: 'Share photo, video and text stories with reactions and replies that disappear in a day.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    tag: 'NEWS',
    title: 'Campus news',
    description: 'Official announcements and faculty updates, all in one trusted place.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    ),
  },
  {
    tag: 'TIMETABLE',
    title: 'Department timetable',
    description: 'Class schedules with live holding and cancelled status, so you never walk in for nothing.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
];

const FACULTIES = [
  'Engineering', 'Medicine', 'Agriculture', 'Arts', 'Education', 'Law',
  'Science', 'Social Sciences', 'Environmental Design', 'Pharmaceutical Sciences',
  'Administration', 'Veterinary Medicine',
];

/** Faint recurring contour-line motif — the page's connective tissue between hero and CTA. */
function TopoLines({ className, opacity = 0.08 }: { className?: string; opacity?: number }) {
  return (
    <svg className={className} viewBox="0 0 800 400" fill="none" preserveAspectRatio="none" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M-20 ${60 + i * 70} C 180 ${10 + i * 70}, 320 ${130 + i * 60}, 500 ${50 + i * 65} S 760 ${20 + i * 70}, 860 ${90 + i * 65}`}
          stroke="currentColor"
          strokeWidth="1"
          opacity={opacity}
        />
      ))}
    </svg>
  );
}

/** Signature hero visual: a campus profile card, the concrete object the whole product centers on. */
function CampusProfileCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm select-none">
      {/* Floating chip: new message */}
      <div className="absolute -left-4 top-6 z-20 hidden animate-[float_6s_ease-in-out_infinite] items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 shadow-elevated dark:border-[#222] dark:bg-[#151515] sm:flex">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </span>
        <div>
          <div className={cn(plexMono.className, 'text-[10px] font-medium text-ink-muted')}>2 NEW</div>
          <div className="text-[11px] font-semibold text-ink">CSC group chat</div>
        </div>
      </div>

      {/* Floating chip: news */}
      <div className="absolute -right-3 bottom-16 z-20 hidden animate-[float_7s_ease-in-out_infinite_0.8s] items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 shadow-elevated dark:border-[#222] dark:bg-[#151515] sm:flex">
        <span className={cn(plexMono.className, 'text-[10px] font-semibold tracking-wide text-[#C8932F]')}>NEWS</span>
        <div className="text-[11px] font-medium text-ink">Senate exam timetable released</div>
      </div>

      {/* The card itself */}
      <div className="animate-[float_8s_ease-in-out_infinite] [transform:rotate(-5deg)]">
        <div
          className="relative overflow-hidden rounded-[1.4rem] border border-white/10 p-5 shadow-elevated"
          style={{ background: 'linear-gradient(150deg, #14532d 0%, #052e16 65%, #03190c 100%)' }}
        >
          <TopoLines className="absolute inset-0 h-full w-full text-white" opacity={0.06} />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo-white.png" alt="" className="h-6 w-6 object-contain" />
              <span className="text-[13px] font-bold tracking-tight text-white">ABUkonn</span>
            </div>
            <span className={cn(plexMono.className, 'rounded-full border border-brand-400/30 bg-brand-400/10 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-brand-300')}>
              ACTIVE
            </span>
          </div>

          <div className="relative mt-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <svg className="h-8 w-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="h-3 w-32 rounded-full bg-white/25" />
              <div className={cn(plexMono.className, 'mt-2 text-[11px] tracking-wide text-white/50')}>@student.abu</div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            <div>
              <div className={cn(plexMono.className, 'text-[9px] tracking-wide text-white/40')}>FACULTY</div>
              <div className="text-[12px] font-medium text-white/85">Computer Science</div>
            </div>
            <div>
              <div className={cn(plexMono.className, 'text-[9px] tracking-wide text-white/40')}>CAMPUS</div>
              <div className="text-[12px] font-medium text-white/85">Samaru</div>
            </div>
          </div>

          <div className="relative mt-5 flex items-center gap-1.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="bg-white/25" style={{ width: i % 4 === 0 ? 2 : 1, height: 16 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && token) {
      router.replace('/feed');
    }
  }, [loading, token, router]);

  if (loading || token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#0a0a0a]">
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee, [class*="animate-[float"] { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 dark:bg-[#0a0a0a]/90 dark:border-[#222] backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <img src="/logo-lockup-light.png" alt="ABUkonn" className="h-8 object-contain dark:hidden" />
            <img src="/logo-lockup-dark.png" alt="ABUkonn" className="hidden h-8 object-contain dark:block" />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-body-sm font-medium text-ink-secondary transition hover:text-brand-600">
              Features
            </a>
            <a href="#about" className="text-body-sm font-medium text-ink-secondary transition hover:text-brand-600">
              About
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <TopoLines className="pointer-events-none absolute inset-x-0 top-0 h-[520px] w-full text-brand-600" opacity={0.05} />
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, #16a34a 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="mx-auto grid max-w-content items-center gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8 lg:pt-28">
            <div className="animate-fade-in text-center lg:text-left">
              <p className={cn(plexMono.className, 'text-[12px] font-medium tracking-[0.18em] text-brand-600')}>
                AHMADU BELLO UNIVERSITY · ZARIA, KADUNA STATE
              </p>

              <h1 className="mt-4 text-display-md text-ink sm:text-display-lg lg:text-display-xl">
                One app for{' '}
                <span className="text-brand-600">every corner</span>{' '}
                of campus.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-secondary sm:text-xl sm:leading-relaxed lg:mx-0">
                From Samaru to Kongo — share, chat, and stay informed with coursemates
                across every faculty at ABU.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
                <Link href="/register">
                  <Button size="lg" className="min-w-[180px]">
                    Create free account
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="min-w-[180px]">
                    Sign in
                  </Button>
                </Link>
              </div>

              <p className={cn(plexMono.className, 'mt-6 text-[11px] tracking-wide text-ink-muted')}>
                FREE FOR ALL ABU STUDENTS · OPEN REGISTRATION
              </p>
            </div>

            <div className="animate-slide-up">
              <CampusProfileCard />
            </div>
          </div>
        </section>

        {/* Faculties marquee — real content in place of a generic stats row */}
        <section className="border-y border-border bg-surface-muted py-7 dark:border-[#222]">
          <div className="mb-3 px-4 text-center sm:px-6">
            <span className={cn(plexMono.className, 'text-[11px] tracking-[0.18em] text-ink-muted')}>
              CONNECTING STUDENTS ACROSS
            </span>
          </div>
          <div className="overflow-hidden">
            <div className="animate-marquee flex w-max items-center gap-10" style={{ animation: 'marquee 32s linear infinite' }}>
              {[...FACULTIES, ...FACULTIES].map((f, i) => (
                <span key={i} className="flex items-center gap-10 whitespace-nowrap">
                  <span className="text-body-md font-medium text-ink-secondary">{f}</span>
                  <span className="h-1 w-1 rounded-full bg-brand-400" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 sm:py-28">
          <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className={cn(plexMono.className, 'text-[12px] font-medium tracking-[0.18em] text-brand-600')}>
                WHAT&apos;S INSIDE
              </p>
              <h2 className="mt-3 text-display-sm text-ink sm:text-display-md">
                Everything you need on campus
              </h2>
              <p className="mt-4 text-body-lg text-ink-secondary">
                Built by students, for students. ABUkonn brings your university life
                into one modern, easy-to-use platform.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card
                  key={feature.title}
                  className="group transition-all duration-300 hover:border-brand-200 hover:shadow-elevated dark:hover:border-brand-800"
                >
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950 dark:text-brand-400">
                        {feature.icon}
                      </div>
                      <span className={cn(plexMono.className, 'text-[10px] tracking-widest text-ink-faint')}>
                        [{feature.tag}]
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">{feature.title}</h3>
                    <p className="mt-2 text-body-sm leading-relaxed text-ink-secondary">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* About / CTA */}
        <section id="about" className="relative overflow-hidden bg-brand-950 py-20 sm:py-28">
          <TopoLines className="pointer-events-none absolute inset-0 h-full w-full text-white" opacity={0.06} />
          <div className="relative mx-auto max-w-content px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className={cn(plexMono.className, 'text-[12px] font-medium tracking-[0.18em] text-[#E8C170]')}>
                JOIN THE NETWORK
              </p>
              <h2 className="mt-3 text-display-sm text-white sm:text-display-md">
                Ready to join your campus community?
              </h2>
              <p className="mt-4 text-body-lg text-brand-200">
                Create your free account and start connecting with
                students across every faculty today.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="min-w-[200px] !bg-white !text-brand-700 hover:!bg-brand-50 !shadow-none"
                  >
                    Join ABUkonn
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-w-[200px] !border-white/30 !bg-transparent !text-white hover:!bg-white/10"
                  >
                    I have an account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white dark:bg-[#0a0a0a] dark:border-[#222]">
        <div className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="ABUkonn" className="h-8 w-8 object-contain" />
              <div>
                <div className="font-semibold text-ink dark:text-[#f5f5f5]">ABUkonn</div>
                <div className={cn(plexMono.className, 'text-[11px] tracking-wide text-ink-muted')}>
                  ZARIA, KADUNA STATE, NIGERIA
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-body-sm text-ink-secondary">
              <Link href="/login" className="transition hover:text-brand-600">
                Sign in
              </Link>
              <Link href="/register" className="transition hover:text-brand-600">
                Register
              </Link>
              <a href="#features" className="transition hover:text-brand-600">
                Features
              </a>
              <Link href="/terms" className="transition hover:text-brand-600">
                Terms &amp; Conditions
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-8 text-center text-caption text-ink-muted dark:border-[#222]">
            © {new Date().getFullYear()} ABUkonn · Ahmadu Bello University, Zaria
          </div>
        </div>
      </footer>
    </div>
  );
}
