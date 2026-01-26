import { Router, Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { getQuote, getHistoricalData, getOptionChain } from '../services/stockData';

const router = Router();

// Get all recommendations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status = 'all', limit = 50 } = req.query;

    let whereClause = '';
    if (status !== 'all') {
      whereClause = `WHERE r.status = '${status}'`;
    }

    const result = await query(
      `SELECT r.*, u.username as created_by_name,
        (SELECT COUNT(*) FROM recommendation_reactions WHERE recommendation_id = r.id AND reaction_type = 'bullish') as bullish_count,
        (SELECT COUNT(*) FROM recommendation_reactions WHERE recommendation_id = r.id AND reaction_type = 'bearish') as bearish_count,
        (SELECT COUNT(*) FROM recommendation_reactions WHERE recommendation_id = r.id AND reaction_type = 'following') as following_count,
        (SELECT reaction_type FROM recommendation_reactions WHERE recommendation_id = r.id AND user_id = $1) as user_reaction
       FROM recommendations r
       LEFT JOIN users u ON r.created_by = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [req.user!.id, Number(limit)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Get recommendation performance stats
router.get('/performance', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'hit_target') as wins,
        COUNT(*) FILTER (WHERE status = 'hit_stop') as losses,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        ROUND(AVG(profit_loss_percent) FILTER (WHERE profit_loss_percent IS NOT NULL), 2) as avg_return,
        ROUND(SUM(profit_loss_amount) FILTER (WHERE profit_loss_amount IS NOT NULL), 2) as total_pnl,
        COUNT(*) as total_recommendations
      FROM recommendations
    `);

    const winRate = stats.rows[0].wins + stats.rows[0].losses > 0
      ? Math.round((stats.rows[0].wins / (stats.rows[0].wins + stats.rows[0].losses)) * 100)
      : 0;

    res.json({
      ...stats.rows[0],
      winRate
    });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ error: 'Failed to get performance stats' });
  }
});

// Create recommendation (manual)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      symbol,
      recommendationType,
      entryPrice,
      targetPrice,
      stopLoss,
      optionDetails,
      reasoning,
      confidenceScore
    } = req.body;

    if (!symbol || !recommendationType || !entryPrice || !reasoning) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO recommendations
       (symbol, recommendation_type, entry_price, target_price, stop_loss, option_details, reasoning, confidence_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        symbol.toUpperCase(),
        recommendationType,
        entryPrice,
        targetPrice,
        stopLoss,
        optionDetails ? JSON.stringify(optionDetails) : null,
        reasoning,
        confidenceScore || 50,
        req.user!.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create recommendation error:', error);
    res.status(500).json({ error: 'Failed to create recommendation' });
  }
});

// Generate AI recommendation for a symbol
router.post('/generate/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;

    // Get current quote and historical data
    const quote = await getQuote(symbol.toUpperCase());
    const history = await getHistoricalData(symbol.toUpperCase(), '3mo', '1d');

    if (!quote || history.length < 20) {
      return res.status(400).json({ error: 'Insufficient data for analysis' });
    }

    // Simple technical analysis
    const prices = history.map(h => h.close);
    const volumes = history.map(h => h.volume);

    // Calculate moving averages
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.length >= 50
      ? prices.slice(-50).reduce((a, b) => a + b, 0) / 50
      : sma20;

    // Calculate RSI
    const changes = prices.slice(1).map((p, i) => p - prices[i]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Calculate MACD
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // Volume trend
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeTrend = recentVolume > avgVolume * 1.2 ? 'increasing' : 'normal';

    // Generate recommendation
    let recommendation = 'hold';
    let confidence = 50;
    let reasoning = [];

    // Trend analysis
    if (quote.price > sma20 && sma20 > sma50) {
      reasoning.push('Price above both 20 and 50 SMA (bullish trend)');
      confidence += 10;
    } else if (quote.price < sma20 && sma20 < sma50) {
      reasoning.push('Price below both 20 and 50 SMA (bearish trend)');
      confidence += 10;
    }

    // RSI analysis
    if (rsi < 30) {
      reasoning.push(`RSI at ${rsi.toFixed(1)} indicates oversold conditions`);
      recommendation = 'buy';
      confidence += 15;
    } else if (rsi > 70) {
      reasoning.push(`RSI at ${rsi.toFixed(1)} indicates overbought conditions`);
      recommendation = 'sell';
      confidence += 15;
    } else {
      reasoning.push(`RSI at ${rsi.toFixed(1)} is neutral`);
    }

    // MACD
    if (macd > 0) {
      reasoning.push('MACD is positive (bullish momentum)');
      if (recommendation !== 'sell') {
        recommendation = 'buy';
        confidence += 5;
      }
    } else {
      reasoning.push('MACD is negative (bearish momentum)');
      if (recommendation !== 'buy') {
        recommendation = 'sell';
        confidence += 5;
      }
    }

    // Volume
    if (volumeTrend === 'increasing') {
      reasoning.push('Volume is increasing, confirming the trend');
      confidence += 5;
    }

    // Calculate targets
    const volatility = calculateVolatility(prices);
    const targetMultiplier = recommendation === 'buy' ? 1 + volatility : 1 - volatility;
    const stopMultiplier = recommendation === 'buy' ? 1 - volatility * 0.5 : 1 + volatility * 0.5;

    const targetPrice = quote.price * targetMultiplier;
    const stopLoss = quote.price * stopMultiplier;

    // Check for options play
    let optionsRecommendation = null;
    try {
      const chain = await getOptionChain(symbol.toUpperCase());
      if (chain && chain.calls.length > 0) {
        // Find ATM options ~30 days out
        const atmCalls = chain.calls.filter(c =>
          Math.abs(c.strike - quote.price) < quote.price * 0.05 &&
          c.volume > 100
        );
        const atmPuts = chain.puts.filter(p =>
          Math.abs(p.strike - quote.price) < quote.price * 0.05 &&
          p.volume > 100
        );

        if (recommendation === 'buy' && atmCalls.length > 0) {
          const bestCall = atmCalls.sort((a, b) => b.volume - a.volume)[0];
          optionsRecommendation = {
            type: 'call',
            strike: bestCall.strike,
            expiration: bestCall.expiration,
            premium: bestCall.lastPrice,
            impliedVolatility: bestCall.impliedVolatility
          };
        } else if (recommendation === 'sell' && atmPuts.length > 0) {
          const bestPut = atmPuts.sort((a, b) => b.volume - a.volume)[0];
          optionsRecommendation = {
            type: 'put',
            strike: bestPut.strike,
            expiration: bestPut.expiration,
            premium: bestPut.lastPrice,
            impliedVolatility: bestPut.impliedVolatility
          };
        }
      }
    } catch (e) {
      // Options data not available
    }

    // Save recommendation
    const result = await query(
      `INSERT INTO recommendations
       (symbol, recommendation_type, entry_price, target_price, stop_loss, option_details, reasoning, confidence_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        symbol.toUpperCase(),
        optionsRecommendation ? `options_${optionsRecommendation.type}` : recommendation,
        quote.price,
        targetPrice,
        stopLoss,
        optionsRecommendation ? JSON.stringify(optionsRecommendation) : null,
        reasoning.join('. ') + '.',
        Math.min(confidence, 95),
        req.user!.id
      ]
    );

    res.json({
      recommendation: result.rows[0],
      analysis: {
        currentPrice: quote.price,
        sma20,
        sma50,
        rsi,
        macd,
        volumeTrend,
        volatility: (volatility * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    console.error('Generate recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

// React to recommendation
router.post('/:id/react', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reactionType } = req.body;

    if (!['bullish', 'bearish', 'following'].includes(reactionType)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    await query(
      `INSERT INTO recommendation_reactions (recommendation_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (recommendation_id, user_id)
       DO UPDATE SET reaction_type = $3`,
      [id, req.user!.id, reactionType]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('React to recommendation error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Close recommendation manually
router.post('/:id/close', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { exitPrice, status = 'closed' } = req.body;

    // Get recommendation
    const rec = await query('SELECT * FROM recommendations WHERE id = $1', [id]);
    if (rec.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    const recommendation = rec.rows[0];
    const pnlPercent = ((exitPrice - recommendation.entry_price) / recommendation.entry_price) * 100;
    const pnlAmount = exitPrice - recommendation.entry_price;

    await query(
      `UPDATE recommendations
       SET status = $1, exit_price = $2, profit_loss_percent = $3, profit_loss_amount = $4, closed_at = NOW()
       WHERE id = $5`,
      [status, exitPrice, pnlPercent, pnlAmount, id]
    );

    res.json({ success: true, pnlPercent, pnlAmount });
  } catch (error) {
    console.error('Close recommendation error:', error);
    res.status(500).json({ error: 'Failed to close recommendation' });
  }
});

// Helper functions
function calculateEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

function calculateVolatility(prices: number[]): number {
  const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252); // Annualized
}

export { router as recommendationsRouter };
