import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../db';
import {
  getQuote,
  getMultipleQuotes,
  getHistoricalData,
  searchSymbols,
  getTrendingStocks,
  getCompanyInfo
} from '../services/stockData';

const router = Router();

// Get quote for single symbol
router.get('/quote/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const quote = await getQuote(symbol.toUpperCase());

    if (!quote) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

// Get quotes for multiple symbols
router.post('/quotes', async (req: AuthRequest, res: Response) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array required' });
    }

    const quotes = await getMultipleQuotes(symbols.map((s: string) => s.toUpperCase()));
    res.json(Object.fromEntries(quotes));
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: 'Failed to get quotes' });
  }
});

// Get historical data for charting
router.get('/history/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const { period = '1mo', interval = '1d' } = req.query;

    // Check cache first
    const cached = await query(
      `SELECT data, updated_at FROM price_cache
       WHERE symbol = $1 AND timeframe = $2
       AND updated_at > NOW() - INTERVAL '5 minutes'`,
      [symbol.toUpperCase(), period]
    );

    if (cached.rows.length > 0) {
      return res.json(cached.rows[0].data);
    }

    const history = await getHistoricalData(
      symbol.toUpperCase(),
      period as any,
      interval as any
    );

    // Cache the result
    if (history.length > 0) {
      await query(
        `INSERT INTO price_cache (symbol, timeframe, data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (symbol, timeframe) DO UPDATE SET data = $3, updated_at = NOW()`,
        [symbol.toUpperCase(), period, JSON.stringify(history)]
      );
    }

    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get historical data' });
  }
});

// Search for symbols
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await searchSymbols(q);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Get trending stocks
router.get('/trending', async (req: AuthRequest, res: Response) => {
  try {
    const trending = await getTrendingStocks();
    res.json(trending);
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'Failed to get trending' });
  }
});

// Get company info
router.get('/company/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const info = await getCompanyInfo(symbol.toUpperCase());

    if (!info) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(info);
  } catch (error) {
    console.error('Company info error:', error);
    res.status(500).json({ error: 'Failed to get company info' });
  }
});

// Get market overview (major indices)
router.get('/market-overview', async (req: AuthRequest, res: Response) => {
  try {
    const indices = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX'];
    const quotes = await getMultipleQuotes(indices);

    const overview = {
      sp500: quotes.get('^GSPC'),
      dow: quotes.get('^DJI'),
      nasdaq: quotes.get('^IXIC'),
      russell: quotes.get('^RUT'),
      vix: quotes.get('^VIX')
    };

    res.json(overview);
  } catch (error) {
    console.error('Market overview error:', error);
    res.status(500).json({ error: 'Failed to get market overview' });
  }
});

export { router as stocksRouter };
