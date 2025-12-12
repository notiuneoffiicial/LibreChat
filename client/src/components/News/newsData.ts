export type NewsArticle = {
  title: string;
  source: string;
  category: string;
  summary: string;
  link: string;
  image?: string;
};

const newsData: NewsArticle[] = [
  {
    title: 'Cities Turn Rooftops Into Renewable Microgrids',
    source: 'The Verge',
    category: 'Climate',
    summary:
      'A coalition of U.S. cities is piloting solar-plus-storage rooftops to share excess energy with neighbors during heatwaves.',
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
      'A fleet of autonomous cleanup vessels has cleared thousands of kilograms of ocean plastic ahead of schedule while tracking wildlife to avoid disruption.',
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

export default newsData;
