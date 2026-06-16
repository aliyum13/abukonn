'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Button } from '@/components/ui';

const NAV_LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/profile', label: 'Profile' },
  { href: '/messages', label: 'Messages' },
  { href: '/news', label: 'News' },
];

export function AppNav() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/feed" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            AB
          </div>
          <span className="text-lg font-bold text-ink">ABUkonn</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3.5 py-2 text-body-sm font-medium transition ${
                isActive(link.href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!loading && user && (
            <Link href="/profile" className="hidden items-center gap-2 sm:flex">
              <Avatar
                src={user.profile_photo_url}
                name={user.full_name}
                size="sm"
              />
              <span className="hidden max-w-[100px] truncate text-body-sm text-ink-secondary lg:block">
                {user.full_name.split(' ')[0]}
              </span>
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="flex border-t border-border md:hidden">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex-1 py-2.5 text-center text-caption font-medium ${
              isActive(link.href)
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-ink-muted'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
