'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  general: 'bg-gray-100 text-gray-700',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function excerpt(content: string, max = 120) {
  if (content.length <= max) return content;
  return content.slice(0, max).trim() + '...';
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/news`)
      .then((res) => res.json())
      .then((data) => setNews(data.news || []))
      .catch(() => setError('Failed to load news'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campus News</h1>
        <p className="text-gray-500 text-sm mt-1">Latest updates from Ahmadu Bello University</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg mb-4">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading news...</p>
      ) : news.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No news articles yet</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {news.map((article) => (
            <Link
              key={article.id}
              href={`/news/${article.id}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-green-200 transition group"
            >
              {article.image_url ? (
                <img src={article.image_url} alt={article.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                  <span className="text-4xl font-bold text-[#16a34a]/20">ABU</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_STYLES[article.category] || CATEGORY_STYLES.general}`}>
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(article.created_at)}</span>
                </div>
                <h2 className="font-semibold text-gray-900 group-hover:text-[#16a34a] transition line-clamp-2">
                  {article.title}
                </h2>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{excerpt(article.content)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
