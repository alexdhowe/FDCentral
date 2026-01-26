// eslint-disable-next-line @typescript-eslint/no-explicit-any
import yahooFinanceModule from 'yahoo-finance2';

// yahoo-finance2 v2.x has incomplete type definitions - cast to any for runtime methods
const yahooFinance = yahooFinanceModule as any;

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
    const quote = await yahooFinance.quote(symbol);

    if (!quote) return null;

    return {
      symbol: quote.symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap,
      high: quote.regularMarketDayHigh || 0,
      low: quote.regularMarketDayLow || 0,
      open: quote.regularMarketOpen || 0,
      previousClose: quote.regularMarketPreviousClose || 0,
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

export async function getMultipleQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>();

  // Yahoo Finance supports batch quotes
  try {
    const results = await yahooFinance.quote(symbols);
    const quotesArray = Array.isArray(results) ? results : [results];

    for (const quote of quotesArray) {
      if (quote && quote.symbol) {
        quotes.set(quote.symbol, {
          symbol: quote.symbol,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          volume: quote.regularMarketVolume || 0,
          marketCap: quote.marketCap,
          high: quote.regularMarketDayHigh || 0,
          low: quote.regularMarketDayLow || 0,
          open: quote.regularMarketOpen || 0,
          previousClose: quote.regularMarketPreviousClose || 0,
          timestamp: new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error fetching multiple quotes:', error);
  }

  return quotes;
}

export async function getHistoricalData(
  symbol: string,
  period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'max' = '1mo',
  interval: '1m' | '5m' | '15m' | '1h' | '1d' | '1wk' | '1mo' = '1d'
): Promise<HistoricalData[]> {
  try {
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case '1d':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '5d':
        startDate.setDate(startDate.getDate() - 5);
        break;
      case '1mo':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3mo':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6mo':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '2y':
        startDate.setFullYear(startDate.getFullYear() - 2);
        break;
      case '5y':
        startDate.setFullYear(startDate.getFullYear() - 5);
        break;
      case 'max':
        startDate = new Date('1970-01-01');
        break;
    }

    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval
    });

    if (!result || !result.quotes) return [];

    return result.quotes.map((q: any) => ({
      date: new Date(q.date),
      open: q.open || 0,
      high: q.high || 0,
      low: q.low || 0,
      close: q.close || 0,
      volume: q.volume || 0
    }));
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

export async function getOptionChain(symbol: string, expirationDate?: Date): Promise<OptionChain | null> {
  try {
    const options = await yahooFinance.options(symbol, {
      date: expirationDate
    });

    if (!options) return null;

    const calls: OptionContract[] = (options.options[0]?.calls || []).map((call: any) => ({
      contractSymbol: call.contractSymbol,
      strike: call.strike || 0,
      expiration: new Date(options.options[0]?.expirationDate || Date.now()),
      type: 'call' as const,
      lastPrice: call.lastPrice || 0,
      bid: call.bid || 0,
      ask: call.ask || 0,
      volume: call.volume || 0,
      openInterest: call.openInterest || 0,
      impliedVolatility: call.impliedVolatility || 0,
      inTheMoney: call.inTheMoney || false,
      percentChange: call.percentChange || 0
    }));

    const puts: OptionContract[] = (options.options[0]?.puts || []).map((put: any) => ({
      contractSymbol: put.contractSymbol,
      strike: put.strike || 0,
      expiration: new Date(options.options[0]?.expirationDate || Date.now()),
      type: 'put' as const,
      lastPrice: put.lastPrice || 0,
      bid: put.bid || 0,
      ask: put.ask || 0,
      volume: put.volume || 0,
      openInterest: put.openInterest || 0,
      impliedVolatility: put.impliedVolatility || 0,
      inTheMoney: put.inTheMoney || false,
      percentChange: put.percentChange || 0
    }));

    return {
      expirationDates: options.expirationDates.map((d: any) => new Date(d)),
      calls,
      puts
    };
  } catch (error) {
    console.error(`Error fetching options for ${symbol}:`, error);
    return null;
  }
}

export async function searchSymbols(query: string): Promise<{ symbol: string; name: string; type: string }[]> {
  try {
    const results = await yahooFinance.search(query);

    return (results.quotes || [])
      .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
      .slice(0, 10)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType || 'EQUITY'
      }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export async function getTrendingStocks(): Promise<{ symbol: string; name: string }[]> {
  try {
    const trending = await yahooFinance.trendingSymbols('US');

    return (trending.quotes || []).slice(0, 20).map((q: any) => ({
      symbol: q.symbol || '',
      name: q.shortName || q.symbol || ''
    }));
  } catch (error) {
    console.error('Trending error:', error);
    // Return popular defaults
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
}

export async function getCompanyInfo(symbol: string) {
  try {
    const quoteSummary = await yahooFinance.quoteSummary(symbol, {
      modules: ['summaryProfile', 'summaryDetail', 'financialData', 'defaultKeyStatistics']
    });

    return {
      profile: quoteSummary.summaryProfile,
      details: quoteSummary.summaryDetail,
      financials: quoteSummary.financialData,
      keyStats: quoteSummary.defaultKeyStatistics
    };
  } catch (error) {
    console.error(`Error fetching company info for ${symbol}:`, error);
    return null;
  }
}
