
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Fallback data in case external fetch fails
const fallbackData = [
  {
    title: 'Cities Turn Rooftops Into Renewable Microgrids',
    source: 'The Verge',
    category: 'Climate',
    summary: 'A coalition of U.S. cities is piloting solar-plus-storage rooftops to share excess energy with neighbors during heatwaves.',
    link: 'https://www.theverge.com/2024/06/21/solar-microgrids-city-rooftops',
    image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=1000'
  },
  {
    title: 'Researchers Build Affordable Direct-Air Capture Filters',
    source: 'Science Daily',
    category: 'Innovation',
    summary: 'New modular filters capture carbon dioxide at a fraction of current costs, paving the way for community-scale deployments.',
    link: 'https://www.sciencedaily.com/releases/2024/06/240621141515.htm',
    image: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?auto=format&fit=crop&q=80&w=1000'
  }
];

router.get('/', async (req, res) => {
  try {
    // In a real implementation, we would fetch from a news API here.
    // For now, we simulate a delay and return extended fallback data.
    // const response = await axios.get('TS_URL_HERE');
    
    // Simulate LLM processing or AI curation placeholder
    const enhancedData = fallbackData.map(item => ({
      ...item,
      aiAnalysis: 'AI Analysis: This topic is trending heavily in renewable energy circles.'
    }));

    res.status(200).json({ articles: enhancedData });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ articles: fallbackData });
  }
});

module.exports = router;
