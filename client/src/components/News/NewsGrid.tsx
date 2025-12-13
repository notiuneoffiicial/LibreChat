
import React, { useEffect, useState } from 'react';
import type { NewsArticle } from './newsData';
import { useRecoilState } from 'recoil';
import store from '~/store';
import { useLocalize } from '~/hooks';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';
import ChatForm from '../Chat/Input/ChatForm';
import { useChatContext } from '~/Providers';
import NewsReader from './NewsReader';

const NewsGrid = () => {
  const [articles, setArticles] = useState<(NewsArticle & { content?: string, pubDate?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<(NewsArticle & { content?: string, pubDate?: string }) | null>(null);

  const { setFiles } = useChatContext();

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

  const openReader = (article: NewsArticle & { content?: string }) => {
    setSelectedArticle(article);
    setFiles(new Map());
  };

  const closeReader = () => {
    setSelectedArticle(null);
    setFiles(new Map());
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-text-secondary">Loading news...</div>
      </div>
    );
  }

  // Configure DOMPurify to strip images
  const cleanContent = (html: string) => {
    return DOMPurify.sanitize(html, { FORBID_TAGS: ['img'] });
  };

  return (
    <div className="relative h-full">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 p-4 overflow-y-auto h-full pb-20">
        {articles.map((article, i) => (
          <article
            key={i}
            className="flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary shadow-sm transition hover:-translate-y-1 hover:shadow-md cursor-pointer"
            onClick={() => openReader(article)}
          >

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
          </article>
        ))}
      </div>

      {/* Reader Modal */}
      {selectedArticle && (
        <NewsReader
          article={selectedArticle}
          onClose={closeReader}
        />
      )}
    </div>
  );
};

export default NewsGrid;
