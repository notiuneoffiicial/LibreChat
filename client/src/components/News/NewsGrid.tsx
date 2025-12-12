
import React, { useEffect, useState } from 'react';
import type { NewsArticle } from './newsData';
import { useRecoilState } from 'recoil';
import store from '~/store';
import { useLocalize } from '~/hooks';

const NewsGrid = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsView, setNewsView] = useRecoilState(store.newsViewActive);
  const localize = useLocalize();

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
    // Logic to start a new chat about this article
    // For now we just log it, but ideally this would create a new conversation 
    // and switch the view back to chat mode with the context pre-loaded.
    console.log('Chat about:', article.title);

    // Switch to char view? Or keep in news view but open a drawer?
    // Request asked for a chat box inside news tab. 
    // For this MVP, let's keep it simple: We might want to switch back to chat view 
    // but prepopulate the input or a system message.

    // setNewsView(false); // Switch back to chat
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-text-secondary">Loading news...</div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4">
      {articles.map((article, i) => (
        <article
          key={i}
          className="flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary shadow-sm transition hover:-translate-y-1 hover:shadow-md"
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
              <a href={article.link} target="_blank" rel="noreferrer" className="hover:text-accent-primary focus:outline-none">
                {article.title}
              </a>
            </h3>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-text-secondary line-clamp-3">
              {article.summary}
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-border-light">
              <a
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-text-tertiary hover:text-text-primary transition-colors"
              >
                Read Source
              </a>
              <button
                onClick={() => handleChatAbout(article)}
                className="rounded-lg bg-accent-primary/10 px-3 py-1.5 text-xs font-semibold text-accent-primary hover:bg-accent-primary/20 transition-colors"
              >
                Chat about this
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default NewsGrid;
