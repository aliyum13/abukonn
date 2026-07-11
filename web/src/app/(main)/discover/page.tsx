'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, VerifiedBadge, ContentCreatorBadge, RoleBadge, Button } from '@/components/ui';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/context/AuthContext';
import { formatLevel } from '@/lib/format';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Person {
  id: number;
  full_name: string;
  username: string | null;
  department: string | null;
  level: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  role: string;
  is_verified: boolean;
  is_content_creator: boolean;
  is_admin: boolean;
  followers_count: number;
  is_following: boolean;
}

interface Section {
  key: string;
  title: string;
  people: Person[];
}

type Tab = 'discover' | 'following';

export default function DiscoverPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('discover');
  const [sections, setSections] = useState<Section[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load discover sections
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/api/follows/discover`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSections(d.sections || []))
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, [token]);

  // Load following list when that tab is opened
  const loadFollowing = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/api/follows/following`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setFollowing(d.following || []))
      .catch(() => setFollowing([]));
  }, [token]);

  useEffect(() => {
    if (tab === 'following') loadFollowing();
  }, [tab, loadFollowing]);

  // Debounced search
  const onSearchChange = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/follows/search?q=${encodeURIComponent(value.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur dark:border-[#222] dark:bg-[#0a0a0a]/90">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-ink-muted" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-[18px] font-bold text-ink">Discover People</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-muted/50 px-3 py-2 dark:border-[#222] dark:bg-[#1a1a1a]">
            <svg className="h-4 w-4 shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={query}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search people by name or username"
              className="w-full bg-transparent text-[14px] text-ink outline-none"
            />
            {query.length > 0 && (
              <button onClick={() => onSearchChange('')} className="text-ink-muted" aria-label="Clear">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs (hidden while searching) */}
        {searchResults === null && (
          <div className="flex">
            {(['discover', 'following'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 border-b-2 py-2.5 text-[14px] font-semibold capitalize transition',
                  tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-muted hover:text-ink'
                )}
              >
                {t === 'following' ? 'Following' : 'Discover'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search results take over the body when active */}
      {searchResults !== null ? (
        <div className="px-4 py-3">
          {searching ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">No people found for “{query}”</p>
          ) : (
            searchResults.map(p => <PersonRow key={p.id} person={p} token={token} />)
          )}
        </div>
      ) : tab === 'following' ? (
        <div className="px-4 py-3">
          {following.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-[15px] text-ink">You&apos;re not following anyone yet</p>
              <p className="mt-1 text-[14px] text-ink-muted">Switch to Discover to find people.</p>
            </div>
          ) : (
            following.map(p => <PersonRow key={p.id} person={{ ...p, is_following: true }} token={token} />)
          )}
        </div>
      ) : loading ? (
        <p className="py-12 text-center text-[13px] text-ink-muted">Loading people…</p>
      ) : sections.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-semibold text-[15px] text-ink">No suggestions right now</p>
          <p className="mt-1 text-[14px] text-ink-muted">Check back as more students join.</p>
        </div>
      ) : (
        sections.map(section => (
          <div key={section.key} className="border-b border-border py-2 dark:border-[#222]">
            <h2 className="px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-ink-muted">{section.title}</h2>
            {section.people.map(p => <PersonRow key={p.id} person={p} token={token} />)}
          </div>
        ))
      )}
    </div>
  );
}

function PersonRow({ person, token }: { person: Person; token: string | null }) {
  const { isFollowing, loading, toggle } = useFollow(person.id, person.is_following, 0, token);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={`/profile/${person.id}`} className="shrink-0">
        <Avatar src={person.profile_photo_url} name={person.full_name} size="md" />
      </Link>
      <Link href={`/profile/${person.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[14px] font-semibold text-ink">{person.full_name}</span>
          <VerifiedBadge verified={person.is_verified} />
          <RoleBadge role={person.role} iconOnly />
          <ContentCreatorBadge isCreator={person.is_content_creator} iconOnly />
        </div>
        <p className="truncate text-[12px] text-ink-muted">
          {person.department}{person.level ? ` · ${formatLevel(person.level)}` : ''}
          {person.followers_count > 0 ? ` · ${person.followers_count} follower${person.followers_count === 1 ? '' : 's'}` : ''}
        </p>
      </Link>
      <Button
        variant={isFollowing ? 'outline' : 'primary'}
        size="sm"
        onClick={toggle}
        loading={loading}
        className="shrink-0"
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}
