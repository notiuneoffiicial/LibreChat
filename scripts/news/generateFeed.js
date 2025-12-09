const fs = require('fs');
const path = require('path');
const getLogger = () => {
  try {
    const { logger } = require('@librechat/data-schemas');
    return logger;
  } catch (error) {
    console.warn('Falling back to console logging for news feed generation', error);
    return console;
  }
};

const logger = getLogger();

const {
  NEWS_API_ENDPOINTS,
  NEWS_API_KEY,
  NEWS_SUMMARY_API_KEY,
  NEWS_SUMMARY_API_BASE,
  NEWS_SUMMARY_MODEL,
  NEWS_OUTPUT_PATH,
  NEWS_MAX_ARTICLES,
} = process.env ?? {};

const defaultOutputPath = path.resolve(__dirname, '../../api/data/news-feed.json');
const maxArticles = Number(NEWS_MAX_ARTICLES) || 12;
const summaryModel = NEWS_SUMMARY_MODEL || 'gpt-4o-mini';
const summaryApiBase = NEWS_SUMMARY_API_BASE || 'https://api.openai.com/v1';

const fallbackArticles = [
  {
    title: 'Cities Turn Rooftops Into Renewable Microgrids',
    source: 'The Verge',
    category: 'Climate',
    summary:
      'A coalition of cities is piloting solar-plus-storage rooftops that can share excess energy with neighbors during heatwaves.',
    link: 'https://www.theverge.com/2024/06/21/solar-microgrids-city-rooftops',
  },
  {
    title: 'Researchers Build Affordable Direct-Air Capture Filters',
    source: 'Science Daily',
    category: 'Innovation',
    summary:
      'New modular filters capture carbon dioxide at a fraction of current costs, paving the way for community-scale deployments.',
    link: 'https://www.sciencedaily.com/releases/2024/06/240621141515.htm',
  },
  {
    title: 'Ocean Cleanup Nets Remove Record Plastic Hauls',
    source: 'BBC Future',
    category: 'Environment',
    summary:
      'A fleet of autonomous cleanup vessels has cleared thousands of kilograms of ocean plastic ahead of schedule.',
    link: 'https://www.bbc.com/future/article/20240620-ocean-cleanup-record',
  },
  {
    title: 'Rural Clinics Use AI Triage to Cut Wait Times by 30%',
    source: 'Wired',
    category: 'Health',
    summary:
      'Small clinics are adopting lightweight AI triage tools that prioritize urgent cases and free clinicians to spend more time with patients.',
    link: 'https://www.wired.com/story/rural-clinics-ai-triage-wait-times',
  },
  {
    title: 'Community Libraries Launch Free Repair Cafés',
    source: 'NPR',
    category: 'Community',
    summary:
      'Volunteer-led repair events in public libraries are keeping electronics and bikes out of landfills while teaching hands-on skills.',
    link: 'https://www.npr.org/2024/06/22/repair-cafe-libraries',
  },
  {
    title: 'Urban Farms Deliver Fresh Produce Within Hours of Harvest',
    source: 'Fast Company',
    category: 'Food',
    summary:
      'Hydroponic farms inside repurposed warehouses are partnering with local grocers to offer ultra-fresh greens with minimal transport emissions.',
    link: 'https://www.fastcompany.com/91011234/urban-farms-fresh-produce',
  },
  {
    title: 'Open-Source Prosthetics Program Expands Globally',
    source: 'Reuters',
    category: 'Accessibility',
    summary:
      'A volunteer network is sharing 3D-printable prosthetic designs, enabling clinics in 20+ countries to deliver customized limbs within days.',
    link: 'https://www.reuters.com/world/open-source-prosthetics-program-2024-06-23',
  },
  {
    title: 'Schools Add Mindfulness Walks Between Classes',
    source: 'Edutopia',
    category: 'Education',
    summary:
      'K-12 schools are carving out short nature walks that improve focus and reduce stress, supported by teachers and counselors.',
    link: 'https://www.edutopia.org/article/mindfulness-walks-school-day',
  },
  {
    title: 'Transit Agencies Pilot Fare-Free Weekends to Boost Ridership',
    source: 'Bloomberg CityLab',
    category: 'Mobility',
    summary:
      'Cities are testing free transit on weekends to reduce congestion and give residents affordable access to downtown events.',
    link: 'https://www.bloomberg.com/citylab/2024-fare-free-weekends-transit',
  },
];

const extractArticles = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload.articles)) {
    return payload.articles;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  return Array.isArray(payload) ? payload : [];
};

const normalizeArticle = (article) => ({
  title: article.title || article.headline || article.name,
  source: article.source?.name || article.source || article.publisher || 'Unknown',
  category: article.category || article.section || article.topic || 'General',
  summary: article.summary || article.description || '',
  link: article.url || article.link || '#',
  publishedAt: article.publishedAt || article.date || article.created_at || article.pubDate || null,
});

const buildPrompt = (article) => {
  const details = `Title: ${article.title}\nSource: ${article.source}\nCategory: ${article.category}\nLink: ${article.link}\nOriginal summary: ${
    article.summary || 'n/a'
  }`;

  return [
    {
      role: 'system',
      content:
        'You summarize news with optimism and focus on solutions. Respond as JSON with keys `summary` (<=60 words, concise, neutral-positive) and `positive` (true if the story has a constructive or hopeful angle). If unsure, set `positive` to false.',
    },
    {
      role: 'user',
      content: `${details}\n\nReturn only JSON.`,
    },
  ];
};

const summarizeArticle = async (article) => {
  if (!NEWS_SUMMARY_API_KEY) {
    return {
      summary: article.summary || '',
      positive: true,
    };
  }

  try {
    const response = await fetch(`${summaryApiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NEWS_SUMMARY_API_KEY}`,
      },
      body: JSON.stringify({
        model: summaryModel,
        messages: buildPrompt(article),
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No completion content received for news summary');
    }
    const parsed = JSON.parse(content);

    return {
      summary: parsed.summary || article.summary || '',
      positive: Boolean(parsed.positive),
    };
  } catch (error) {
    logger.warn('News summary request failed', error);
    return {
      summary: article.summary || '',
      positive: true,
    };
  }
};

const fetchFromEndpoint = async (endpoint) => {
  const headers = {};
  if (NEWS_API_KEY) {
    headers.Authorization = `Bearer ${NEWS_API_KEY}`;
  }

  try {
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`Failed to load feed: ${response.status}`);
    }
    const data = await response.json();
    return extractArticles(data)
      .map(normalizeArticle)
      .filter((article) => article.title && article.link);
  } catch (error) {
    logger.warn(`Unable to pull news from ${endpoint}`, error);
    return [];
  }
};

const loadSources = async () => {
  if (!NEWS_API_ENDPOINTS) {
    return fallbackArticles;
  }

  const endpoints = NEWS_API_ENDPOINTS.split(',').map((value) => value.trim()).filter(Boolean);
  if (endpoints.length === 0) {
    return fallbackArticles;
  }

  const articleGroups = await Promise.all(endpoints.map((endpoint) => fetchFromEndpoint(endpoint)));
  const merged = articleGroups.flat();
  return merged.length > 0 ? merged : fallbackArticles;
};

const ensureDirectory = (outputPath) => {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const writeFeed = async (articles, outputPath = defaultOutputPath) => {
  ensureDirectory(outputPath);
  await fs.promises.writeFile(outputPath, JSON.stringify({ articles }, null, 2));
};

const generateNewsFeed = async ({ writeToDisk = false } = {}) => {
  const rawArticles = await loadSources();
  const limited = rawArticles.slice(0, maxArticles);

  const summarized = [];
  for (const article of limited) {
    const summary = await summarizeArticle(article);
    if (!summary.positive) {
      continue;
    }
    summarized.push({
      ...article,
      summary: summary.summary || article.summary,
    });
  }

  if (writeToDisk) {
    await writeFeed(summarized, NEWS_OUTPUT_PATH || defaultOutputPath);
  }

  return summarized;
};

const loadNewsFeed = async () => {
  const outputPath = NEWS_OUTPUT_PATH || defaultOutputPath;
  try {
    const content = await fs.promises.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.articles)) {
      return parsed.articles;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return fallbackArticles;
  } catch (error) {
    logger.info('No cached news feed found, generating a new one.');
    return generateNewsFeed({ writeToDisk: true });
  }
};

if (require.main === module) {
  generateNewsFeed({ writeToDisk: true })
    .then((articles) => {
      logger.info(`News feed generated with ${articles.length} positive stories.`);
    })
    .catch((error) => {
      logger.error('Failed to generate news feed', error);
      process.exit(1);
    });
}

module.exports = {
  generateNewsFeed,
  loadNewsFeed,
};
