# Positive news feed overview

This feature turns external RSS/Atom feeds into a positivity-filtered feed that both the API and client can consume.

## How it works
- `scripts/news/generateFeed.js` fetches each comma-separated URL in `NEWS_RSS_FEEDS`, parses the feed, and normalizes common fields (title, link, publisher, category, date).
- Each article is summarized with a concise, optimism-focused LLM prompt via `NEWS_SUMMARY_API_KEY`/`NEWS_SUMMARY_MODEL`; items flagged as non-positive are skipped.
- The resulting articles are cached as JSON at `NEWS_OUTPUT_PATH` (defaults to `api/data/news-feed.json`). When no feeds are configured, a small built-in fallback feed is used so the UI never goes empty.
- The Express route `GET /api/news` serves `{ articles }` from disk; add `?refresh=true` to force regeneration on demand. Authentication is optional, matching the `optionalJwtAuth` middleware.
- The client’s Chat view now has a **News** toggle that calls `/api/news` via `useNewsFeed`, showing loading, error, or empty states before rendering the grid.

## Configuration
Set any of the following in your `.env` (see `.env.example` for commented templates):

- `NEWS_RSS_FEEDS`: Comma-separated RSS/Atom feed URLs.
- `NEWS_SUMMARY_API_KEY`: Key for the summarization model provider; if omitted, existing summaries are reused and all items are treated as positive.
- `NEWS_SUMMARY_MODEL`: Model name for the summarization prompt (default: `gpt-4o-mini`).
- `NEWS_SUMMARY_API_BASE`: Base URL for the summarization API (default: OpenAI v1).
- `NEWS_OUTPUT_PATH`: Destination JSON file for the cached feed (default: `api/data/news-feed.json`).
- `NEWS_MAX_ARTICLES`: Limit the number of fetched items before summarization (default: `12`).

## Running it manually or on a schedule
Use the provided script to generate (or refresh) the feed and write it to disk:

```bash
npm run news:refresh
```

You can wire this into a cron job or task scheduler; the `/api/news?refresh=true` query parameter triggers the same regeneration path if you prefer to refresh from a request.
