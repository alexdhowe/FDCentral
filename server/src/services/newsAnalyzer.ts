import { query } from '../db/index.js';

// Finnhub API for news
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

interface NewsItem {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface AnalyzedNews {
  symbol: string | null;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  impactLevel: 'high' | 'medium' | 'low';
  relatedSymbols: string[];
}

// Keywords for sentiment analysis
const BULLISH_KEYWORDS = [
  'surge', 'soar', 'rally', 'beat', 'exceeds', 'record', 'growth', 'profit',
  'upgrade', 'buy', 'outperform', 'bullish', 'breakthrough', 'innovation',
  'partnership', 'acquisition', 'expansion', 'strong', 'positive', 'gain',
  'higher', 'increase', 'rising', 'boost', 'momentum', 'success', 'wins',
  'approval', 'launch', 'new high', 'all-time high', 'beats expectations',
  'guidance raise', 'dividend increase', 'buyback', 'share repurchase'
];

const BEARISH_KEYWORDS = [
  'fall', 'drop', 'decline', 'miss', 'below', 'loss', 'warning', 'concern',
  'downgrade', 'sell', 'underperform', 'bearish', 'investigation', 'lawsuit',
  'layoff', 'cut', 'weak', 'negative', 'lower', 'decrease', 'falling',
  'struggle', 'failure', 'fails', 'reject', 'recall', 'new low', '52-week low',
  'misses expectations', 'guidance cut', 'dividend cut', 'bankruptcy', 'default',
  'fraud', 'scandal', 'probe', 'sec investigation', 'delay', 'postpone'
];

const HIGH_IMPACT_KEYWORDS = [
  'earnings', 'fda', 'fed', 'fomc', 'interest rate', 'acquisition', 'merger',
  'bankruptcy', 'ceo', 'cfo', 'guidance', 'forecast', 'sec', 'investigation',
  'lawsuit', 'antitrust', 'recall', 'patent', 'approval', 'clinical trial',
  'phase 3', 'ipo', 'stock split', 'dividend', 'buyback'
];

/**
 * Fetch market news for a specific symbol
 */
export async function fetchSymbolNews(symbol: string): Promise<NewsItem[]> {
  try {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const fromDate = weekAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];

    const response = await fetch(
      `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      console.error(`Finnhub news API error for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data.slice(0, 20) : []; // Limit to 20 most recent
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetch general market news
 */
export async function fetchMarketNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      console.error(`Finnhub market news API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data.slice(0, 50) : [];
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
}

/**
 * Analyze sentiment of a news headline and summary
 */
function analyzeSentiment(headline: string, summary: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
  const text = `${headline} ${summary}`.toLowerCase();

  let bullishScore = 0;
  let bearishScore = 0;

  // Count keyword matches
  for (const keyword of BULLISH_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      bullishScore++;
    }
  }

  for (const keyword of BEARISH_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      bearishScore++;
    }
  }

  // Calculate normalized score (-1 to 1)
  const total = bullishScore + bearishScore;
  if (total === 0) {
    return { sentiment: 'neutral', score: 0 };
  }

  const score = (bullishScore - bearishScore) / Math.max(total, 1);

  if (score > 0.2) {
    return { sentiment: 'positive', score: Math.min(score, 1) };
  } else if (score < -0.2) {
    return { sentiment: 'negative', score: Math.max(score, -1) };
  }

  return { sentiment: 'neutral', score };
}

/**
 * Determine impact level of news
 */
function determineImpactLevel(headline: string, summary: string): 'high' | 'medium' | 'low' {
  const text = `${headline} ${summary}`.toLowerCase();

  // Check for high impact keywords
  for (const keyword of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return 'high';
    }
  }

  // Check headline length and content quality
  if (headline.length > 100 || summary.length > 500) {
    return 'medium';
  }

  return 'low';
}

/**
 * Extract related stock symbols from news
 */
function extractRelatedSymbols(related: string): string[] {
  if (!related) return [];
  return related.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 5);
}

/**
 * Analyze news items and save to database
 */
export async function analyzeAndSaveNews(symbol: string | null, newsItems: NewsItem[]): Promise<AnalyzedNews[]> {
  const analyzedNews: AnalyzedNews[] = [];

  for (const item of newsItems) {
    try {
      const { sentiment, score } = analyzeSentiment(item.headline, item.summary);
      const impactLevel = determineImpactLevel(item.headline, item.summary);
      const relatedSymbols = extractRelatedSymbols(item.related);

      const analyzed: AnalyzedNews = {
        symbol: symbol || (relatedSymbols.length > 0 ? relatedSymbols[0] : null),
        headline: item.headline,
        summary: item.summary || '',
        source: item.source,
        url: item.url,
        publishedAt: new Date(item.datetime * 1000),
        sentiment,
        sentimentScore: score,
        impactLevel,
        relatedSymbols
      };

      // Save to database if high or medium impact
      if (impactLevel === 'high' || (impactLevel === 'medium' && sentiment !== 'neutral')) {
        await saveNewsItem(analyzed);
      }

      analyzedNews.push(analyzed);
    } catch (error) {
      console.error('Error analyzing news item:', error);
    }
  }

  return analyzedNews;
}

/**
 * Save news item to database
 */
async function saveNewsItem(news: AnalyzedNews): Promise<void> {
  try {
    // Check for duplicate
    const existing = await query(
      `SELECT id FROM news_items WHERE url = $1`,
      [news.url]
    );

    if (existing.rows.length > 0) {
      return; // Already saved
    }

    await query(
      `INSERT INTO news_items (
        symbol, headline, summary, source, url, published_at,
        sentiment, sentiment_score, impact_level, related_symbols
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        news.symbol,
        news.headline,
        news.summary,
        news.source,
        news.url,
        news.publishedAt,
        news.sentiment,
        news.sentimentScore,
        news.impactLevel,
        news.relatedSymbols
      ]
    );
  } catch (error) {
    console.error('Error saving news item:', error);
  }
}

/**
 * Get recent news for a symbol
 */
export async function getRecentNews(symbol: string, limit: number = 10): Promise<any[]> {
  const result = await query(
    `SELECT * FROM news_items
     WHERE symbol = $1 OR $1 = ANY(related_symbols)
     ORDER BY published_at DESC
     LIMIT $2`,
    [symbol, limit]
  );
  return result.rows;
}

/**
 * Get high impact news across all tracked symbols
 */
export async function getHighImpactNews(limit: number = 20): Promise<any[]> {
  const result = await query(
    `SELECT * FROM news_items
     WHERE impact_level = 'high'
     ORDER BY published_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get news sentiment summary for a symbol
 */
export async function getNewsSentimentSummary(symbol: string): Promise<{
  positive: number;
  negative: number;
  neutral: number;
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
}> {
  // Get news from last 7 days
  const result = await query(
    `SELECT sentiment, sentiment_score, published_at
     FROM news_items
     WHERE (symbol = $1 OR $1 = ANY(related_symbols))
       AND published_at > NOW() - INTERVAL '7 days'
     ORDER BY published_at DESC`,
    [symbol]
  );

  const news = result.rows;

  if (news.length === 0) {
    return { positive: 0, negative: 0, neutral: 0, averageScore: 0, trend: 'stable' };
  }

  let positive = 0, negative = 0, neutral = 0;
  let totalScore = 0;

  for (const item of news) {
    if (item.sentiment === 'positive') positive++;
    else if (item.sentiment === 'negative') negative++;
    else neutral++;
    totalScore += parseFloat(item.sentiment_score) || 0;
  }

  const averageScore = totalScore / news.length;

  // Determine trend by comparing first half vs second half
  const midpoint = Math.floor(news.length / 2);
  const recentNews = news.slice(0, midpoint);
  const olderNews = news.slice(midpoint);

  const recentAvg = recentNews.reduce((acc, n) => acc + (parseFloat(n.sentiment_score) || 0), 0) / (recentNews.length || 1);
  const olderAvg = olderNews.reduce((acc, n) => acc + (parseFloat(n.sentiment_score) || 0), 0) / (olderNews.length || 1);

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg - olderAvg > 0.2) trend = 'improving';
  else if (olderAvg - recentAvg > 0.2) trend = 'declining';

  return { positive, negative, neutral, averageScore, trend };
}

/**
 * Run full news analysis for tracked symbols
 */
export async function runNewsAnalysis(): Promise<void> {
  console.log('📰 Running news analysis...');

  try {
    // Get tracked symbols
    const trackedResult = await query(
      `SELECT symbol FROM tracked_symbols WHERE is_active = true ORDER BY priority DESC LIMIT 50`
    );

    const symbols = trackedResult.rows.map(r => r.symbol);

    // Also fetch general market news
    const marketNews = await fetchMarketNews();
    await analyzeAndSaveNews(null, marketNews);

    // Analyze news for each symbol with rate limiting
    for (const symbol of symbols) {
      try {
        const news = await fetchSymbolNews(symbol);
        await analyzeAndSaveNews(symbol, news);

        // Rate limiting - 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error analyzing news for ${symbol}:`, error);
      }
    }

    console.log('📰 News analysis complete');
  } catch (error) {
    console.error('Error in news analysis:', error);
  }
}
