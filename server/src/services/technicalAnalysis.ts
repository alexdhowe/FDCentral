/**
 * Advanced Technical Analysis Engine
 * The brain behind FD Central's tendies machine
 */

export interface TechnicalIndicators {
  // Trend Indicators
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  ema9: number;

  // Momentum
  rsi: number;
  rsiTrend: 'oversold' | 'neutral' | 'overbought';
  stochK: number;
  stochD: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdCrossover: 'bullish' | 'bearish' | 'none';

  // Volatility
  atr: number;
  atrPercent: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerWidth: number;
  bollingerPosition: number; // 0-1, where in the band

  // Volume
  volumeSMA: number;
  volumeRatio: number; // Current vs average
  obv: number;
  obvTrend: 'accumulation' | 'distribution' | 'neutral';

  // Trend Strength
  adx: number;
  plusDI: number;
  minusDI: number;
  trendStrength: 'weak' | 'moderate' | 'strong' | 'very_strong';

  // Support/Resistance
  pivotPoint: number;
  resistance1: number;
  resistance2: number;
  support1: number;
  support2: number;

  // Pattern Detection
  higherHighs: boolean;
  higherLows: boolean;
  lowerHighs: boolean;
  lowerLows: boolean;
}

export interface SignalScore {
  score: number; // -100 to +100
  confidence: number; // 0-100
  signals: SignalDetail[];
}

export interface SignalDetail {
  indicator: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 1-10
  description: string;
}

export interface HistoricalBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculate all technical indicators from historical data
 */
export function calculateIndicators(data: HistoricalBar[]): TechnicalIndicators {
  if (data.length < 50) {
    throw new Error('Need at least 50 bars for analysis');
  }

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  const currentClose = closes[closes.length - 1];

  // Moving Averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = closes.length >= 200 ? calculateSMA(closes, 200) : sma50;
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema9 = calculateEMA(closes, 9);

  // RSI
  const rsi = calculateRSI(closes, 14);
  const rsiTrend = rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';

  // Stochastic
  const { k: stochK, d: stochD } = calculateStochastic(highs, lows, closes, 14, 3);

  // MACD
  const macd = ema12 - ema26;
  const macdValues = calculateMACDLine(closes);
  const macdSignal = calculateEMA(macdValues.slice(-26), 9);
  const macdHistogram = macd - macdSignal;
  const prevMacdHistogram = macdValues[macdValues.length - 2] - calculateEMA(macdValues.slice(-27, -1), 9);
  const macdCrossover = macdHistogram > 0 && prevMacdHistogram <= 0 ? 'bullish' :
                        macdHistogram < 0 && prevMacdHistogram >= 0 ? 'bearish' : 'none';

  // ATR
  const atr = calculateATR(highs, lows, closes, 14);
  const atrPercent = (atr / currentClose) * 100;

  // Bollinger Bands
  const bollingerMiddle = sma20;
  const stdDev = calculateStdDev(closes.slice(-20));
  const bollingerUpper = bollingerMiddle + (stdDev * 2);
  const bollingerLower = bollingerMiddle - (stdDev * 2);
  const bollingerWidth = (bollingerUpper - bollingerLower) / bollingerMiddle;
  const bollingerPosition = (currentClose - bollingerLower) / (bollingerUpper - bollingerLower);

  // Volume
  const volumeSMA = calculateSMA(volumes, 20);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / volumeSMA;
  const { obv, trend: obvTrend } = calculateOBV(closes, volumes);

  // ADX
  const { adx, plusDI, minusDI } = calculateADX(highs, lows, closes, 14);
  const trendStrength = adx < 20 ? 'weak' : adx < 40 ? 'moderate' : adx < 60 ? 'strong' : 'very_strong';

  // Pivot Points
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const pivotPoint = (lastHigh + lastLow + currentClose) / 3;
  const resistance1 = (2 * pivotPoint) - lastLow;
  const resistance2 = pivotPoint + (lastHigh - lastLow);
  const support1 = (2 * pivotPoint) - lastHigh;
  const support2 = pivotPoint - (lastHigh - lastLow);

  // Pattern Detection
  const recentHighs = highs.slice(-10);
  const recentLows = lows.slice(-10);
  const higherHighs = recentHighs.slice(-5).every((h, i, arr) => i === 0 || h >= arr[i - 1]);
  const higherLows = recentLows.slice(-5).every((l, i, arr) => i === 0 || l >= arr[i - 1]);
  const lowerHighs = recentHighs.slice(-5).every((h, i, arr) => i === 0 || h <= arr[i - 1]);
  const lowerLows = recentLows.slice(-5).every((l, i, arr) => i === 0 || l <= arr[i - 1]);

  return {
    sma20, sma50, sma200, ema12, ema26, ema9,
    rsi, rsiTrend, stochK, stochD,
    macd, macdSignal, macdHistogram, macdCrossover,
    atr, atrPercent,
    bollingerUpper, bollingerMiddle, bollingerLower, bollingerWidth, bollingerPosition,
    volumeSMA, volumeRatio, obv, obvTrend,
    adx, plusDI, minusDI, trendStrength,
    pivotPoint, resistance1, resistance2, support1, support2,
    higherHighs, higherLows, lowerHighs, lowerLows
  };
}

/**
 * Generate trading signals with confidence scoring
 */
export function generateSignals(indicators: TechnicalIndicators, currentPrice: number): SignalScore {
  const signals: SignalDetail[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  // ===== TREND SIGNALS =====

  // Price vs Moving Averages (weight: 15)
  const maScore = (currentPrice > indicators.sma20 ? 5 : -5) +
                  (currentPrice > indicators.sma50 ? 5 : -5) +
                  (currentPrice > indicators.sma200 ? 5 : -5);
  signals.push({
    indicator: 'Moving Averages',
    signal: maScore > 5 ? 'bullish' : maScore < -5 ? 'bearish' : 'neutral',
    strength: Math.abs(maScore) / 15 * 10,
    description: `Price ${currentPrice > indicators.sma50 ? 'above' : 'below'} 50 SMA, ${
      indicators.sma20 > indicators.sma50 ? 'golden' : 'death'} cross forming`
  });
  totalScore += maScore;
  totalWeight += 15;

  // Golden/Death Cross (weight: 10)
  if (indicators.sma20 > indicators.sma50 && indicators.sma50 > indicators.sma200) {
    signals.push({
      indicator: 'MA Alignment',
      signal: 'bullish',
      strength: 8,
      description: 'Perfect bullish alignment (20 > 50 > 200 SMA)'
    });
    totalScore += 10;
  } else if (indicators.sma20 < indicators.sma50 && indicators.sma50 < indicators.sma200) {
    signals.push({
      indicator: 'MA Alignment',
      signal: 'bearish',
      strength: 8,
      description: 'Perfect bearish alignment (20 < 50 < 200 SMA)'
    });
    totalScore -= 10;
  }
  totalWeight += 10;

  // ===== MOMENTUM SIGNALS =====

  // RSI (weight: 12)
  let rsiScore = 0;
  if (indicators.rsi < 30) {
    rsiScore = 12; // Oversold - bullish
    signals.push({
      indicator: 'RSI',
      signal: 'bullish',
      strength: 9,
      description: `RSI at ${indicators.rsi.toFixed(1)} - OVERSOLD bounce opportunity`
    });
  } else if (indicators.rsi > 70) {
    rsiScore = -12; // Overbought - bearish
    signals.push({
      indicator: 'RSI',
      signal: 'bearish',
      strength: 9,
      description: `RSI at ${indicators.rsi.toFixed(1)} - OVERBOUGHT reversal risk`
    });
  } else if (indicators.rsi > 50 && indicators.rsi < 60) {
    rsiScore = 5; // Healthy uptrend
    signals.push({
      indicator: 'RSI',
      signal: 'bullish',
      strength: 5,
      description: `RSI at ${indicators.rsi.toFixed(1)} - Healthy upward momentum`
    });
  }
  totalScore += rsiScore;
  totalWeight += 12;

  // MACD (weight: 15)
  let macdScore = 0;
  if (indicators.macdCrossover === 'bullish') {
    macdScore = 15;
    signals.push({
      indicator: 'MACD',
      signal: 'bullish',
      strength: 10,
      description: 'MACD BULLISH CROSSOVER - Strong buy signal!'
    });
  } else if (indicators.macdCrossover === 'bearish') {
    macdScore = -15;
    signals.push({
      indicator: 'MACD',
      signal: 'bearish',
      strength: 10,
      description: 'MACD BEARISH CROSSOVER - Strong sell signal!'
    });
  } else if (indicators.macdHistogram > 0) {
    macdScore = 7;
    signals.push({
      indicator: 'MACD',
      signal: 'bullish',
      strength: 6,
      description: 'MACD histogram positive - Bullish momentum'
    });
  } else {
    macdScore = -7;
    signals.push({
      indicator: 'MACD',
      signal: 'bearish',
      strength: 6,
      description: 'MACD histogram negative - Bearish momentum'
    });
  }
  totalScore += macdScore;
  totalWeight += 15;

  // Stochastic (weight: 10)
  let stochScore = 0;
  if (indicators.stochK < 20 && indicators.stochK > indicators.stochD) {
    stochScore = 10;
    signals.push({
      indicator: 'Stochastic',
      signal: 'bullish',
      strength: 8,
      description: 'Stochastic bullish crossover in oversold zone'
    });
  } else if (indicators.stochK > 80 && indicators.stochK < indicators.stochD) {
    stochScore = -10;
    signals.push({
      indicator: 'Stochastic',
      signal: 'bearish',
      strength: 8,
      description: 'Stochastic bearish crossover in overbought zone'
    });
  }
  totalScore += stochScore;
  totalWeight += 10;

  // ===== VOLATILITY SIGNALS =====

  // Bollinger Bands (weight: 10)
  let bbScore = 0;
  if (indicators.bollingerPosition < 0.1) {
    bbScore = 10;
    signals.push({
      indicator: 'Bollinger Bands',
      signal: 'bullish',
      strength: 8,
      description: 'Price at lower Bollinger Band - Potential bounce'
    });
  } else if (indicators.bollingerPosition > 0.9) {
    bbScore = -5; // Less bearish because breakouts happen
    signals.push({
      indicator: 'Bollinger Bands',
      signal: 'bearish',
      strength: 5,
      description: 'Price at upper Bollinger Band - Extended'
    });
  }
  if (indicators.bollingerWidth < 0.1) {
    signals.push({
      indicator: 'BB Squeeze',
      signal: 'neutral',
      strength: 7,
      description: 'Bollinger Band SQUEEZE - Breakout imminent!'
    });
  }
  totalScore += bbScore;
  totalWeight += 10;

  // ===== VOLUME SIGNALS =====

  // Volume (weight: 12)
  let volumeScore = 0;
  if (indicators.volumeRatio > 2 && indicators.obvTrend === 'accumulation') {
    volumeScore = 12;
    signals.push({
      indicator: 'Volume',
      signal: 'bullish',
      strength: 9,
      description: `Volume ${indicators.volumeRatio.toFixed(1)}x average - ACCUMULATION`
    });
  } else if (indicators.volumeRatio > 2 && indicators.obvTrend === 'distribution') {
    volumeScore = -12;
    signals.push({
      indicator: 'Volume',
      signal: 'bearish',
      strength: 9,
      description: `Volume ${indicators.volumeRatio.toFixed(1)}x average - DISTRIBUTION`
    });
  } else if (indicators.obvTrend === 'accumulation') {
    volumeScore = 6;
    signals.push({
      indicator: 'OBV',
      signal: 'bullish',
      strength: 6,
      description: 'On-Balance Volume shows accumulation'
    });
  }
  totalScore += volumeScore;
  totalWeight += 12;

  // ===== TREND STRENGTH =====

  // ADX (weight: 8)
  let adxScore = 0;
  if (indicators.adx > 25) {
    if (indicators.plusDI > indicators.minusDI) {
      adxScore = 8;
      signals.push({
        indicator: 'ADX',
        signal: 'bullish',
        strength: 7,
        description: `Strong uptrend (ADX: ${indicators.adx.toFixed(1)})`
      });
    } else {
      adxScore = -8;
      signals.push({
        indicator: 'ADX',
        signal: 'bearish',
        strength: 7,
        description: `Strong downtrend (ADX: ${indicators.adx.toFixed(1)})`
      });
    }
  }
  totalScore += adxScore;
  totalWeight += 8;

  // ===== PATTERN SIGNALS =====

  // Higher Highs/Lows (weight: 8)
  if (indicators.higherHighs && indicators.higherLows) {
    totalScore += 8;
    signals.push({
      indicator: 'Price Structure',
      signal: 'bullish',
      strength: 8,
      description: 'Making higher highs and higher lows - UPTREND'
    });
  } else if (indicators.lowerHighs && indicators.lowerLows) {
    totalScore -= 8;
    signals.push({
      indicator: 'Price Structure',
      signal: 'bearish',
      strength: 8,
      description: 'Making lower highs and lower lows - DOWNTREND'
    });
  }
  totalWeight += 8;

  // Calculate final score normalized to -100 to +100
  const normalizedScore = (totalScore / totalWeight) * 100;

  // Calculate confidence based on signal agreement
  const bullishSignals = signals.filter(s => s.signal === 'bullish').length;
  const bearishSignals = signals.filter(s => s.signal === 'bearish').length;
  const signalAgreement = Math.abs(bullishSignals - bearishSignals) / signals.length;
  const confidence = Math.min(95, 50 + (signalAgreement * 45) + (indicators.adx / 2));

  return {
    score: Math.round(normalizedScore),
    confidence: Math.round(confidence),
    signals
  };
}

// ===== HELPER FUNCTIONS =====

function calculateSMA(data: number[], period: number): number {
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes: number[], period: number): number {
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number, dPeriod: number) {
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const currentClose = closes[closes.length - 1];

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  // Calculate %D as SMA of %K
  const kValues: number[] = [];
  for (let i = kPeriod; i <= closes.length; i++) {
    const hh = Math.max(...highs.slice(i - kPeriod, i));
    const ll = Math.min(...lows.slice(i - kPeriod, i));
    kValues.push(((closes[i - 1] - ll) / (hh - ll)) * 100);
  }
  const d = calculateSMA(kValues, dPeriod);

  return { k, d };
}

function calculateMACDLine(closes: number[]): number[] {
  const result: number[] = [];
  for (let i = 26; i <= closes.length; i++) {
    const ema12 = calculateEMA(closes.slice(0, i), 12);
    const ema26 = calculateEMA(closes.slice(0, i), 26);
    result.push(ema12 - ema26);
  }
  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
  const trueRanges: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  return calculateSMA(trueRanges.slice(-period), period);
}

function calculateStdDev(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const squaredDiffs = data.map(d => Math.pow(d - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
}

function calculateOBV(closes: number[], volumes: number[]): { obv: number; trend: 'accumulation' | 'distribution' | 'neutral' } {
  let obv = 0;
  const obvValues: number[] = [0];

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
    obvValues.push(obv);
  }

  // Determine trend by comparing recent OBV to older OBV
  const recentOBV = calculateSMA(obvValues.slice(-5), 5);
  const olderOBV = calculateSMA(obvValues.slice(-20, -10), 10);

  let trend: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
  if (recentOBV > olderOBV * 1.05) trend = 'accumulation';
  else if (recentOBV < olderOBV * 0.95) trend = 'distribution';

  return { obv, trend };
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number) {
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  const smoothedTR = calculateEMA(trueRanges, period);
  const smoothedPlusDM = calculateEMA(plusDMs, period);
  const smoothedMinusDM = calculateEMA(minusDMs, period);

  const plusDI = (smoothedPlusDM / smoothedTR) * 100;
  const minusDI = (smoothedMinusDM / smoothedTR) * 100;

  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

  // ADX is the smoothed DX
  const adx = dx; // Simplified - would normally smooth over period

  return { adx, plusDI, minusDI };
}

/**
 * Calculate optimal position sizing based on volatility
 */
export function calculatePositionSize(
  accountSize: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number
): { shares: number; riskAmount: number; positionValue: number } {
  const riskAmount = accountSize * (riskPercent / 100);
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const shares = Math.floor(riskAmount / riskPerShare);
  const positionValue = shares * entryPrice;

  return { shares, riskAmount, positionValue };
}

/**
 * Calculate optimal stop loss based on ATR
 */
export function calculateStopLoss(
  currentPrice: number,
  atr: number,
  direction: 'long' | 'short',
  multiplier: number = 2
): number {
  if (direction === 'long') {
    return currentPrice - (atr * multiplier);
  } else {
    return currentPrice + (atr * multiplier);
  }
}

/**
 * Calculate target price based on risk/reward ratio
 */
export function calculateTarget(
  entryPrice: number,
  stopLoss: number,
  rrRatio: number = 2
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  return entryPrice + (risk * rrRatio);
}

/**
 * Options Play Recommendation Interface
 */
export interface OptionsPlay {
  strategy: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  strikes: {
    type: 'call' | 'put';
    action: 'buy' | 'sell';
    strikePrice: number;
    expiration: string;
  }[];
  maxProfit: string;
  maxLoss: string;
  breakeven: number;
  probability: number;
  riskReward: string;
  reasoning: string[];
  confidence: number;
}

/**
 * Generate intelligent options play recommendations based on TA
 * This creates smart options suggestions without needing live chain data
 */
export function generateOptionsRecommendation(
  symbol: string,
  currentPrice: number,
  indicators: TechnicalIndicators,
  signalScore: SignalScore
): OptionsPlay | null {
  const { score, confidence, signals } = signalScore;

  // Only recommend if we have decent confidence
  if (confidence < 55) {
    return null;
  }

  // Round strike prices to nearest $5 for stocks > $50, $2.50 for < $50, $1 for < $20
  const roundStrike = (price: number): number => {
    if (currentPrice > 100) return Math.round(price / 5) * 5;
    if (currentPrice > 50) return Math.round(price / 2.5) * 2.5;
    if (currentPrice > 20) return Math.round(price / 2.5) * 2.5;
    return Math.round(price);
  };

  // Calculate key levels
  const atr = indicators.atr;
  const resistance = indicators.resistance1;
  const support = indicators.support1;

  // Determine expiration based on signal strength and volatility
  const getExpiration = (): string => {
    if (indicators.atrPercent > 3) {
      // High volatility - shorter expiration
      return '1-2 weeks';
    } else if (score > 60 || score < -60) {
      // Strong signal - can go shorter
      return '2-3 weeks';
    } else {
      // Give it time
      return '3-4 weeks';
    }
  };

  const expiration = getExpiration();
  const reasoning: string[] = [];

  // STRONGLY BULLISH (score > 50)
  if (score > 50 && confidence > 65) {
    const strikePrice = roundStrike(currentPrice * 1.02); // Slightly OTM call
    const targetPrice = roundStrike(resistance);

    signals.filter(s => s.signal === 'bullish').slice(0, 3).forEach(s => {
      reasoning.push(`✅ ${s.indicator}: ${s.description}`);
    });
    reasoning.push(`🎯 Target: $${targetPrice.toFixed(2)} (R1 resistance)`);
    reasoning.push(`📊 Trend strength: ${indicators.trendStrength}`);

    return {
      strategy: 'Long Call',
      direction: 'bullish',
      strikes: [{
        type: 'call',
        action: 'buy',
        strikePrice,
        expiration
      }],
      maxProfit: 'Unlimited',
      maxLoss: 'Premium paid',
      breakeven: strikePrice + (currentPrice * 0.03), // Estimate 3% premium
      probability: Math.min(70, 45 + (score / 4)),
      riskReward: '1:3+',
      reasoning,
      confidence
    };
  }

  // STRONGLY BEARISH (score < -50)
  if (score < -50 && confidence > 65) {
    const strikePrice = roundStrike(currentPrice * 0.98); // Slightly OTM put
    const targetPrice = roundStrike(support);

    signals.filter(s => s.signal === 'bearish').slice(0, 3).forEach(s => {
      reasoning.push(`🔻 ${s.indicator}: ${s.description}`);
    });
    reasoning.push(`🎯 Target: $${targetPrice.toFixed(2)} (S1 support)`);
    reasoning.push(`📊 Trend strength: ${indicators.trendStrength}`);

    return {
      strategy: 'Long Put',
      direction: 'bearish',
      strikes: [{
        type: 'put',
        action: 'buy',
        strikePrice,
        expiration
      }],
      maxProfit: `$${(strikePrice - 0).toFixed(2)} (if stock goes to $0)`,
      maxLoss: 'Premium paid',
      breakeven: strikePrice - (currentPrice * 0.03),
      probability: Math.min(70, 45 + (Math.abs(score) / 4)),
      riskReward: '1:3+',
      reasoning,
      confidence
    };
  }

  // MODERATELY BULLISH (score 25-50) - Bull Call Spread for lower risk
  if (score >= 25 && score <= 50) {
    const longStrike = roundStrike(currentPrice);
    const shortStrike = roundStrike(currentPrice * 1.05);

    signals.filter(s => s.signal === 'bullish').slice(0, 2).forEach(s => {
      reasoning.push(`✅ ${s.indicator}: ${s.description}`);
    });
    reasoning.push(`📈 Moderate bullish bias - using spread for defined risk`);
    reasoning.push(`🎯 Profit zone: $${longStrike} to $${shortStrike}`);

    return {
      strategy: 'Bull Call Spread',
      direction: 'bullish',
      strikes: [
        { type: 'call', action: 'buy', strikePrice: longStrike, expiration },
        { type: 'call', action: 'sell', strikePrice: shortStrike, expiration }
      ],
      maxProfit: `$${((shortStrike - longStrike) * 100 * 0.7).toFixed(0)} per contract`,
      maxLoss: 'Net debit paid (~30% of spread width)',
      breakeven: longStrike + ((shortStrike - longStrike) * 0.3),
      probability: Math.min(65, 50 + (score / 5)),
      riskReward: '1:2',
      reasoning,
      confidence
    };
  }

  // MODERATELY BEARISH (score -50 to -25) - Bear Put Spread
  if (score <= -25 && score >= -50) {
    const longStrike = roundStrike(currentPrice);
    const shortStrike = roundStrike(currentPrice * 0.95);

    signals.filter(s => s.signal === 'bearish').slice(0, 2).forEach(s => {
      reasoning.push(`🔻 ${s.indicator}: ${s.description}`);
    });
    reasoning.push(`📉 Moderate bearish bias - using spread for defined risk`);
    reasoning.push(`🎯 Profit zone: $${shortStrike} to $${longStrike}`);

    return {
      strategy: 'Bear Put Spread',
      direction: 'bearish',
      strikes: [
        { type: 'put', action: 'buy', strikePrice: longStrike, expiration },
        { type: 'put', action: 'sell', strikePrice: shortStrike, expiration }
      ],
      maxProfit: `$${((longStrike - shortStrike) * 100 * 0.7).toFixed(0)} per contract`,
      maxLoss: 'Net debit paid (~30% of spread width)',
      breakeven: longStrike - ((longStrike - shortStrike) * 0.3),
      probability: Math.min(65, 50 + (Math.abs(score) / 5)),
      riskReward: '1:2',
      reasoning,
      confidence
    };
  }

  // NEUTRAL with high volatility expectation - Straddle/Strangle
  if (Math.abs(score) < 25 && indicators.bollingerWidth < 0.08) {
    const atmStrike = roundStrike(currentPrice);

    reasoning.push(`⚡ Bollinger Band SQUEEZE detected - breakout imminent`);
    reasoning.push(`📊 Low volatility = cheap options premiums`);
    reasoning.push(`🎲 Direction uncertain, but big move expected`);

    return {
      strategy: 'Long Straddle',
      direction: 'neutral',
      strikes: [
        { type: 'call', action: 'buy', strikePrice: atmStrike, expiration: '2-3 weeks' },
        { type: 'put', action: 'buy', strikePrice: atmStrike, expiration: '2-3 weeks' }
      ],
      maxProfit: 'Unlimited (if big move either direction)',
      maxLoss: 'Total premium paid (both options)',
      breakeven: atmStrike, // Actually two breakevens above and below
      probability: 55,
      riskReward: '1:2+',
      reasoning,
      confidence: 60
    };
  }

  // No strong signal - no recommendation
  return null;
}
