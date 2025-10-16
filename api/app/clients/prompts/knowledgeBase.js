const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const {
  RAG_KB_GLOBAL_SCOPE,
  RAG_KB_GLOBAL_LABEL = 'global',
  RAG_KB_USER_SCOPE_PREFIX,
  RAG_KB_USER_LABEL = 'user',
  RAG_KB_TOP_K_GLOBAL,
  RAG_KB_TOP_K_USER,
} = process.env;

const DEFAULT_TOP_K = 4;

const parseTopK = (value, fallback = DEFAULT_TOP_K) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const getScopeConfigs = (userId) => {
  const scopes = [];

  if (RAG_KB_GLOBAL_SCOPE) {
    scopes.push({
      name: 'global',
      label: RAG_KB_GLOBAL_LABEL,
      store: RAG_KB_GLOBAL_SCOPE,
      topK: parseTopK(RAG_KB_TOP_K_GLOBAL),
    });
  }

  if (RAG_KB_USER_SCOPE_PREFIX && userId) {
    scopes.push({
      name: 'user',
      label: RAG_KB_USER_LABEL,
      store: `${RAG_KB_USER_SCOPE_PREFIX}:${userId}`,
      topK: parseTopK(RAG_KB_TOP_K_USER),
    });
  }

  return scopes;
};

const normalizeResults = (results) => {
  if (!results) {
    return [];
  }

  if (Array.isArray(results)) {
    return results;
  }

  if (Array.isArray(results.hits)) {
    return results.hits;
  }

  if (Array.isArray(results.results)) {
    return results.results;
  }

  if (Array.isArray(results.documents)) {
    return results.documents;
  }

  if (Array.isArray(results.items)) {
    return results.items;
  }

  return [];
};

const sanitize = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\u0000/g, '').trim();
};

const computeRelevance = (item) => {
  const { score, similarity, distance } = item ?? {};
  if (typeof similarity === 'number') {
    return Math.max(0, Math.min(1, similarity));
  }

  if (typeof score === 'number') {
    if (score > 1) {
      return Math.max(0, Math.min(1, 1 / (1 + score)));
    }
    return Math.max(0, Math.min(1, score));
  }

  if (typeof distance === 'number') {
    const relevance = 1 - distance;
    if (Number.isFinite(relevance)) {
      return Math.max(0, Math.min(1, relevance));
    }
  }

  return null;
};

const extractContent = (item) => {
  if (!item) {
    return '';
  }

  if (typeof item === 'string') {
    return sanitize(item);
  }

  if (typeof item.page_content === 'string') {
    return sanitize(item.page_content);
  }

  if (typeof item.content === 'string') {
    return sanitize(item.content);
  }

  if (typeof item.text === 'string') {
    return sanitize(item.text);
  }

  return '';
};

const extractMetadata = (item) => {
  const metadata = typeof item?.metadata === 'object' && item.metadata !== null ? item.metadata : {};
  const source = metadata.title || metadata.source || metadata.path || metadata.filepath;
  const url = metadata.url || metadata.href || null;

  return { source: sanitize(source), url: sanitize(url), metadata };
};

async function queryKnowledgeBases({ query, jwtToken, userId }) {
  if (!process.env.RAG_API_URL) {
    return [];
  }

  const scopes = getScopeConfigs(userId);
  if (scopes.length === 0) {
    return [];
  }

  if (!query || !jwtToken) {
    return [];
  }

  try {
    const payloadScopes = scopes.map((scope) => ({
      name: scope.name,
      store: scope.store,
      k: scope.topK,
    }));

    const response = await axios.post(
      `${process.env.RAG_API_URL}/kb/query`,
      {
        query,
        scopes: payloadScopes,
      },
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response?.data ?? {};

    return scopes.map((scope) => {
      let scopeResults =
        data?.[scope.name] ??
        data?.[scope.store] ??
        data?.scopes?.[scope.name] ??
        data?.scopes?.[scope.store] ??
        data?.results?.[scope.name] ??
        data?.results?.[scope.store];

      if (!scopeResults && Array.isArray(data?.results)) {
        const match = data.results.find(
          (entry) => entry?.name === scope.name || entry?.store === scope.store,
        );
        scopeResults = match?.items ?? match?.results ?? match?.documents ?? match;
      }

      if (!scopeResults && Array.isArray(data?.scopes)) {
        const match = data.scopes.find(
          (entry) => entry?.name === scope.name || entry?.store === scope.store,
        );
        scopeResults = match?.items ?? match?.results ?? match?.documents ?? match;
      }

      const items = normalizeResults(scopeResults).map((item) => {
        const content = extractContent(item);
        if (!content) {
          return null;
        }

        const relevance = computeRelevance(item);
        const { source, url, metadata } = extractMetadata(item);

        return {
          content,
          relevance,
          source: source || null,
          url: url || null,
          metadata,
        };
      });

      return {
        name: scope.name,
        label: scope.label,
        store: scope.store,
        items: items.filter(Boolean),
      };
    });
  } catch (error) {
    logger.error('Error querying knowledge bases:', error);
    return [];
  }
}

const formatKnowledgePrompt = (scopedResults) => {
  if (!Array.isArray(scopedResults) || scopedResults.length === 0) {
    return '';
  }

  const sections = scopedResults
    .map((scope) => {
      if (!scope?.items?.length) {
        return '';
      }

      const entries = scope.items
        .map((item, index) => {
          const lines = [];
          const rank = index + 1;
          const scopeLabel = sanitize(scope.label || scope.name);
          const confidence =
            typeof item.relevance === 'number' ? ` confidence="${item.relevance.toFixed(3)}"` : '';

          lines.push(`  <entry scope="${scopeLabel}" rank="${rank}"${confidence}>`);
          if (item.source) {
            lines.push(`    <source>${item.source}</source>`);
          }
          if (item.url) {
            lines.push(`    <url>${item.url}</url>`);
          }
          lines.push(`    <content><![CDATA[${item.content}]]></content>`);
          lines.push('  </entry>');

          return lines.join('\n');
        })
        .filter(Boolean)
        .join('\n');

      if (!entries) {
        return '';
      }

      const scopeLabel = sanitize(scope.label || scope.name);
      return `<knowledge scope="${scopeLabel}">\n${entries}\n</knowledge>`;
    })
    .filter(Boolean)
    .join('\n\n');

  if (!sections) {
    return '';
  }

  return `Relevant knowledge base excerpts:\n${sections}`;
};

module.exports = {
  queryKnowledgeBases,
  formatKnowledgePrompt,
};

