import { useEffect, useMemo, useState } from 'react';
import type { NewsArticle } from './types';

type FetchState = 'idle' | 'loading' | 'error' | 'success';

const useNewsFeed = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [status, setStatus] = useState<FetchState>('idle');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setStatus('loading');
      try {
        const response = await fetch('/api/news', { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Failed to load news feed');
        }
        const payload = await response.json();
        setArticles(Array.isArray(payload.articles) ? payload.articles : []);
        setStatus('success');
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Unable to load news feed', error);
          setStatus('error');
        }
      }
    };

    load();

    return () => controller.abort();
  }, []);

  const flags = useMemo(
    () => ({
      isLoading: status === 'loading' || status === 'idle',
      isError: status === 'error',
    }),
    [status],
  );

  return {
    articles,
    ...flags,
  };
};

export default useNewsFeed;
