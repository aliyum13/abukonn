'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { excerpt, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from '@/components/ui';

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

const CATEGORIES = ['all', 'academic', 'sports', 'events', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  academic: 'Academic',
  sports: 'Sports',
  events: 'Events',
  general: 'General',
};

const CATEGORY_VARIANT: Record<string, 'brand' | 'default' | 'success' | 'warning' | 'outline'> = {
  academic: 'brand',
  sports: 'warning',
  events: 'success',
  general: 'outline',
};

function NewsCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-44 w-full rounded-none" />
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  useEffect(() => {
    fetch(`${API_URL}/api/news`)
      .then((res) => res.json())
      .then((data) => setNews(data.news || []))
      .catch(() => setError('Failed to load news'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      activeCategory === 'all'
        ? news
        : news.filter((a) => a.category === activeCategory),
    [news, activeCategory]
  );

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-display-sm text-ink sm:text-display-md">Campus News</h1>
        <p className="mt-2 text-body-sm text-ink-secondary sm:text-body-md">
          Latest updates from Ahmadu Bello University
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">
          {error}
        </div>
      )}

      {/* Category tabs */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-body-sm font-medium transition',
              activeCategory === cat
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-white text-ink-secondary border border-border hover:border-brand-300 hover:text-brand-700'
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-72 w-full rounded-2xl sm:h-80" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <NewsCardSkeleton />
            <NewsCardSkeleton />
            <NewsCardSkeleton />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No news articles"
            description={
              activeCategory === 'all'
                ? 'Check back soon for campus updates and announcements.'
                : `No ${CATEGORY_LABELS[activeCategory].toLowerCase()} articles yet.`
            }
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            }
          />
        </Card>
      ) : (
        <>
          {/* Featured hero */}
          {featured && (
            <Link href={`/news/${featured.id}`} className="group mb-8 block">
              <Card className="overflow-hidden transition hover:shadow-elevated">
                <div className="grid md:grid-cols-2">
                  {featured.image_url ? (
                    <img
                      src={featured.image_url}
                      alt={featured.title}
                      className="h-56 w-full object-cover md:h-80"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 md:h-80">
                      <span className="text-5xl font-bold text-white/20">ABU</span>
                    </div>
                  )}
                  <CardContent className="flex flex-col justify-center p-6 sm:p-8">
                    <Badge variant={CATEGORY_VARIANT[featured.category] || 'outline'} className="mb-3 w-fit capitalize">
                      {featured.category}
                    </Badge>
                    <h2 className="text-display-sm text-ink transition group-hover:text-brand-600 sm:text-display-md">
                      {featured.title}
                    </h2>
                    <p className="mt-3 line-clamp-3 text-body-sm text-ink-secondary sm:text-body-md">
                      {excerpt(featured.content, 200)}
                    </p>
                    <div className="mt-4 flex items-center gap-3 text-caption text-ink-muted">
                      <span>{formatDate(featured.created_at)}</span>
                      {featured.author_name && <span>· {featured.author_name}</span>}
                    </div>
                  </CardContent>
                </div>
              </Card>
            </Link>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((article) => (
                <Link key={article.id} href={`/news/${article.id}`} className="group">
                  <Card className="h-full overflow-hidden transition hover:border-brand-200 hover:shadow-card">
                    {article.image_url ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                        <span className="text-3xl font-bold text-brand-600/20">ABU</span>
                      </div>
                    )}
                    <CardContent className="p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={CATEGORY_VARIANT[article.category] || 'outline'} className="capitalize">
                          {article.category}
                        </Badge>
                        <span className="text-caption text-ink-muted">
                          {formatDate(article.created_at)}
                        </span>
                      </div>
                      <h3 className="line-clamp-2 font-semibold text-ink transition group-hover:text-brand-600">
                        {article.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-body-sm text-ink-secondary">
                        {excerpt(article.content)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
