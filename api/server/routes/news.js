
const express = require('express');
const Parser = require('rss-parser');
const router = express.Router();
const parser = new Parser();

// Fallback data
const fallbackData = [
  {
    title: 'Cities Turn Rooftops Into Renewable Microgrids',
    source: 'The Verge',
    category: 'Climate',
    summary: 'A coalition of U.S. cities is piloting solar-plus-storage rooftops to share excess energy with neighbors during heatwaves.',
    link: 'https://www.theverge.com/2024/06/21/solar-microgrids-city-rooftops',
    image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=1000'
  }
];

// RSS Feed URLs (Mixed sources for variety)
const FEED_URLS = [
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
  'https://www.theverge.com/rss/index.xml'
];

function extractImage(item) {
  // Attempt to find an image in standard RSS fields or enclosures
  if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
    return item.enclosure.url;
  }
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }
  // Try to parse from content/description if it contains an img tag
  const content = item['content:encoded'] || item.content || item.description || '';
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

router.get('/', async (req, res) => {
  try {
    const feedPromises = FEED_URLS.map(url => parser.parseURL(url).catch(e => {
      console.error(`Error parsing feed ${url}:`, e);
      return null;
    }));

    const feeds = await Promise.all(feedPromises);

    let allArticles = [];
    feeds.forEach((feed) => {
      if (!feed || !feed.items) return;

      const source = feed.title || 'Unknown Source';

      feed.items.forEach(item => {
        allArticles.push({
          title: item.title,
          source: source,
          category: 'Technology', // Defaulting for now
          summary: item.contentSnippet || item.description || '',
          link: item.link,
          image: extractImage(item),
          pubDate: item.pubDate,
          content: item['content:encoded'] || item.content || item.description // Full content for reader mode
        });
      });
    });

    // Sort by date descending
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Limit to 9 for a 3x3 grid
    const slicedArticles = allArticles.slice(0, 9);

    // If no articles found (e.g. all feeds failed), use fallback
    if (slicedArticles.length === 0) {
      return res.status(200).json({ articles: fallbackData });
    }

    res.status(200).json({ articles: slicedArticles });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ articles: fallbackData });
  }
});

module.exports = router;
