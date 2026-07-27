'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { optimizedImage } from '@/lib/image';

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

const CATEGORY_STYLES: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-700',
  sports: 'bg-orange-100 text-orange-700',
  events: 'bg-purple-100 text-purple-700',
  general: 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-400',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function NewsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/news/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => setArticle(data.article))
      .catch(() => setError('Article not found'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-400">Loading...</div>;
  }

  if (error || !article) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">{error || 'Article not found'}</p>
        <Link href="/news" className="text-[#16a34a] font-medium hover:underline">Back to News</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="text-sm text-[#16a34a] hover:underline mb-4">
        ← Back to News
      </button>

      <article className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-[#222] shadow-sm overflow-hidden">
        {article.image_url ? (
          <button
            type="button"
            onClick={() => setLightboxUrl(article.image_url)}
            className="block w-full"
            aria-label="View full image"
          >
            <img src={optimizedImage(article.image_url)} alt={article.title} className="w-full h-56 object-cover transition hover:opacity-95" />
          </button>
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
            <span className="text-6xl font-bold text-[#16a34a]/20">ABU</span>
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_STYLES[article.category] || CATEGORY_STYLES.general}`}>
              {article.category}
            </span>
            <span className="text-xs text-gray-400">{formatDate(article.created_at)}</span>
            {article.author_name && (
              <span className="text-xs text-gray-400">· {article.author_name}</span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f5f5f5] leading-tight">{article.title}</h1>

          <div className="mt-6 text-gray-700 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </div>
        </div>
      </article>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
