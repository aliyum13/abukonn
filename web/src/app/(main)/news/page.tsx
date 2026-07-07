'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { optimizedImage } from '@/lib/image';
import { Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  author_name: string | null;
  created_at: string;
}

const CATEGORIES = ['all', 'admission', 'examination', 'faculty', 'sports', 'events', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  admission: 'Admission',
  examination: 'Examination',
  faculty: 'Faculty',
  sports: 'Sports',
  events: 'Events',
  general: 'General',
};

const CATEGORY_PILL: Record<string, string> = {
  admission: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  examination: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900',
  faculty: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-900',
  sports: 'bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900',
  events: 'bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-900',
  general: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-[#1a1a1a] dark:text-gray-400 dark:border-[#333]',
  academic: 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-950 dark:text-brand-400 dark:border-brand-900',
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function NewsItemSkeleton() {
  return (
    <div className="px-4 py-5 border-b border-gray-100 dark:border-[#222]">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-5 w-4/5 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}

// ── Individual news item ──────────────────────────────────────────────────────
function NewsItem({ article }: { article: NewsArticle }) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const PREVIEW_CHARS = 200;
  const isLong = article.content.length > PREVIEW_CHARS;

  const initials = (article.author_name || 'ABUkonn News')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const pillClass = CATEGORY_PILL[article.category?.toLowerCase()] || CATEGORY_PILL.general;

  function handleLike() {
    setLiked((v) => !v);
    setLikeCount((n) => (liked ? n - 1 : n + 1));
  }

  function handleShare() {
    const url = `${window.location.origin}/news/${article.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <article className="px-4 py-5 border-b border-gray-100 dark:border-[#222]">
      {/* Author row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold select-none">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-[#f5f5f5] leading-tight truncate">
              {article.author_name || 'ABUkonn News'}
            </p>
            <p className="text-[11px] text-gray-400 leading-tight">
              {timeAgo(article.created_at)}
            </p>
          </div>
        </div>
        {/* Menu */}
        <button className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition shrink-0">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <Link href={`/news/${article.id}`}>
        <h2 className="text-[16px] font-bold text-gray-900 dark:text-[#f5f5f5] leading-snug mb-2 hover:text-brand-700 transition">
          {article.title}
        </h2>
      </Link>

      {/* Content preview */}
      <p className="text-[14px] text-gray-600 leading-relaxed mb-1">
        {expanded || !isLong
          ? article.content
          : `${article.content.slice(0, PREVIEW_CHARS).trim()}...`}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[13px] font-medium text-brand-600 hover:text-brand-700 mb-3"
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      )}

      {/* Image */}
      {article.image_url && (
        <Link href={`/news/${article.id}`} className="block mb-3">
          <img
            src={optimizedImage(article.image_url)}
            alt={article.title}
            className="w-full rounded-xl object-cover max-h-64"
          />
        </Link>
      )}

      {/* Category tag + actions */}
      <div className="flex items-center justify-between mt-3">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize', pillClass)}>
          {article.category || 'general'}
        </span>

        <div className="flex items-center gap-4">
          {/* Like */}
          <button
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1 text-[13px] font-medium transition',
              liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            )}
          >
            <svg className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          {/* Comment — links to article */}
          <Link
            href={`/news/${article.id}`}
            className="flex items-center gap-1 text-[13px] font-medium text-gray-400 hover:text-brand-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </Link>

          {/* Share / Copy link */}
          <button
            onClick={handleShare}
            className={cn(
              'flex items-center gap-1 text-[13px] font-medium transition',
              copied ? 'text-brand-600' : 'text-gray-400 hover:text-brand-600'
            )}
          >
            {copied ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const tabsRef = useRef<HTMLDivElement>(null);

  const greeting = user
    ? (user as { username?: string; full_name?: string }).username ||
      (user as { full_name?: string }).full_name?.split(' ')[0] ||
      'there'
    : 'there';

  useEffect(() => {
    fetch(`${API_URL}/api/news`)
      .then((res) => res.json())
      .then((data) => setNews(data.news || []))
      .catch(() => setError('Failed to load news'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return news;
    return news.filter(
      (a) => (a.category || 'general').toLowerCase() === activeCategory
    );
  }, [news, activeCategory]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Personalized header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div>
          <h1 className="text-[20px] font-bold text-gray-900 dark:text-[#f5f5f5] leading-tight">
            Hello, {greeting} 👋
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Explore, collaborate, achieve</p>
        </div>
        <div className="flex items-center gap-1">
          {/* Bell */}
          <Link
            href="/notifications"
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </Link>
          {/* Search */}
          <Link
            href="/search"
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition"
            aria-label="Search"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Sticky category tabs ─────────────────────────────────────── */}
      <div
        className="sticky top-14 z-20 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#222] px-4 py-2.5"
        ref={tabsRef}
      >
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition',
                  active
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 dark:border-[#333] bg-white dark:bg-[#111] text-gray-500 dark:text-[#666] hover:border-brand-300 hover:text-brand-600'
                )}
              >
                {active && (
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      {/* ── Feed ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div>
          <NewsItemSkeleton />
          <NewsItemSkeleton />
          <NewsItemSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1a1a1a]">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-gray-700">
            No {activeCategory === 'all' ? '' : CATEGORY_LABELS[activeCategory] + ' '}news yet
          </p>
          <p className="mt-1 text-[13px] text-gray-400">
            {activeCategory === 'all'
              ? 'Check back soon for campus updates.'
              : `No ${CATEGORY_LABELS[activeCategory].toLowerCase()} articles have been posted.`}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((article) => (
            <NewsItem key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* bottom padding for mobile nav */}
      <div className="h-4" />
    </div>
  );
}
