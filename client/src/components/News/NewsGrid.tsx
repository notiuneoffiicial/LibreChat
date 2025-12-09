import type { NewsArticle } from './types';

type NewsGridProps = {
  articles: NewsArticle[];
};

const NewsGrid = ({ articles }: NewsGridProps) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => (
        <article
          key={article.link || article.title}
          className="flex h-full flex-col rounded-xl border border-border-light bg-surface-primary p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            <span className="text-text-secondary">{article.category}</span>
            <span className="truncate text-text-tertiary">{article.source}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-text-primary">{article.title}</h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary">{article.summary}</p>
          <a
            className="mt-4 inline-flex items-center text-sm font-semibold text-accent-primary hover:text-accent-primary/80"
            href={article.link}
            target="_blank"
            rel="noreferrer"
          >
            Read more
            <span aria-hidden className="ml-1">
              →
            </span>
          </a>
        </article>
      ))}
    </div>
  );
};

export default NewsGrid;
