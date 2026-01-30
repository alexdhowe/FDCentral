import { query } from '../db/index.js';
import { scanSymbol, MarketSignal } from './marketScanner.js';
import { getNewsSentimentSummary, fetchSymbolNews, analyzeAndSaveNews } from './newsAnalyzer.js';

interface SignalContext {
  symbol: string;
  price: number;
  technicalSignals: MarketSignal[];
  newsSentiment: {
    positive: number;
    negative: number;
    neutral: number;
    averageScore: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  recentPerformance: {
    change1d: number;
    change5d: number;
    change1m: number;
    volatility: number;
  };
}

interface ActionableSignal {
  symbol: string;
  action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  reasoning: string[];
  priceTarget?: number;
  stopLoss?: number;
  timeframe: 'intraday' | 'swing' | 'position';
  riskLevel: 'low' | 'medium' | 'high';
  technicalScore: number;
  sentimentScore: number;
  overallScore: number;
}

interface Prediction {
  symbol: string;
  type: 'price_direction' | 'price_target' | 'volatility';
  timeframe: string;
  prediction: any;
  reasoning: string;
  confidence: number;
  priceAtPrediction: number;
}

/**
 * Calculate recent performance metrics
 */
async function getRecentPerformance(symbol: string): Promise<{
  change1d: number;
  change5d: number;
  change1m: number;
  volatility: number;
}> {
  try {
    // Get from cached price data
    const result = await query(
      `SELECT data FROM price_cache WHERE symbol = $1 AND timeframe = '1m'`,
      [symbol]
    );

    if (result.rows.length === 0 || !result.rows[0].data) {
      return { change1d: 0, change5d: 0, change1m: 0, volatility: 0 };
    }

    const data = result.rows[0].data;
    const closes = data.c || [];

    if (closes.length < 22) {
      return { change1d: 0, change5d: 0, change1m: 0, volatility: 0 };
    }

    const currentPrice = closes[closes.length - 1];
    const price1dAgo = closes[closes.length - 2];
    const price5dAgo = closes[closes.length - 6];
    const price1mAgo = closes[closes.length - 22];

    const change1d = ((currentPrice - price1dAgo) / price1dAgo) * 100;
    const change5d = ((currentPrice - price5dAgo) / price5dAgo) * 100;
    const change1m = ((currentPrice - price1mAgo) / price1mAgo) * 100;

    // Calculate volatility (standard deviation of daily returns)
    const returns: number[] = [];
    for (let i = 1; i < Math.min(22, closes.length); i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

    return { change1d, change5d, change1m, volatility };
  } catch (error) {
    console.error('Error getting recent performance:', error);
    return { change1d: 0, change5d: 0, change1m: 0, volatility: 0 };
  }
}

/**
 * Generate a comprehensive signal for a symbol
 */
export async function generateSignal(symbol: string): Promise<ActionableSignal | null> {
  try {
    console.log(`🎯 Generating signal for ${symbol}...`);

    // Gather all context
    const technicalSignals = await scanSymbol(symbol);
    const newsSentiment = await getNewsSentimentSummary(symbol);
    const recentPerformance = await getRecentPerformance(symbol);

    // Get current price from signals
    const currentPrice = technicalSignals.length > 0 ? technicalSignals[0].priceAtSignal : 0;

    if (currentPrice === 0) {
      console.log(`⚠️ No price data for ${symbol}`);
      return null;
    }

    const context: SignalContext = {
      symbol,
      price: currentPrice,
      technicalSignals,
      newsSentiment,
      recentPerformance
    };

    // Calculate scores
    const technicalScore = calculateTechnicalScore(technicalSignals);
    const sentimentScore = calculateSentimentScore(newsSentiment);
    const momentumScore = calculateMomentumScore(recentPerformance);

    // Weighted overall score (-100 to 100)
    const overallScore = (
      technicalScore * 0.5 +
      sentimentScore * 0.2 +
      momentumScore * 0.3
    );

    // Determine action
    let action: ActionableSignal['action'] = 'hold';
    if (overallScore >= 60) action = 'strong_buy';
    else if (overallScore >= 30) action = 'buy';
    else if (overallScore <= -60) action = 'strong_sell';
    else if (overallScore <= -30) action = 'sell';

    // Determine timeframe based on signal types
    let timeframe: ActionableSignal['timeframe'] = 'swing';
    const hasIntradaySignals = technicalSignals.some(s => s.timeframe === 'intraday');
    const hasPositionSignals = technicalSignals.some(s => s.timeframe === 'position');
    if (hasIntradaySignals && !hasPositionSignals) timeframe = 'intraday';
    else if (hasPositionSignals) timeframe = 'position';

    // Determine risk level
    let riskLevel: ActionableSignal['riskLevel'] = 'medium';
    if (recentPerformance.volatility > 50 || Math.abs(recentPerformance.change1d) > 5) {
      riskLevel = 'high';
    } else if (recentPerformance.volatility < 20 && Math.abs(recentPerformance.change1d) < 2) {
      riskLevel = 'low';
    }

    // Generate reasoning
    const reasoning = generateReasoning(context, technicalScore, sentimentScore, momentumScore);

    // Calculate targets
    const { priceTarget, stopLoss } = calculateTargets(context, action);

    // Calculate confidence
    const confidence = calculateConfidence(technicalSignals, overallScore, recentPerformance.volatility);

    const signal: ActionableSignal = {
      symbol,
      action,
      confidence,
      reasoning,
      priceTarget,
      stopLoss,
      timeframe,
      riskLevel,
      technicalScore,
      sentimentScore,
      overallScore
    };

    // Save signal if significant
    if (Math.abs(overallScore) >= 25 && confidence >= 50) {
      await saveActionableSignal(signal, currentPrice);
    }

    return signal;
  } catch (error) {
    console.error(`Error generating signal for ${symbol}:`, error);
    return null;
  }
}

/**
 * Calculate technical score from signals (-100 to 100)
 */
function calculateTechnicalScore(signals: MarketSignal[]): number {
  if (signals.length === 0) return 0;

  let bullishWeight = 0;
  let bearishWeight = 0;

  for (const signal of signals) {
    const weight = signal.strength * (signal.confidence / 100);

    if (signal.direction === 'bullish') {
      bullishWeight += weight;
    } else if (signal.direction === 'bearish') {
      bearishWeight += weight;
    }
  }

  const totalWeight = bullishWeight + bearishWeight;
  if (totalWeight === 0) return 0;

  // Normalize to -100 to 100
  const score = ((bullishWeight - bearishWeight) / totalWeight) * 100;
  return Math.max(-100, Math.min(100, score));
}

/**
 * Calculate sentiment score from news (-100 to 100)
 */
function calculateSentimentScore(sentiment: SignalContext['newsSentiment']): number {
  const total = sentiment.positive + sentiment.negative + sentiment.neutral;
  if (total === 0) return 0;

  // Use the average score directly (already -1 to 1)
  let score = sentiment.averageScore * 100;

  // Boost if trending
  if (sentiment.trend === 'improving') score += 15;
  else if (sentiment.trend === 'declining') score -= 15;

  return Math.max(-100, Math.min(100, score));
}

/**
 * Calculate momentum score from recent performance (-100 to 100)
 */
function calculateMomentumScore(performance: SignalContext['recentPerformance']): number {
  // Weight recent performance more heavily
  const score = (
    performance.change1d * 5 +   // Most recent
    performance.change5d * 2 +   // Short term
    performance.change1m * 0.5   // Medium term
  );

  return Math.max(-100, Math.min(100, score));
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  context: SignalContext,
  techScore: number,
  sentScore: number,
  momScore: number
): string[] {
  const reasons: string[] = [];

  // Technical reasoning
  if (techScore > 40) {
    const bullishSignals = context.technicalSignals.filter(s => s.direction === 'bullish');
    if (bullishSignals.length > 0) {
      reasons.push(`Strong technical setup: ${bullishSignals.map(s => s.type).join(', ')}`);
    }
  } else if (techScore < -40) {
    const bearishSignals = context.technicalSignals.filter(s => s.direction === 'bearish');
    if (bearishSignals.length > 0) {
      reasons.push(`Weak technical setup: ${bearishSignals.map(s => s.type).join(', ')}`);
    }
  } else if (context.technicalSignals.length > 0) {
    reasons.push('Mixed technical signals - no clear direction');
  }

  // Sentiment reasoning
  if (sentScore > 30) {
    reasons.push(`Positive news sentiment (${context.newsSentiment.positive} positive vs ${context.newsSentiment.negative} negative articles)`);
    if (context.newsSentiment.trend === 'improving') {
      reasons.push('Sentiment trend improving');
    }
  } else if (sentScore < -30) {
    reasons.push(`Negative news sentiment (${context.newsSentiment.negative} negative vs ${context.newsSentiment.positive} positive articles)`);
    if (context.newsSentiment.trend === 'declining') {
      reasons.push('Sentiment trend declining');
    }
  }

  // Momentum reasoning
  if (context.recentPerformance.change1d > 3) {
    reasons.push(`Strong daily momentum: +${context.recentPerformance.change1d.toFixed(1)}%`);
  } else if (context.recentPerformance.change1d < -3) {
    reasons.push(`Weak daily momentum: ${context.recentPerformance.change1d.toFixed(1)}%`);
  }

  if (context.recentPerformance.change5d > 5) {
    reasons.push(`Positive weekly trend: +${context.recentPerformance.change5d.toFixed(1)}%`);
  } else if (context.recentPerformance.change5d < -5) {
    reasons.push(`Negative weekly trend: ${context.recentPerformance.change5d.toFixed(1)}%`);
  }

  // Volatility warning
  if (context.recentPerformance.volatility > 50) {
    reasons.push(`High volatility (${context.recentPerformance.volatility.toFixed(0)}% annualized) - increased risk`);
  }

  if (reasons.length === 0) {
    reasons.push('No significant signals detected');
  }

  return reasons;
}

/**
 * Calculate price targets and stop loss
 */
function calculateTargets(context: SignalContext, action: ActionableSignal['action']): {
  priceTarget?: number;
  stopLoss?: number;
} {
  const price = context.price;
  const volatility = context.recentPerformance.volatility / 100; // Convert to decimal

  // ATR-based target (approximation using volatility)
  const atrMultiple = volatility * 0.1; // Rough approximation

  if (action === 'strong_buy' || action === 'buy') {
    return {
      priceTarget: price * (1 + atrMultiple * 3),
      stopLoss: price * (1 - atrMultiple * 1.5)
    };
  } else if (action === 'strong_sell' || action === 'sell') {
    return {
      priceTarget: price * (1 - atrMultiple * 3),
      stopLoss: price * (1 + atrMultiple * 1.5)
    };
  }

  return {};
}

/**
 * Calculate confidence score
 */
function calculateConfidence(
  signals: MarketSignal[],
  overallScore: number,
  volatility: number
): number {
  let confidence = 50; // Base confidence

  // More signals = more confidence
  confidence += Math.min(signals.length * 5, 25);

  // Stronger overall score = more confidence
  confidence += Math.abs(overallScore) * 0.2;

  // Higher volatility = less confidence
  confidence -= Math.min(volatility * 0.3, 20);

  // Consistent signal direction = more confidence
  const bullishCount = signals.filter(s => s.direction === 'bullish').length;
  const bearishCount = signals.filter(s => s.direction === 'bearish').length;
  const consistency = Math.abs(bullishCount - bearishCount) / Math.max(signals.length, 1);
  confidence += consistency * 15;

  return Math.max(10, Math.min(95, confidence));
}

/**
 * Save actionable signal to database
 */
async function saveActionableSignal(signal: ActionableSignal, currentPrice: number): Promise<void> {
  try {
    // Map action to direction
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (signal.action === 'strong_buy' || signal.action === 'buy') direction = 'bullish';
    else if (signal.action === 'strong_sell' || signal.action === 'sell') direction = 'bearish';

    // Check for recent similar signal
    const recentCheck = await query(
      `SELECT id FROM signals
       WHERE symbol = $1 AND direction = $2 AND signal_type = 'composite'
       AND created_at > NOW() - INTERVAL '4 hours'`,
      [signal.symbol, direction]
    );

    if (recentCheck.rows.length > 0) {
      return; // Skip duplicate
    }

    await query(
      `INSERT INTO signals (
        symbol, signal_type, direction, strength, title, description,
        indicators, price_at_signal, target_price, stop_price,
        timeframe, confidence, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        signal.symbol,
        'composite',
        direction,
        Math.min(10, Math.floor(Math.abs(signal.overallScore) / 10)),
        `${signal.action.replace('_', ' ').toUpperCase()} Signal for ${signal.symbol}`,
        signal.reasoning.join(' | '),
        JSON.stringify({
          technicalScore: signal.technicalScore,
          sentimentScore: signal.sentimentScore,
          overallScore: signal.overallScore,
          riskLevel: signal.riskLevel
        }),
        currentPrice,
        signal.priceTarget || null,
        signal.stopLoss || null,
        signal.timeframe,
        signal.confidence,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week expiry
      ]
    );

    console.log(`💾 Saved composite signal for ${signal.symbol}: ${signal.action} (${signal.confidence}% confidence)`);
  } catch (error) {
    console.error('Error saving actionable signal:', error);
  }
}

/**
 * Generate prediction for a symbol
 */
export async function generatePrediction(symbol: string): Promise<Prediction | null> {
  try {
    const signal = await generateSignal(symbol);
    if (!signal) return null;

    // Only generate predictions for high-confidence signals
    if (signal.confidence < 60) return null;

    const prediction: Prediction = {
      symbol,
      type: 'price_direction',
      timeframe: signal.timeframe === 'intraday' ? '1d' : signal.timeframe === 'swing' ? '1w' : '1m',
      prediction: {
        direction: signal.action.includes('buy') ? 'up' : signal.action.includes('sell') ? 'down' : 'sideways',
        targetPrice: signal.priceTarget,
        confidence: signal.confidence
      },
      reasoning: signal.reasoning.join(' | '),
      confidence: signal.confidence,
      priceAtPrediction: signal.priceTarget ? signal.priceTarget / (1 + 0.05) : 0 // Rough reverse calculation
    };

    // Save prediction
    await savePrediction(prediction);

    return prediction;
  } catch (error) {
    console.error(`Error generating prediction for ${symbol}:`, error);
    return null;
  }
}

/**
 * Save prediction to database
 */
async function savePrediction(prediction: Prediction): Promise<void> {
  try {
    // Calculate target date
    let targetDate = new Date();
    if (prediction.timeframe === '1d') targetDate.setDate(targetDate.getDate() + 1);
    else if (prediction.timeframe === '1w') targetDate.setDate(targetDate.getDate() + 7);
    else targetDate.setMonth(targetDate.getMonth() + 1);

    await query(
      `INSERT INTO predictions (
        symbol, prediction_type, timeframe, prediction, reasoning,
        confidence, price_at_prediction, target_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        prediction.symbol,
        prediction.type,
        prediction.timeframe,
        JSON.stringify(prediction.prediction),
        prediction.reasoning,
        prediction.confidence,
        prediction.priceAtPrediction,
        targetDate
      ]
    );

    console.log(`🔮 Saved prediction for ${prediction.symbol}: ${prediction.prediction.direction}`);
  } catch (error) {
    console.error('Error saving prediction:', error);
  }
}

/**
 * Run full signal generation for all tracked symbols
 */
export async function runSignalGeneration(): Promise<void> {
  console.log('🎯 Running signal generation...');

  try {
    // Get tracked symbols
    const trackedResult = await query(
      `SELECT symbol FROM tracked_symbols WHERE is_active = true ORDER BY priority DESC LIMIT 30`
    );

    const symbols = trackedResult.rows.map(r => r.symbol);

    for (const symbol of symbols) {
      try {
        await generateSignal(symbol);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error generating signal for ${symbol}:`, error);
      }
    }

    console.log('🎯 Signal generation complete');
  } catch (error) {
    console.error('Error in signal generation:', error);
  }
}

/**
 * Get the latest actionable signal for a symbol
 */
export async function getLatestSignal(symbol: string): Promise<ActionableSignal | null> {
  try {
    const result = await query(
      `SELECT * FROM signals
       WHERE symbol = $1 AND signal_type = 'composite' AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [symbol]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const indicators = row.indicators || {};

    return {
      symbol: row.symbol,
      action: row.direction === 'bullish' ? 'buy' : row.direction === 'bearish' ? 'sell' : 'hold',
      confidence: row.confidence,
      reasoning: row.description.split(' | '),
      priceTarget: parseFloat(row.target_price) || undefined,
      stopLoss: parseFloat(row.stop_price) || undefined,
      timeframe: row.timeframe,
      riskLevel: indicators.riskLevel || 'medium',
      technicalScore: indicators.technicalScore || 0,
      sentimentScore: indicators.sentimentScore || 0,
      overallScore: indicators.overallScore || 0
    };
  } catch (error) {
    console.error(`Error getting latest signal for ${symbol}:`, error);
    return null;
  }
}
