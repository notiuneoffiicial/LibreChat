
import React, { useEffect, useState } from 'react';
import type { NewsArticle } from './newsData';
import { useRecoilState } from 'recoil';
import store from '~/store';
import { useLocalize } from '~/hooks';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';

const NewsGrid = () => {
  const [articles, setArticles] = useState<(NewsArticle & { content?: string, pubDate?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<(NewsArticle & { content?: string, pubDate?: string }) | null>(null);

  useEffect(() => {
    // Fetch news from backend
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        const data = await res.json();
        setArticles(data.articles || []);
      } catch (err) {
        console.error('Failed to fetch news', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const handleChatAbout = (article: NewsArticle) => {
    console.log('Chat about:', article.title);
    // Future integration point: Create new conversation with context
  };

  const openReader = (article: NewsArticle) => {
    setSelectedArticle(article);
  };

  const closeReader = () => {
    setSelectedArticle(null);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-text-secondary">Loading news...</div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 p-4 overflow-y-auto h-full">
        {articles.map((article, i) => (
          <article
            key={i}
            className="flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary shadow-sm transition hover:-translate-y-1 hover:shadow-md cursor-pointer"
            onClick={() => openReader(article)}
          >
            {article.image && (
              <div className="relative h-48 w-full overflow-hidden">
                <img
                  src={article.image}
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                <span className="text-accent-primary">{article.category}</span>
                <span className="truncate">{article.source}</span>
              </div>
              <h3 className="mb-2 text-lg font-bold leading-tight text-text-primary">
                {article.title}
              </h3>
              <p className="mb-4 flex-1 text-sm leading-relaxed text-text-secondary line-clamp-3">
                {article.summary}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border-light text-xs text-text-tertiary">
                <span>{article.pubDate ? new Date(article.pubDate).toLocaleDateString() : ''}</span>
              </div>
            </div>
            <div className="p-4 pt-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleChatAbout(article);
                }}
                className="w-full rounded-lg bg-accent-primary/10 px-3 py-2 text-xs font-semibold text-accent-primary hover:bg-accent-primary/20 transition-colors"
              >
                Chat about this
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Reader Modal */}
      {selectedArticle && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200">
          <div className="relative flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface-primary shadow-2xl ring-1 ring-black/5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-text-primary line-clamp-1" title={selectedArticle.title}>
                  {selectedArticle.title}
                </h2>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-medium text-accent-primary">{selectedArticle.source}</span>
                  <span>•</span>
                  <span>{selectedArticle.pubDate ? new Date(selectedArticle.pubDate).toLocaleDateString() : ''}</span>
                </div>
              </div>
              <button
                onClick={closeReader}
                className="rounded-full p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              {selectedArticle.image && (
                <img
                  src={selectedArticle.image}
                  alt={selectedArticle.title}
                  className="mb-8 h-64 w-full rounded-xl object-cover shadow-sm md:h-96"
                />
              )}

              <div
                className="prose prose-lg dark:prose-invert max-w-none text-text-primary"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(selectedArticle.content || selectedArticle.summary || '')
                }}
              />

              <div className="mt-10 flex justify-center border-t border-border-light pt-8">
                <a
                  href={selectedArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:underline font-semibold"
                >
                  Read full article on original site
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsGrid;
