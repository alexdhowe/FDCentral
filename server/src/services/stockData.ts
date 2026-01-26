// Finnhub Stock Data Service - Much more reliable than Yahoo Finance
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'demo';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Simple in-memory cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 second cache for real-time feel

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function finnhubFetch(endpoint: string): Promise<any> {
  const url = `${FINNHUB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${FINNHUB_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
}

export interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptionChain {
  expirationDates: Date[];
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  expiration: Date;
  type: 'call' | 'put';
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  percentChange: number;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  try {
    const cacheKey = `quote:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Finnhub quote endpoint
    const data = await finnhubFetch(`/quote?symbol=${symbol.toUpperCase()}`);

    if (!data || data.c === 0) {
      console.log(`No data for ${symbol}, returning null`);
      return null;
    }

    const result: Quote = {
      symbol: symbol.toUpperCase(),
      price: data.c || 0,           // Current price
      change: data.d || 0,          // Change
      changePercent: data.dp || 0,  // Change percent
      volume: 0,                    // Finnhub doesn't return volume in quote
      high: data.h || 0,            // High of day
      low: data.l || 0,             // Low of day
      open: data.o || 0,            // Open
      previousClose: data.pc || 0,  // Previous close
      timestamp: new Date()
    };

    setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error(`Error fetching quote for ${symbol}:`, error?.message || error);
    return null;
  }
}

export async function getMultipleQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>();

  // Fetch quotes in parallel with small batches to respect rate limits
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(symbol => getQuote(symbol));
    const results = await Promise.all(promises);

    results.forEach((quote, idx) => {
      if (quote) {
        quotes.set(batch[idx], quote);
      }
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return quotes;
}

export async function getHistoricalData(
  symbol: string,
  period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'max' = '1mo',
  interval: '1m' | '5m' | '15m' | '1h' | '1d' | '1wk' | '1mo' = '1d'
): Promise<HistoricalData[]> {
  try {
    const cacheKey = `history:${symbol}:${period}:${interval}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const now = Math.floor(Date.now() / 1000);
    let from: number;

    switch (period) {
      case '1d': from = now - 86400; break;
      case '5d': from = now - 86400 * 5; break;
      case '1mo': from = now - 86400 * 30; break;
      case '3mo': from = now - 86400 * 90; break;
      case '6mo': from = now - 86400 * 180; break;
      case '1y': from = now - 86400 * 365; break;
      case '2y': from = now - 86400 * 730; break;
      case '5y': from = now - 86400 * 1825; break;
      case 'max': from = now - 86400 * 3650; break;
      default: from = now - 86400 * 30;
    }

    // Finnhub candles endpoint - D for daily
    const resolution = interval === '1d' ? 'D' : interval === '1wk' ? 'W' : interval === '1mo' ? 'M' : 'D';
    const data = await finnhubFetch(`/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${from}&to=${now}`);

    if (!data || data.s === 'no_data' || !data.c) {
      return [];
    }

    const result: HistoricalData[] = data.t.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000),
      open: data.o[i] || 0,
      high: data.h[i] || 0,
      low: data.l[i] || 0,
      close: data.c[i] || 0,
      volume: data.v[i] || 0
    }));

    setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error(`Error fetching historical data for ${symbol}:`, error?.message || error);
    return [];
  }
}

export async function getOptionChain(symbol: string, expirationDate?: Date): Promise<OptionChain | null> {
  // Finnhub doesn't have free options data - return placeholder
  // For options, you'd need a paid API like Tradier or polygon.io
  console.log('Options data requires premium API - returning placeholder');
  return {
    expirationDates: [],
    calls: [],
    puts: []
  };
}

export async function searchSymbols(query: string): Promise<{ symbol: string; name: string; type: string }[]> {
  try {
    const cacheKey = `search:${query}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const data = await finnhubFetch(`/search?q=${encodeURIComponent(query)}`);

    if (!data || !data.result) {
      return [];
    }

    const result = data.result
      .filter((item: any) => item.type === 'Common Stock' || item.type === 'ETF')
      .slice(0, 10)
      .map((item: any) => ({
        symbol: item.symbol,
        name: item.description || item.symbol,
        type: item.type === 'Common Stock' ? 'EQUITY' : 'ETF'
      }));

    setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error('Search error:', error?.message || error);
    return [];
  }
}

export async function getTrendingStocks(): Promise<{ symbol: string; name: string }[]> {
  // Finnhub doesn't have a trending endpoint on free tier
  // Return popular stocks as default
  return [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { symbol: 'AMD', name: 'Advanced Micro Devices' }
  ];
}

export async function getCompanyInfo(symbol: string) {
  try {
    const cacheKey = `company:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const [profile, metrics] = await Promise.all([
      finnhubFetch(`/stock/profile2?symbol=${symbol.toUpperCase()}`),
      finnhubFetch(`/stock/metric?symbol=${symbol.toUpperCase()}&metric=all`)
    ]);

    const result = {
      profile: {
        name: profile.name,
        industry: profile.finnhubIndustry,
        sector: profile.finnhubIndustry,
        website: profile.weburl,
        description: `${profile.name} is a company in the ${profile.finnhubIndustry} industry.`,
        country: profile.country,
        exchange: profile.exchange,
        ipo: profile.ipo,
        logo: profile.logo
      },
      details: {
        marketCap: profile.marketCapitalization * 1000000,
        sharesOutstanding: profile.shareOutstanding * 1000000
      },
      financials: metrics.metric || {},
      keyStats: metrics.metric || {}
    };

    setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error(`Error fetching company info for ${symbol}:`, error?.message || error);
    return null;
  }
}
