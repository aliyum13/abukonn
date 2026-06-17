'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button, Badge, Card, CardContent } from '@/components/ui';

const FEATURES = [
  {
    title: 'Campus Feed',
    description:
      'Share moments, ask questions, and stay in the loop with what\'s happening across ABU.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    title: 'Direct Messages',
    description:
      'Chat with coursemates and friends in real time — no more scattered WhatsApp groups.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    title: 'Campus News',
    description:
      'Official announcements, faculty updates, and events — all in one trusted place.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    ),
  },
  {
    title: 'Your Profile',
    description:
      'Build your campus identity with a profile photo, bio, and matric-verified badge.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

const STATS = [
  { value: '40K+', label: 'Students at ABU' },
  { value: '12', label: 'Faculties connected' },
  { value: '24/7', label: 'Always accessible' },
];

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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-brand">
              AB
            </div>
            <span className="text-lg font-bold text-ink">ABUkonn</span>
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
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-24 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
            <div className="absolute top-32 -right-32 h-64 w-64 rounded-full bg-brand-50 blur-2xl" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'radial-gradient(circle, #16a34a 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
          </div>

          <div className="mx-auto max-w-content px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8 lg:pt-30">
            <div className="mx-auto max-w-3xl text-center animate-fade-in">
              <Badge variant="brand" className="mb-6 px-3 py-1 text-body-sm">
                Ahmadu Bello University
              </Badge>

              <h1 className="text-display-md sm:text-display-lg lg:text-display-xl text-ink">
                ABU&apos;s Digital{' '}
                <span className="text-brand-600">Campus</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-body-lg text-ink-secondary sm:text-xl sm:leading-relaxed">
                Connect with your coursemates, discover campus news, and build your
                university community — all in one place built for ABU students.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
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

              <p className="mt-6 text-caption text-ink-muted">
                Verified with your matric number · Free for all ABU students
              </p>
            </div>

            {/* Hero preview card */}
            <div className="mx-auto mt-16 max-w-4xl animate-slide-up sm:mt-20">
              <div className="rounded-2xl border border-border bg-white/60 p-2 shadow-elevated backdrop-blur-sm sm:rounded-3xl sm:p-3">
                <div className="overflow-hidden rounded-xl border border-border bg-surface-muted sm:rounded-2xl">
                  <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-400/80" />
                      <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                      <span className="h-3 w-3 rounded-full bg-brand-400/80" />
                    </div>
                    <span className="flex-1 text-center text-caption text-ink-muted">
                      abukonn.app/feed
                    </span>
                  </div>
                  <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
                    <div className="space-y-3 sm:col-span-2">
                      <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-brand-100" />
                          <div>
                            <div className="h-3 w-28 rounded bg-ink/10" />
                            <div className="mt-1.5 h-2 w-20 rounded bg-ink/5" />
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="h-2.5 w-full rounded bg-ink/5" />
                          <div className="h-2.5 w-4/5 rounded bg-ink/5" />
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-brand-200" />
                          <div>
                            <div className="h-3 w-32 rounded bg-ink/10" />
                            <div className="mt-1.5 h-2 w-16 rounded bg-ink/5" />
                          </div>
                        </div>
                        <div className="mt-3 h-2.5 w-3/4 rounded bg-ink/5" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
                        <div className="text-caption font-semibold text-brand-600">Campus News</div>
                        <div className="mt-2 h-2.5 w-full rounded bg-ink/5" />
                        <div className="mt-1.5 h-2.5 w-2/3 rounded bg-ink/5" />
                      </div>
                      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                        <div className="text-caption font-semibold text-brand-700">New message</div>
                        <div className="mt-2 h-2.5 w-full rounded bg-brand-200/50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-surface-muted">
          <div className="mx-auto grid max-w-content grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-10 text-center sm:py-12">
                <div className="text-display-sm text-brand-600">{stat.value}</div>
                <div className="mt-1 text-body-sm text-ink-secondary">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 sm:py-28">
          <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="brand" className="mb-4">Features</Badge>
              <h2 className="text-display-sm sm:text-display-md text-ink">
                Everything you need on campus
              </h2>
              <p className="mt-4 text-body-lg text-ink-secondary">
                Built by students, for students. ABUkonn brings your university life
                into one modern, easy-to-use platform.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:gap-8">
              {FEATURES.map((feature) => (
                <Card
                  key={feature.title}
                  className="group transition-all duration-300 hover:border-brand-200 hover:shadow-elevated"
                >
                  <CardContent className="p-6 sm:p-8">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-ink">{feature.title}</h3>
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
        <section id="about" className="bg-brand-950 py-20 sm:py-28">
          <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-display-sm sm:text-display-md text-white">
                Ready to join your campus community?
              </h2>
              <p className="mt-4 text-body-lg text-brand-200">
                Sign up with your ABU matric number and start connecting with
                thousands of students across Zaria today.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="min-w-[200px] bg-white text-brand-700 hover:bg-brand-50 shadow-none"
                  >
                    Join ABUkonn
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-w-[200px] border-brand-700 text-white hover:bg-brand-900"
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
      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                AB
              </div>
              <div>
                <div className="font-semibold text-ink">ABUkonn</div>
                <div className="text-caption text-ink-muted">ABU&apos;s Digital Campus</div>
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

          <div className="mt-8 border-t border-border pt-8 text-center text-caption text-ink-muted">
            © {new Date().getFullYear()} ABUkonn · Ahmadu Bello University, Zaria
          </div>
        </div>
      </footer>
    </div>
  );
}
