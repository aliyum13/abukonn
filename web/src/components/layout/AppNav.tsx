'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Button } from '@/components/ui';
import { excerpt, timeAgo } from '@/lib/format';
import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const NAV_LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/news', label: 'News' },
  { href: '/messages', label: 'Messages' },
  { href: '/profile', label: 'Profile' },
];

interface SearchUser {
  id: number;
  full_name: string;
  matric_number: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
}

interface SearchPost {
  id: number;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_id: number;
  author_name: string;
  author_department: string;
  author_photo: string | null;
}

interface SearchResults {
  users: SearchUser[];
  posts: SearchPost[];
}

interface AppNotification {
  id: number;
  type: 'like' | 'comment' | 'follow';
  post_id: number | null;
  is_read: boolean;
  created_at: string;
  sender_id: number;
  sender_name: string;
  sender_photo: string | null;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function AppNav() {
  const { user, token, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Message unread count
  const [msgUnreadCount, setMsgUnreadCount] = useState(0);

  const fetchMsgUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMsgUnreadCount(data.count ?? 0);
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchMsgUnreadCount();
    const id = setInterval(fetchMsgUnreadCount, 30_000);
    return () => clearInterval(id);
  }, [token, fetchMsgUnreadCount]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // ── Notification helpers ────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // silent
    }
  }, [token]);

  // Poll unread count every 30 s
  useEffect(() => {
    if (!token) return;
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(id);
  }, [token, fetchUnreadCount]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifList(data.notifications);
      }
    } catch {
      // silent
    } finally {
      setNotifLoading(false);
    }
  }, [token]);

  const handleBellClick = () => {
    if (!notifOpen) fetchNotifications();
    setNotifOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifList((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleNotifClick = async (notif: AppNotification) => {
    if (!token) return;
    if (!notif.is_read) {
      fetch(`${API_URL}/api/notifications/${notif.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      setNotifList((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifOpen(false);
    if (notif.type === 'follow') {
      router.push(`/profile/${notif.sender_id}`);
    } else if (notif.type === 'comment' && notif.post_id) {
      router.push(`/feed?openComments=${notif.post_id}`);
    } else {
      router.push('/feed');
    }
  };

  const notifMessage = (n: AppNotification) => {
    if (n.type === 'follow') return `${n.sender_name} started following you`;
    if (n.type === 'like') return `${n.sender_name} liked your post`;
    return `${n.sender_name} commented on your post`;
  };

  // Close notification panel on click outside
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    setResults(null);
  };

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !token) {
        setResults(null);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(q)}&type=all`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    },
    [token]
  );

  // Debounce: fire search 300ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Close on click outside
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  // Close search / notification panel on Escape
  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        closeSearch();
        setNotifOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      closeSearch();
    }
  };

  const goToSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      closeSearch();
    }
  };

  const hasResults =
    results && (results.users.length > 0 || results.posts.length > 0);
  const showDropdown = searchOpen && query.trim().length > 0;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo — hide on mobile when search is open */}
        <Link
          href="/feed"
          className={`flex shrink-0 items-center gap-2 ${searchOpen ? 'hidden sm:flex' : 'flex'}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            AB
          </div>
          <span className="hidden text-lg font-bold text-ink sm:block">ABUkonn</span>
        </Link>

        {/* Desktop nav links — hide when search open */}
        {!searchOpen && (
          <div className="hidden flex-1 items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-xl px-3.5 py-2 text-body-sm font-medium transition ${
                  isActive(link.href)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                }`}
              >
                {link.label}
                {link.href === '/messages' && msgUnreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {msgUnreadCount > 9 ? '9+' : msgUnreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Search bar (expands inline) */}
        <div
          ref={searchRef}
          className={`relative ${searchOpen ? 'flex-1' : 'ml-auto'} flex items-center`}
        >
          {searchOpen ? (
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search students, posts…"
                className="h-9 w-full rounded-xl border border-border bg-surface-muted pl-9 pr-4 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-secondary transition hover:bg-surface-subtle hover:text-ink"
              aria-label="Search"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          )}

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute left-0 top-full z-[60] mt-2 w-full min-w-[320px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
              {searching && !results ? (
                <div className="flex items-center justify-center py-8 text-body-sm text-ink-muted">
                  Searching…
                </div>
              ) : !hasResults ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <SearchIcon className="mb-2 h-7 w-7 text-ink-muted" />
                  <p className="text-body-sm font-medium text-ink">No results found</p>
                  <p className="mt-0.5 text-caption text-ink-muted">
                    Try a different name or keyword
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {/* Users section */}
                  {results.users.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-caption font-semibold uppercase tracking-wider text-ink-muted">
                        Students
                      </p>
                      {results.users.map((u) => (
                        <Link
                          key={u.id}
                          href={`/profile/${u.id}`}
                          onClick={closeSearch}
                          className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-muted"
                        >
                          <Avatar
                            src={u.profile_photo_url}
                            name={u.full_name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-ink">
                              {u.full_name}
                            </p>
                            <p className="truncate text-caption text-ink-muted">
                              {u.department}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  {results.users.length > 0 && results.posts.length > 0 && (
                    <div className="my-1 border-t border-border" />
                  )}

                  {/* Posts section */}
                  {results.posts.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-caption font-semibold uppercase tracking-wider text-ink-muted">
                        Posts
                      </p>
                      {results.posts.map((p) => (
                        <Link
                          key={p.id}
                          href="/feed"
                          onClick={closeSearch}
                          className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-surface-muted"
                        >
                          <Avatar
                            src={p.author_photo}
                            name={p.author_name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-body-sm font-medium text-ink">
                              {p.author_name}
                              <span className="ml-1.5 font-normal text-ink-muted">
                                · {timeAgo(p.created_at)}
                              </span>
                            </p>
                            <p className="mt-0.5 truncate text-caption text-ink-secondary">
                              {excerpt(p.content, 80)}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* See all results */}
                  <button
                    type="button"
                    onClick={goToSearch}
                    className="w-full border-t border-border px-4 py-3 text-center text-body-sm font-medium text-brand-600 transition hover:bg-brand-50"
                  >
                    See all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close button when search is open */}
        {searchOpen && (
          <button
            type="button"
            onClick={closeSearch}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-secondary transition hover:bg-surface-subtle"
            aria-label="Close search"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}

        {/* Right side: bell + avatar + logout */}
        {!searchOpen && (
          <div className="flex shrink-0 items-center gap-2">
            {/* Notification bell */}
            {!loading && user && (
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={handleBellClick}
                  aria-label="Notifications"
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-secondary transition hover:bg-surface-subtle hover:text-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                {notifOpen && (
                  <div className="absolute right-0 top-full z-[60] mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-72 overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <h3 className="font-semibold text-ink">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-caption font-medium text-brand-600 hover:text-brand-700"
                          >
                            Mark all read
                          </button>
                        )}
                        <Link
                          href="/notifications"
                          onClick={() => setNotifOpen(false)}
                          className="text-caption font-medium text-ink-muted hover:text-ink"
                        >
                          See all
                        </Link>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="max-h-[380px] overflow-y-auto">
                      {notifLoading ? (
                        <div className="space-y-0">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-3">
                              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-muted" />
                              <div className="flex-1 space-y-1.5 pt-1">
                                <div className="h-3 w-48 animate-pulse rounded bg-surface-muted" />
                                <div className="h-2.5 w-24 animate-pulse rounded bg-surface-muted" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : notifList.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-center">
                          <svg className="mb-2 h-8 w-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                          </svg>
                          <p className="text-body-sm text-ink-muted">No notifications yet</p>
                        </div>
                      ) : (
                        notifList.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleNotifClick(n)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-muted ${!n.is_read ? 'bg-brand-50/60' : ''}`}
                          >
                            <div className="relative shrink-0">
                              <Avatar src={n.sender_photo} name={n.sender_name} size="sm" />
                              {!n.is_read && (
                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-body-sm text-ink leading-snug">
                                {notifMessage(n)}
                              </p>
                              <p className="mt-0.5 text-caption text-ink-muted">{timeAgo(n.created_at)}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
        )}
      </div>

      {/* Mobile bottom tab bar */}
      <div className="flex border-t border-border md:hidden">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`relative flex-1 py-2.5 text-center text-caption font-medium ${
              isActive(link.href)
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-ink-muted'
            }`}
          >
            {link.label}
            {link.href === '/messages' && msgUnreadCount > 0 && (
              <span className="absolute right-3 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {msgUnreadCount > 9 ? '9+' : msgUnreadCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
