import { Router, Response } from 'express';
import { query } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { getQuote, getHistoricalData } from '../services/stockData.js';
import {
  calculateIndicators,
  generateSignals,
  calculateStopLoss,
  calculateTarget,
  generateOptionsRecommendation,
  TechnicalIndicators,
  SignalScore,
  HistoricalBar,
  OptionsPlay
} from '../services/technicalAnalysis.js';

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

/**
 * ADVANCED AI RECOMMENDATION ENGINE
 * Uses multi-indicator technical analysis for profitable trading signals
 */
router.post('/generate/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();

    console.log(`🚀 Generating tendies recommendation for ${upperSymbol}...`);

    // Get current quote and historical data
    const [quote, dailyHistory, weeklyHistory] = await Promise.all([
      getQuote(upperSymbol),
      getHistoricalData(upperSymbol, '6mo', '1d'),
      getHistoricalData(upperSymbol, '1y', '1wk')
    ]);

    if (!quote) {
      return res.status(400).json({ error: 'Could not fetch quote data' });
    }

    if (dailyHistory.length < 50) {
      return res.status(400).json({ error: 'Insufficient historical data (need 50+ days)' });
    }

    // Convert to HistoricalBar format
    const bars: HistoricalBar[] = dailyHistory.map(d => ({
      date: new Date(d.date),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume
    }));

    // Calculate all technical indicators
    let indicators: TechnicalIndicators;
    try {
      indicators = calculateIndicators(bars);
    } catch (e) {
      console.error('Indicator calculation error:', e);
      return res.status(400).json({ error: 'Failed to calculate indicators' });
    }

    // Generate trading signals
    const signalScore = generateSignals(indicators, quote.price);

    // Determine recommendation based on score
    let recommendation: 'buy' | 'sell' | 'hold';
    let emojiPrefix: string;

    if (signalScore.score >= 30) {
      recommendation = 'buy';
      emojiPrefix = '🚀';
    } else if (signalScore.score <= -30) {
      recommendation = 'sell';
      emojiPrefix = '🐻';
    } else {
      recommendation = 'hold';
      emojiPrefix = '🤔';
    }

    // Only generate strong recommendations (skip weak signals)
    if (Math.abs(signalScore.score) < 20 && signalScore.confidence < 60) {
      return res.json({
        message: 'No strong signal detected - waiting for better setup',
        analysis: {
          score: signalScore.score,
          confidence: signalScore.confidence,
          signals: signalScore.signals
        }
      });
    }

    // Calculate optimal stop loss and target using ATR
    const direction = recommendation === 'buy' ? 'long' : 'short';
    const stopLoss = calculateStopLoss(quote.price, indicators.atr, direction, 2);

    // Use 2:1 reward/risk for targets, or 3:1 for high confidence
    const rrRatio = signalScore.confidence > 75 ? 3 : 2;
    const targetPrice = calculateTarget(quote.price, stopLoss, rrRatio);

    // Calculate risk/reward metrics
    const riskPercent = Math.abs((quote.price - stopLoss) / quote.price * 100);
    const rewardPercent = Math.abs((targetPrice - quote.price) / quote.price * 100);

    // Build reasoning from signals
    const topSignals = signalScore.signals
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);

    const reasoning = [
      `${emojiPrefix} ${recommendation.toUpperCase()} SIGNAL (Score: ${signalScore.score}/100)`,
      '',
      '📊 KEY SIGNALS:',
      ...topSignals.map(s => `• ${s.description}`),
      '',
      '📈 TREND ANALYSIS:',
      `• Trend Strength: ${indicators.trendStrength.toUpperCase()} (ADX: ${indicators.adx.toFixed(1)})`,
      `• Price vs 50 SMA: ${quote.price > indicators.sma50 ? 'ABOVE ✅' : 'BELOW ❌'}`,
      `• RSI: ${indicators.rsi.toFixed(1)} (${indicators.rsiTrend})`,
      '',
      '💰 TRADE SETUP:',
      `• Entry: $${quote.price.toFixed(2)}`,
      `• Target: $${targetPrice.toFixed(2)} (+${rewardPercent.toFixed(1)}%)`,
      `• Stop Loss: $${stopLoss.toFixed(2)} (-${riskPercent.toFixed(1)}%)`,
      `• Risk/Reward: 1:${rrRatio}`,
      '',
      `🎯 Confidence: ${signalScore.confidence}%`
    ].join('\n');

    // Generate TA-based options play recommendation
    let optionsPlay: OptionsPlay | null = null;
    try {
      optionsPlay = generateOptionsRecommendation(
        upperSymbol,
        quote.price,
        indicators,
        signalScore
      );
      if (optionsPlay) {
        console.log(`📈 Generated ${optionsPlay.strategy} options play for ${upperSymbol}`);
      }
    } catch (e) {
      console.log('Options recommendation generation failed:', e);
    }

    // Save recommendation to database
    const result = await query(
      `INSERT INTO recommendations
       (symbol, recommendation_type, entry_price, target_price, stop_loss, option_details, reasoning, confidence_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        upperSymbol,
        optionsPlay ? `options_${optionsPlay.strategy.toLowerCase().replace(/\s+/g, '_')}` : recommendation,
        quote.price,
        targetPrice,
        stopLoss,
        optionsPlay ? JSON.stringify(optionsPlay) : null,
        reasoning,
        signalScore.confidence,
        req.user!.id
      ]
    );

    console.log(`✅ Generated ${recommendation} recommendation for ${upperSymbol} with ${signalScore.confidence}% confidence`);

    res.json({
      recommendation: result.rows[0],
      analysis: {
        currentPrice: quote.price,
        score: signalScore.score,
        confidence: signalScore.confidence,
        signals: signalScore.signals,
        indicators: {
          rsi: indicators.rsi.toFixed(1),
          macd: indicators.macd.toFixed(4),
          macdSignal: indicators.macdSignal.toFixed(4),
          macdCrossover: indicators.macdCrossover,
          adx: indicators.adx.toFixed(1),
          trendStrength: indicators.trendStrength,
          bollingerPosition: (indicators.bollingerPosition * 100).toFixed(1) + '%',
          volumeRatio: indicators.volumeRatio.toFixed(2) + 'x',
          obvTrend: indicators.obvTrend,
          atr: indicators.atr.toFixed(2),
          atrPercent: indicators.atrPercent.toFixed(2) + '%'
        },
        movingAverages: {
          sma20: indicators.sma20.toFixed(2),
          sma50: indicators.sma50.toFixed(2),
          sma200: indicators.sma200.toFixed(2),
          priceVsSma20: ((quote.price / indicators.sma20 - 1) * 100).toFixed(2) + '%',
          priceVsSma50: ((quote.price / indicators.sma50 - 1) * 100).toFixed(2) + '%'
        },
        levels: {
          support1: indicators.support1.toFixed(2),
          support2: indicators.support2.toFixed(2),
          resistance1: indicators.resistance1.toFixed(2),
          resistance2: indicators.resistance2.toFixed(2),
          pivotPoint: indicators.pivotPoint.toFixed(2)
        },
        riskReward: {
          stopLoss: stopLoss.toFixed(2),
          target: targetPrice.toFixed(2),
          riskPercent: riskPercent.toFixed(2) + '%',
          rewardPercent: rewardPercent.toFixed(2) + '%',
          ratio: `1:${rrRatio}`
        },
        optionsPlay: optionsPlay
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

// Scan for opportunities across multiple symbols
router.post('/scan', async (req: AuthRequest, res: Response) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Provide array of symbols to scan' });
    }

    const opportunities: any[] = [];

    for (const symbol of symbols.slice(0, 10)) { // Limit to 10 symbols
      try {
        const [quote, history] = await Promise.all([
          getQuote(symbol),
          getHistoricalData(symbol, '3mo', '1d')
        ]);

        if (!quote || history.length < 50) continue;

        const bars: HistoricalBar[] = history.map(d => ({
          date: new Date(d.date),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        }));

        const indicators = calculateIndicators(bars);
        const signalScore = generateSignals(indicators, quote.price);

        if (Math.abs(signalScore.score) >= 30) {
          opportunities.push({
            symbol,
            price: quote.price,
            changePercent: quote.changePercent,
            score: signalScore.score,
            confidence: signalScore.confidence,
            signal: signalScore.score > 0 ? 'BULLISH' : 'BEARISH',
            topReason: signalScore.signals[0]?.description
          });
        }
      } catch (e) {
        console.log(`Scan error for ${symbol}:`, e);
      }
    }

    // Sort by absolute score
    opportunities.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    res.json({
      scanned: symbols.length,
      opportunities
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to scan symbols' });
  }
});

export { router as recommendationsRouter };
