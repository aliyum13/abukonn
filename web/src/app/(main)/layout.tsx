'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV_LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/profile', label: 'Profile' },
  { href: '/messages', label: 'Messages' },
  { href: '/news', label: 'News' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/feed" className="text-xl font-bold text-[#16a34a]">
            ABUkonn
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'bg-green-50 text-[#16a34a]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!loading && user && (
              <span className="hidden md:block text-sm text-gray-500 truncate max-w-[120px]">
                {user.full_name.split(' ')[0]}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-600 font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="sm:hidden flex border-t border-gray-100">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 text-center py-2 text-xs font-medium ${
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'text-[#16a34a] border-b-2 border-[#16a34a]'
                  : 'text-gray-500'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
