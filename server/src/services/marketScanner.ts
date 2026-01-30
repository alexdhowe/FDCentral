/**
 * Market Scanner Service
 * Continuously monitors stocks for trading signals and opportunities
 * Acts as an autonomous trading research assistant
 */

import { query } from '../db/index.js';
import { getQuote, getHistoricalData } from './stockData.js';
import {
  calculateIndicators,
  generateSignals,
  TechnicalIndicators,
  SignalScore,
  HistoricalBar,
} from './technicalAnalysis.js';

export interface MarketSignal {
  symbol: string;
  signalType: 'technical' | 'volume' | 'momentum' | 'reversal' | 'breakout' | 'divergence';
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 1-10
  title: string;
  description: string;
  indicators: Record<string, any>;
  priceAtSignal: number;
  targetPrice?: number;
  stopPrice?: number;
  timeframe: 'intraday' | 'swing' | 'position';
  confidence: number;
  expiresAt?: Date;
}

export interface ScanResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  signals: MarketSignal[];
  indicators: TechnicalIndicators;
  score: SignalScore;
  analysis: string;
}

// Signal detection thresholds
const THRESHOLDS = {
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  RSI_EXTREME_OVERSOLD: 20,
  RSI_EXTREME_OVERBOUGHT: 80,
  VOLUME_SPIKE: 2.0, // 2x average volume
  VOLUME_EXTREME: 3.0,
  MACD_HISTOGRAM_THRESHOLD: 0.5,
  BOLLINGER_SQUEEZE: 0.08,
  ADX_STRONG_TREND: 25,
  ADX_VERY_STRONG: 40,
  STOCH_OVERSOLD: 20,
  STOCH_OVERBOUGHT: 80,
};

/**
 * Scan a single symbol for trading signals
 */
export async function scanSymbol(symbol: string): Promise<ScanResult | null> {
  try {
    const [quote, historical] = await Promise.all([
      getQuote(symbol),
      getHistoricalData(symbol, '3mo'),
    ]);

    if (!quote || !historical || historical.length < 50) {
      return null;
    }

    // Calculate all indicators
    const indicators = calculateIndicators(historical);
    const signalScore = generateSignals(indicators, quote.price);
    const signals: MarketSignal[] = [];

    // Detect various signal types
    signals.push(...detectTechnicalSignals(symbol, quote.price, indicators, signalScore));
    signals.push(...detectVolumeSignals(symbol, quote.price, indicators));
    signals.push(...detectMomentumSignals(symbol, quote.price, indicators));
    signals.push(...detectReversalSignals(symbol, quote.price, indicators, signalScore));
    signals.push(...detectBreakoutSignals(symbol, quote.price, indicators));
    signals.push(...detectDivergenceSignals(symbol, quote.price, indicators, historical));

    // Generate analysis summary
    const analysis = generateAnalysisSummary(symbol, quote, indicators, signalScore, signals);

    return {
      symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      signals,
      indicators,
      score: signalScore,
      analysis,
    };
  } catch (error) {
    console.error(`Error scanning ${symbol}:`, error);
    return null;
  }
}

/**
 * Detect technical analysis signals
 */
function detectTechnicalSignals(
  symbol: string,
  price: number,
  indicators: TechnicalIndicators,
  score: SignalScore
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // Strong overall signal
  if (Math.abs(score.score) >= 50 && score.confidence >= 65) {
    const direction = score.score > 0 ? 'bullish' : 'bearish';
    const strength = Math.min(10, Math.floor(Math.abs(score.score) / 10));

    signals.push({
      symbol,
      signalType: 'technical',
      direction,
      strength,
      title: `Strong ${direction.toUpperCase()} Technical Setup`,
      description: `Multiple indicators align for a ${direction} outlook. Score: ${score.score}, Confidence: ${score.confidence}%. Key signals: ${score.signals.filter(s => s.signal === direction).slice(0, 3).map(s => s.indicator).join(', ')}.`,
      indicators: {
        score: score.score,
        confidence: score.confidence,
        rsi: indicators.rsi,
        macdHistogram: indicators.macdHistogram,
        adx: indicators.adx,
      },
      priceAtSignal: price,
      targetPrice: direction === 'bullish' ? indicators.resistance1 : indicators.support1,
      stopPrice: direction === 'bullish' ? indicators.support1 : indicators.resistance1,
      timeframe: 'swing',
      confidence: score.confidence,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
    });
  }

  // Golden Cross / Death Cross
  if (indicators.sma20 > indicators.sma50 && indicators.sma50 > indicators.sma200) {
    signals.push({
      symbol,
      signalType: 'technical',
      direction: 'bullish',
      strength: 8,
      title: 'Golden Cross Alignment',
      description: `Perfect bullish MA alignment: 20 SMA > 50 SMA > 200 SMA. Strong uptrend structure confirmed.`,
      indicators: { sma20: indicators.sma20, sma50: indicators.sma50, sma200: indicators.sma200 },
      priceAtSignal: price,
      targetPrice: price * 1.1,
      timeframe: 'position',
      confidence: 75,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  } else if (indicators.sma20 < indicators.sma50 && indicators.sma50 < indicators.sma200) {
    signals.push({
      symbol,
      signalType: 'technical',
      direction: 'bearish',
      strength: 8,
      title: 'Death Cross Alignment',
      description: `Perfect bearish MA alignment: 20 SMA < 50 SMA < 200 SMA. Strong downtrend structure confirmed.`,
      indicators: { sma20: indicators.sma20, sma50: indicators.sma50, sma200: indicators.sma200 },
      priceAtSignal: price,
      targetPrice: price * 0.9,
      timeframe: 'position',
      confidence: 75,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  return signals;
}

/**
 * Detect volume-based signals
 */
function detectVolumeSignals(
  symbol: string,
  price: number,
  indicators: TechnicalIndicators
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  if (indicators.volumeRatio >= THRESHOLDS.VOLUME_EXTREME) {
    const direction = indicators.obvTrend === 'accumulation' ? 'bullish' :
                     indicators.obvTrend === 'distribution' ? 'bearish' : 'neutral';

    signals.push({
      symbol,
      signalType: 'volume',
      direction,
      strength: 9,
      title: `EXTREME Volume Alert - ${indicators.volumeRatio.toFixed(1)}x Average`,
      description: `Unusual volume activity detected at ${indicators.volumeRatio.toFixed(1)}x normal levels. OBV indicates ${indicators.obvTrend}. This could signal a major move incoming.`,
      indicators: { volumeRatio: indicators.volumeRatio, obvTrend: indicators.obvTrend },
      priceAtSignal: price,
      timeframe: 'intraday',
      confidence: 70,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } else if (indicators.volumeRatio >= THRESHOLDS.VOLUME_SPIKE) {
    signals.push({
      symbol,
      signalType: 'volume',
      direction: indicators.obvTrend === 'accumulation' ? 'bullish' : 'bearish',
      strength: 6,
      title: `Volume Spike - ${indicators.volumeRatio.toFixed(1)}x Average`,
      description: `Above-average volume indicates increased interest. OBV showing ${indicators.obvTrend}.`,
      indicators: { volumeRatio: indicators.volumeRatio, obvTrend: indicators.obvTrend },
      priceAtSignal: price,
      timeframe: 'intraday',
      confidence: 55,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
  }

  return signals;
}

/**
 * Detect momentum signals
 */
function detectMomentumSignals(
  symbol: string,
  price: number,
  indicators: TechnicalIndicators
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // MACD Crossover
  if (indicators.macdCrossover === 'bullish') {
    signals.push({
      symbol,
      signalType: 'momentum',
      direction: 'bullish',
      strength: 8,
      title: 'MACD Bullish Crossover',
      description: `MACD line crossed above signal line. Histogram: ${indicators.macdHistogram.toFixed(3)}. Momentum shifting bullish.`,
      indicators: { macd: indicators.macd, macdSignal: indicators.macdSignal, macdHistogram: indicators.macdHistogram },
      priceAtSignal: price,
      targetPrice: indicators.resistance1,
      timeframe: 'swing',
      confidence: 70,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  } else if (indicators.macdCrossover === 'bearish') {
    signals.push({
      symbol,
      signalType: 'momentum',
      direction: 'bearish',
      strength: 8,
      title: 'MACD Bearish Crossover',
      description: `MACD line crossed below signal line. Histogram: ${indicators.macdHistogram.toFixed(3)}. Momentum shifting bearish.`,
      indicators: { macd: indicators.macd, macdSignal: indicators.macdSignal, macdHistogram: indicators.macdHistogram },
      priceAtSignal: price,
      targetPrice: indicators.support1,
      timeframe: 'swing',
      confidence: 70,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  // Stochastic signals
  if (indicators.stochK < THRESHOLDS.STOCH_OVERSOLD && indicators.stochK > indicators.stochD) {
    signals.push({
      symbol,
      signalType: 'momentum',
      direction: 'bullish',
      strength: 7,
      title: 'Stochastic Bullish Crossover in Oversold',
      description: `%K (${indicators.stochK.toFixed(1)}) crossed above %D (${indicators.stochD.toFixed(1)}) in oversold territory. Potential reversal setup.`,
      indicators: { stochK: indicators.stochK, stochD: indicators.stochD },
      priceAtSignal: price,
      timeframe: 'swing',
      confidence: 65,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  } else if (indicators.stochK > THRESHOLDS.STOCH_OVERBOUGHT && indicators.stochK < indicators.stochD) {
    signals.push({
      symbol,
      signalType: 'momentum',
      direction: 'bearish',
      strength: 7,
      title: 'Stochastic Bearish Crossover in Overbought',
      description: `%K (${indicators.stochK.toFixed(1)}) crossed below %D (${indicators.stochD.toFixed(1)}) in overbought territory. Potential pullback.`,
      indicators: { stochK: indicators.stochK, stochD: indicators.stochD },
      priceAtSignal: price,
      timeframe: 'swing',
      confidence: 65,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  return signals;
}

/**
 * Detect reversal signals
 */
function detectReversalSignals(
  symbol: string,
  price: number,
  indicators: TechnicalIndicators,
  score: SignalScore
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // Extreme RSI conditions
  if (indicators.rsi <= THRESHOLDS.RSI_EXTREME_OVERSOLD) {
    signals.push({
      symbol,
      signalType: 'reversal',
      direction: 'bullish',
      strength: 9,
      title: `EXTREME Oversold - RSI ${indicators.rsi.toFixed(1)}`,
      description: `RSI at extreme oversold levels (${indicators.rsi.toFixed(1)}). Historically, this level has led to sharp rebounds. High risk/reward reversal setup.`,
      indicators: { rsi: indicators.rsi, rsiTrend: indicators.rsiTrend },
      priceAtSignal: price,
      targetPrice: indicators.sma20,
      stopPrice: price * 0.95,
      timeframe: 'swing',
      confidence: 75,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
  } else if (indicators.rsi >= THRESHOLDS.RSI_EXTREME_OVERBOUGHT) {
    signals.push({
      symbol,
      signalType: 'reversal',
      direction: 'bearish',
      strength: 9,
      title: `EXTREME Overbought - RSI ${indicators.rsi.toFixed(1)}`,
      description: `RSI at extreme overbought levels (${indicators.rsi.toFixed(1)}). Warning: Extended conditions often lead to pullbacks.`,
      indicators: { rsi: indicators.rsi, rsiTrend: indicators.rsiTrend },
      priceAtSignal: price,
      targetPrice: indicators.sma20,
      stopPrice: price * 1.05,
      timeframe: 'swing',
      confidence: 70,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
  }

  // Bollinger Band extremes
  if (indicators.bollingerPosition <= 0.05) {
    signals.push({
      symbol,
      signalType: 'reversal',
      direction: 'bullish',
      strength: 7,
      title: 'Price at Lower Bollinger Band',
      description: `Price testing lower Bollinger Band. Mean reversion play potential. Band position: ${(indicators.bollingerPosition * 100).toFixed(1)}%.`,
      indicators: { bollingerPosition: indicators.bollingerPosition, bollingerLower: indicators.bollingerLower },
      priceAtSignal: price,
      targetPrice: indicators.bollingerMiddle,
      stopPrice: indicators.bollingerLower * 0.98,
      timeframe: 'swing',
      confidence: 60,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
  } else if (indicators.bollingerPosition >= 0.95) {
    signals.push({
      symbol,
      signalType: 'reversal',
      direction: 'bearish',
      strength: 6,
      title: 'Price at Upper Bollinger Band',
      description: `Price at upper Bollinger Band. Could signal exhaustion or breakout continuation. Band position: ${(indicators.bollingerPosition * 100).toFixed(1)}%.`,
      indicators: { bollingerPosition: indicators.bollingerPosition, bollingerUpper: indicators.bollingerUpper },
      priceAtSignal: price,
      targetPrice: indicators.bollingerMiddle,
      timeframe: 'swing',
      confidence: 55,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
  }

  return signals;
}

/**
 * Detect breakout signals
 */
function detectBreakoutSignals(
  symbol: string,
  price: number,
  indicators: TechnicalIndicators
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // Bollinger Band squeeze (low volatility = breakout coming)
  if (indicators.bollingerWidth < THRESHOLDS.BOLLINGER_SQUEEZE) {
    signals.push({
      symbol,
      signalType: 'breakout',
      direction: 'neutral',
      strength: 8,
      title: 'Bollinger Band SQUEEZE - Breakout Imminent',
      description: `Volatility compression detected (width: ${(indicators.bollingerWidth * 100).toFixed(2)}%). Major move expected. Direction uncertain - watch for breakout direction.`,
      indicators: { bollingerWidth: indicators.bollingerWidth, atr: indicators.atr, atrPercent: indicators.atrPercent },
      priceAtSignal: price,
      targetPrice: indicators.bollingerUpper,
      stopPrice: indicators.bollingerLower,
      timeframe: 'swing',
      confidence: 70,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  // Strong trend breakout (ADX + directional)
  if (indicators.adx >= THRESHOLDS.ADX_VERY_STRONG) {
    const direction = indicators.plusDI > indicators.minusDI ? 'bullish' : 'bearish';
    signals.push({
      symbol,
      signalType: 'breakout',
      direction,
      strength: 9,
      title: `VERY STRONG ${direction.toUpperCase()} Trend - ADX ${indicators.adx.toFixed(1)}`,
      description: `ADX at ${indicators.adx.toFixed(1)} indicates extremely strong trend. +DI: ${indicators.plusDI.toFixed(1)}, -DI: ${indicators.minusDI.toFixed(1)}. Trend likely to continue.`,
      indicators: { adx: indicators.adx, plusDI: indicators.plusDI, minusDI: indicators.minusDI },
      priceAtSignal: price,
      timeframe: 'position',
      confidence: 80,
      expiresAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    });
  }

  // Price structure breakout
  if (indicators.higherHighs && indicators.higherLows) {
    signals.push({
      symbol,
      signalType: 'breakout',
      direction: 'bullish',
      strength: 7,
      title: 'Bullish Price Structure',
      description: `Making higher highs and higher lows. Classic uptrend structure confirmed. Look for continuation.`,
      indicators: { higherHighs: indicators.higherHighs, higherLows: indicators.higherLows },
      priceAtSignal: price,
      targetPrice: indicators.resistance2,
      stopPrice: indicators.support1,
      timeframe: 'swing',
      confidence: 65,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  } else if (indicators.lowerHighs && indicators.lowerLows) {
    signals.push({
      symbol,
      signalType: 'breakout',
      direction: 'bearish',
      strength: 7,
      title: 'Bearish Price Structure',
      description: `Making lower highs and lower lows. Classic downtrend structure confirmed. Expect continued weakness.`,
      indicators: { lowerHighs: indicators.lowerHighs, lowerLows: indicators.lowerLows },
      priceAtSignal: price,
      targetPrice: indicators.support2,
      stopPrice: indicators.resistance1,
      timeframe: 'swing',
      confidence: 65,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  return signals;
}

/**
 * Detect divergence signals (price vs indicator)
 */
function detectDivergenceSignals(
  symbol: string,
  price: number,
  indicators: TechnicalIndicators,
  historical: HistoricalBar[]
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  // Check for RSI divergence (simplified - would need more historical RSI data for full implementation)
  // Bullish divergence: price making lower lows, RSI making higher lows
  // Bearish divergence: price making higher highs, RSI making lower highs

  if (indicators.lowerLows && indicators.rsi > 35 && indicators.rsi < 50) {
    // Potential bullish divergence
    signals.push({
      symbol,
      signalType: 'divergence',
      direction: 'bullish',
      strength: 8,
      title: 'Potential Bullish Divergence',
      description: `Price making lower lows but RSI (${indicators.rsi.toFixed(1)}) showing relative strength. Momentum may be shifting bullish.`,
      indicators: { rsi: indicators.rsi, lowerLows: indicators.lowerLows },
      priceAtSignal: price,
      targetPrice: indicators.sma50,
      timeframe: 'swing',
      confidence: 60,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
  }

  if (indicators.higherHighs && indicators.rsi < 65 && indicators.rsi > 50) {
    // Potential bearish divergence
    signals.push({
      symbol,
      signalType: 'divergence',
      direction: 'bearish',
      strength: 8,
      title: 'Potential Bearish Divergence',
      description: `Price making higher highs but RSI (${indicators.rsi.toFixed(1)}) showing weakness. Momentum may be fading.`,
      indicators: { rsi: indicators.rsi, higherHighs: indicators.higherHighs },
      priceAtSignal: price,
      targetPrice: indicators.sma50,
      timeframe: 'swing',
      confidence: 60,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
  }

  return signals;
}

/**
 * Generate a human-readable analysis summary
 */
function generateAnalysisSummary(
  symbol: string,
  quote: any,
  indicators: TechnicalIndicators,
  score: SignalScore,
  signals: MarketSignal[]
): string {
  const direction = score.score > 20 ? 'BULLISH' : score.score < -20 ? 'BEARISH' : 'NEUTRAL';
  const trendStrength = indicators.trendStrength.toUpperCase();

  let summary = `${symbol} ANALYSIS | ${direction} (Score: ${score.score}, Confidence: ${score.confidence}%)\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `Price: $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)\n`;
  summary += `Trend: ${trendStrength} (ADX: ${indicators.adx.toFixed(1)})\n\n`;

  summary += `KEY LEVELS:\n`;
  summary += `• Resistance: $${indicators.resistance1.toFixed(2)} / $${indicators.resistance2.toFixed(2)}\n`;
  summary += `• Support: $${indicators.support1.toFixed(2)} / $${indicators.support2.toFixed(2)}\n`;
  summary += `• 50 SMA: $${indicators.sma50.toFixed(2)} | 200 SMA: $${indicators.sma200.toFixed(2)}\n\n`;

  summary += `INDICATORS:\n`;
  summary += `• RSI(14): ${indicators.rsi.toFixed(1)} [${indicators.rsiTrend}]\n`;
  summary += `• MACD: ${indicators.macdHistogram > 0 ? '+' : ''}${indicators.macdHistogram.toFixed(3)} [${indicators.macdCrossover}]\n`;
  summary += `• Stoch: %K=${indicators.stochK.toFixed(1)}, %D=${indicators.stochD.toFixed(1)}\n`;
  summary += `• Volume: ${indicators.volumeRatio.toFixed(1)}x avg [${indicators.obvTrend}]\n`;
  summary += `• ATR: $${indicators.atr.toFixed(2)} (${indicators.atrPercent.toFixed(1)}%)\n\n`;

  if (signals.length > 0) {
    summary += `ACTIVE SIGNALS (${signals.length}):\n`;
    signals.slice(0, 5).forEach((sig, i) => {
      const icon = sig.direction === 'bullish' ? '🟢' : sig.direction === 'bearish' ? '🔴' : '🟡';
      summary += `${i + 1}. ${icon} ${sig.title} [Strength: ${sig.strength}/10]\n`;
    });
  }

  return summary;
}

/**
 * Save signal to database
 */
export async function saveSignal(signal: MarketSignal): Promise<string> {
  const result = await query(
    `INSERT INTO signals
     (symbol, signal_type, direction, strength, title, description, indicators,
      price_at_signal, target_price, stop_price, timeframe, confidence, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      signal.symbol,
      signal.signalType,
      signal.direction,
      signal.strength,
      signal.title,
      signal.description,
      JSON.stringify(signal.indicators),
      signal.priceAtSignal,
      signal.targetPrice || null,
      signal.stopPrice || null,
      signal.timeframe,
      signal.confidence,
      signal.expiresAt || null,
    ]
  );
  return result.rows[0].id;
}

/**
 * Save analysis snapshot to database
 */
export async function saveAnalysis(
  symbol: string,
  analysisType: string,
  data: any,
  score: number,
  summary: string
): Promise<string> {
  const result = await query(
    `INSERT INTO market_analysis (symbol, analysis_type, data, score, summary)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [symbol, analysisType, JSON.stringify(data), score, summary]
  );
  return result.rows[0].id;
}

/**
 * Get tracked symbols for scanning
 */
export async function getTrackedSymbols(): Promise<string[]> {
  const result = await query(
    `SELECT symbol FROM tracked_symbols WHERE is_active = true ORDER BY priority DESC, last_scanned_at ASC NULLS FIRST`
  );
  return result.rows.map((r: any) => r.symbol);
}

/**
 * Update last scanned timestamp
 */
export async function updateLastScanned(symbol: string): Promise<void> {
  await query(
    `UPDATE tracked_symbols SET last_scanned_at = NOW() WHERE symbol = $1`,
    [symbol]
  );
}

/**
 * Add symbol to tracking
 */
export async function addTrackedSymbol(symbol: string, name?: string, userId?: string): Promise<void> {
  await query(
    `INSERT INTO tracked_symbols (symbol, name, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (symbol) DO UPDATE SET is_active = true`,
    [symbol.toUpperCase(), name || null, userId || null]
  );
}
