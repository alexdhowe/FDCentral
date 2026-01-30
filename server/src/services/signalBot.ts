/**
 * Signal Bot - Autonomous Trading Research Assistant
 *
 * This bot continuously monitors the market, analyzes data, and generates
 * actionable insights without executing trades. It acts as a tireless
 * research assistant providing evidence for decision making.
 */

import cron from 'node-cron';
import { query } from '../db/index.js';
import {
  scanSymbol,
  saveSignal,
  saveAnalysis,
  getTrackedSymbols,
  updateLastScanned,
  MarketSignal,
  ScanResult,
} from './marketScanner.js';
import { getQuote } from './stockData.js';
import { runNewsAnalysis, getHighImpactNews } from './newsAnalyzer.js';
import { runSignalGeneration, generateSignal, generatePrediction } from './signalGenerator.js';

// Bot configuration
const BOT_CONFIG = {
  // Scan intervals (cron expressions)
  MARKET_SCAN_INTERVAL: '*/5 * * * *', // Every 5 minutes during market hours
  NEWS_CHECK_INTERVAL: '*/15 * * * *', // Every 15 minutes
  ALERT_CHECK_INTERVAL: '*/2 * * * *', // Every 2 minutes
  PREDICTION_REVIEW_INTERVAL: '0 */4 * * *', // Every 4 hours

  // Thresholds
  MIN_SIGNAL_STRENGTH: 6, // Only save signals with strength >= 6
  MIN_SIGNAL_CONFIDENCE: 55, // Only save signals with confidence >= 55%
  MAX_SIGNALS_PER_SYMBOL_PER_DAY: 5, // Prevent signal spam

  // Rate limiting
  SYMBOLS_PER_SCAN_BATCH: 10, // Process this many symbols per scan cycle
  DELAY_BETWEEN_SYMBOLS_MS: 2000, // 2 seconds between API calls

  // Market hours (EST)
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 30,
  MARKET_CLOSE_HOUR: 16,
  MARKET_CLOSE_MINUTE: 0,
};

// Default symbols to track if none configured
const DEFAULT_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'SPY', 'QQQ', 'IWM', 'DIA',
  'AMD', 'INTC', 'CRM', 'NFLX', 'DIS',
];

interface BotState {
  isRunning: boolean;
  lastScanTime: Date | null;
  signalsGeneratedToday: number;
  errorsToday: number;
  symbolsScannedToday: number;
}

const botState: BotState = {
  isRunning: false,
  lastScanTime: null,
  signalsGeneratedToday: 0,
  errorsToday: 0,
  symbolsScannedToday: 0,
};

/**
 * Initialize the Signal Bot
 */
export function initializeSignalBot(): void {
  console.log('🤖 ================================');
  console.log('🤖  SIGNAL BOT INITIALIZING');
  console.log('🤖 ================================');

  // Schedule market scanning
  cron.schedule(BOT_CONFIG.MARKET_SCAN_INTERVAL, async () => {
    if (isMarketHours()) {
      await runMarketScan();
    }
  });

  // Schedule news checking
  cron.schedule(BOT_CONFIG.NEWS_CHECK_INTERVAL, async () => {
    await checkMarketNews();
  });

  // Schedule alert checking
  cron.schedule(BOT_CONFIG.ALERT_CHECK_INTERVAL, async () => {
    await checkPriceAlerts();
  });

  // Schedule prediction review
  cron.schedule(BOT_CONFIG.PREDICTION_REVIEW_INTERVAL, async () => {
    await reviewPredictions();
  });

  // Schedule composite signal generation (combines TA, news, momentum)
  cron.schedule('0 */2 * * *', async () => { // Every 2 hours
    if (isMarketHours()) {
      console.log('🤖 Running composite signal generation...');
      await runSignalGeneration();
    }
  });

  // Reset daily stats at midnight
  cron.schedule('0 0 * * *', () => {
    botState.signalsGeneratedToday = 0;
    botState.errorsToday = 0;
    botState.symbolsScannedToday = 0;
    console.log('🤖 Daily stats reset');
  });

  // Initial scan on startup (with delay to let services initialize)
  setTimeout(async () => {
    console.log('🤖 Running initial market scan...');
    await initializeTrackedSymbols();
    await runMarketScan();
  }, 10000);

  botState.isRunning = true;
  console.log('🤖 Signal Bot is now running');
  console.log(`🤖 Market scan: ${BOT_CONFIG.MARKET_SCAN_INTERVAL}`);
  console.log(`🤖 News check: ${BOT_CONFIG.NEWS_CHECK_INTERVAL}`);
  console.log(`🤖 Alert check: ${BOT_CONFIG.ALERT_CHECK_INTERVAL}`);
}

/**
 * Check if current time is during market hours (EST)
 */
function isMarketHours(): boolean {
  const now = new Date();
  const estOffset = -5; // EST is UTC-5
  const utcHour = now.getUTCHours();
  const estHour = (utcHour + 24 + estOffset) % 24;
  const minute = now.getMinutes();
  const day = now.getDay();

  // Skip weekends
  if (day === 0 || day === 6) return false;

  // Check market hours
  const marketOpenMinutes = BOT_CONFIG.MARKET_OPEN_HOUR * 60 + BOT_CONFIG.MARKET_OPEN_MINUTE;
  const marketCloseMinutes = BOT_CONFIG.MARKET_CLOSE_HOUR * 60 + BOT_CONFIG.MARKET_CLOSE_MINUTE;
  const currentMinutes = estHour * 60 + minute;

  return currentMinutes >= marketOpenMinutes && currentMinutes < marketCloseMinutes;
}

/**
 * Initialize tracked symbols if empty
 */
async function initializeTrackedSymbols(): Promise<void> {
  try {
    const existing = await getTrackedSymbols();
    if (existing.length === 0) {
      console.log('🤖 No tracked symbols found, adding defaults...');
      for (const symbol of DEFAULT_SYMBOLS) {
        await query(
          `INSERT INTO tracked_symbols (symbol, name, priority)
           VALUES ($1, $1, 7)
           ON CONFLICT (symbol) DO NOTHING`,
          [symbol]
        );
      }
      console.log(`🤖 Added ${DEFAULT_SYMBOLS.length} default symbols`);
    }
  } catch (error) {
    console.error('🤖 Error initializing tracked symbols:', error);
  }
}

/**
 * Run a market scan cycle
 */
async function runMarketScan(): Promise<void> {
  const startTime = Date.now();
  await logBotActivity('scan', null, { type: 'market_scan_start' }, 'success');

  try {
    const symbols = await getTrackedSymbols();
    if (symbols.length === 0) {
      console.log('🤖 No symbols to scan');
      return;
    }

    // Process symbols in batches
    const batch = symbols.slice(0, BOT_CONFIG.SYMBOLS_PER_SCAN_BATCH);
    console.log(`🤖 Scanning ${batch.length} symbols...`);

    for (const symbol of batch) {
      try {
        const result = await scanSymbol(symbol);
        if (result) {
          await processSignals(result);
          botState.symbolsScannedToday++;
        }
        await updateLastScanned(symbol);

        // Rate limiting delay
        await sleep(BOT_CONFIG.DELAY_BETWEEN_SYMBOLS_MS);
      } catch (error: any) {
        console.error(`🤖 Error scanning ${symbol}:`, error.message);
        botState.errorsToday++;
        await logBotActivity('scan', symbol, { error: error.message }, 'error', error.message);
      }
    }

    botState.lastScanTime = new Date();
    const duration = Date.now() - startTime;
    console.log(`🤖 Scan complete in ${duration}ms. Signals today: ${botState.signalsGeneratedToday}`);

    await logBotActivity('scan', null, {
      symbolsScanned: batch.length,
      duration,
      signalsGenerated: botState.signalsGeneratedToday,
    }, 'success', null, duration);

  } catch (error: any) {
    console.error('🤖 Market scan error:', error);
    botState.errorsToday++;
    await logBotActivity('scan', null, { error: error.message }, 'error', error.message);
  }
}

/**
 * Process and save signals from a scan result
 */
async function processSignals(result: ScanResult): Promise<void> {
  const { symbol, signals, score, analysis } = result;

  // Filter signals by quality
  const qualitySignals = signals.filter(
    s => s.strength >= BOT_CONFIG.MIN_SIGNAL_STRENGTH &&
         s.confidence >= BOT_CONFIG.MIN_SIGNAL_CONFIDENCE
  );

  // Check daily limit per symbol
  const todaySignals = await getSignalCountToday(symbol);
  const remainingSlots = BOT_CONFIG.MAX_SIGNALS_PER_SYMBOL_PER_DAY - todaySignals;

  if (remainingSlots <= 0) {
    return; // Skip if already at daily limit
  }

  // Save top signals
  const signalsToSave = qualitySignals.slice(0, remainingSlots);

  for (const signal of signalsToSave) {
    // Check for duplicate signals (same type, direction in last 24h)
    const isDuplicate = await checkDuplicateSignal(signal);
    if (isDuplicate) continue;

    await saveSignal(signal);
    botState.signalsGeneratedToday++;

    // Create notifications for users watching this symbol
    await createSignalNotifications(signal);

    console.log(`🤖 Signal: ${signal.symbol} | ${signal.direction.toUpperCase()} ${signal.signalType} | Strength: ${signal.strength}`);
  }

  // Save analysis snapshot periodically (not every scan to save space)
  if (Math.random() < 0.2) { // 20% chance to save full analysis
    await saveAnalysis(symbol, 'technical', {
      score: score,
      signals: signals.map(s => ({ type: s.signalType, direction: s.direction, strength: s.strength })),
    }, score.score, analysis);
  }
}

/**
 * Check for duplicate signals
 */
async function checkDuplicateSignal(signal: MarketSignal): Promise<boolean> {
  const result = await query(
    `SELECT id FROM signals
     WHERE symbol = $1
       AND signal_type = $2
       AND direction = $3
       AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [signal.symbol, signal.signalType, signal.direction]
  );
  return result.rows.length > 0;
}

/**
 * Get signal count for today
 */
async function getSignalCountToday(symbol: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) as count FROM signals
     WHERE symbol = $1 AND created_at > CURRENT_DATE`,
    [symbol]
  );
  return parseInt(result.rows[0].count);
}

/**
 * Create notifications for users watching a symbol
 */
async function createSignalNotifications(signal: MarketSignal): Promise<void> {
  try {
    // Find users who have this symbol in their watchlists
    const users = await query(
      `SELECT DISTINCT u.id, u.username
       FROM users u
       JOIN watchlist_members wm ON wm.user_id = u.id OR u.id = (SELECT created_by FROM watchlists WHERE id = wm.watchlist_id)
       JOIN watchlist_items wi ON wi.watchlist_id = wm.watchlist_id
       WHERE wi.symbol = $1`,
      [signal.symbol]
    );

    // Create notification for each user
    for (const user of users.rows) {
      const icon = signal.direction === 'bullish' ? '🟢' : signal.direction === 'bearish' ? '🔴' : '🟡';
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data, priority)
         VALUES ($1, 'signal', $2, $3, $4, $5)`,
        [
          user.id,
          `${icon} ${signal.symbol}: ${signal.title}`,
          signal.description,
          JSON.stringify({
            symbol: signal.symbol,
            signalType: signal.signalType,
            direction: signal.direction,
            strength: signal.strength,
            priceAtSignal: signal.priceAtSignal,
            targetPrice: signal.targetPrice,
          }),
          signal.strength >= 8 ? 'high' : 'normal',
        ]
      );
    }
  } catch (error) {
    console.error('🤖 Error creating notifications:', error);
  }
}

/**
 * Check and trigger price alerts
 */
async function checkPriceAlerts(): Promise<void> {
  try {
    // Get all active alerts
    const alerts = await query(
      `SELECT a.*, u.username
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE a.is_active = true AND a.is_triggered = false`
    );

    if (alerts.rows.length === 0) return;

    // Group alerts by symbol to minimize API calls
    const alertsBySymbol = new Map<string, any[]>();
    for (const alert of alerts.rows) {
      if (!alertsBySymbol.has(alert.symbol)) {
        alertsBySymbol.set(alert.symbol, []);
      }
      alertsBySymbol.get(alert.symbol)!.push(alert);
    }

    // Check each symbol
    for (const [symbol, symbolAlerts] of alertsBySymbol) {
      try {
        const quote = await getQuote(symbol);
        if (!quote) continue;

        for (const alert of symbolAlerts) {
          let triggered = false;

          switch (alert.alert_type) {
            case 'price_above':
              triggered = quote.price >= parseFloat(alert.trigger_value);
              break;
            case 'price_below':
              triggered = quote.price <= parseFloat(alert.trigger_value);
              break;
            case 'percent_change':
              triggered = Math.abs(quote.changePercent) >= parseFloat(alert.trigger_value);
              break;
          }

          if (triggered) {
            // Mark alert as triggered
            await query(
              `UPDATE alerts SET is_triggered = true, triggered_at = NOW() WHERE id = $1`,
              [alert.id]
            );

            // Create notification
            await query(
              `INSERT INTO notifications (user_id, type, title, message, data, priority)
               VALUES ($1, 'alert', $2, $3, $4, 'urgent')`,
              [
                alert.user_id,
                `🔔 Alert Triggered: ${symbol}`,
                `${symbol} ${alert.alert_type.replace('_', ' ')} $${alert.trigger_value}. Current: $${quote.price.toFixed(2)}`,
                JSON.stringify({ symbol, alertType: alert.alert_type, triggerValue: alert.trigger_value, currentPrice: quote.price }),
              ]
            );

            console.log(`🤖 Alert triggered: ${symbol} ${alert.alert_type} ${alert.trigger_value}`);
          }
        }

        await sleep(1000); // Rate limit
      } catch (error) {
        console.error(`🤖 Error checking alerts for ${symbol}:`, error);
      }
    }
  } catch (error) {
    console.error('🤖 Error in alert check:', error);
  }
}

/**
 * Check for market news and analyze sentiment
 */
async function checkMarketNews(): Promise<void> {
  const startTime = Date.now();
  try {
    console.log('🤖 Checking market news...');
    await runNewsAnalysis();

    // Get high impact news and create notifications
    const highImpactNews = await getHighImpactNews(5);
    for (const news of highImpactNews) {
      // Only create notifications for very recent news (last 30 minutes)
      const newsAge = Date.now() - new Date(news.published_at).getTime();
      if (newsAge < 30 * 60 * 1000 && news.impact_level === 'high') {
        await createNewsNotifications(news);
      }
    }

    const duration = Date.now() - startTime;
    await logBotActivity('news_fetch', null, { newsAnalyzed: highImpactNews.length, duration }, 'success', null, duration);
    console.log(`🤖 News check complete in ${duration}ms`);
  } catch (error: any) {
    console.error('🤖 Error in news check:', error);
    await logBotActivity('news_fetch', null, { error: error.message }, 'error', error.message);
  }
}

/**
 * Create notifications for high impact news
 */
async function createNewsNotifications(news: any): Promise<void> {
  try {
    if (!news.symbol) return;

    // Find users who have this symbol in their watchlists
    const users = await query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN watchlist_members wm ON wm.user_id = u.id
       JOIN watchlist_items wi ON wi.watchlist_id = wm.watchlist_id
       WHERE wi.symbol = $1
       UNION
       SELECT DISTINCT w.created_by
       FROM watchlists w
       JOIN watchlist_items wi ON wi.watchlist_id = w.id
       WHERE wi.symbol = $1`,
      [news.symbol]
    );

    const icon = news.sentiment === 'positive' ? '📈' : news.sentiment === 'negative' ? '📉' : '📰';

    for (const user of users.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data, priority)
         VALUES ($1, 'news', $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          user.id,
          `${icon} ${news.symbol}: ${news.headline.slice(0, 60)}...`,
          news.summary?.slice(0, 200) || news.headline,
          JSON.stringify({
            symbol: news.symbol,
            headline: news.headline,
            sentiment: news.sentiment,
            source: news.source,
            url: news.url,
          }),
          news.impact_level === 'high' ? 'high' : 'normal',
        ]
      );
    }
  } catch (error) {
    console.error('🤖 Error creating news notifications:', error);
  }
}

/**
 * Review past predictions and update accuracy
 */
async function reviewPredictions(): Promise<void> {
  try {
    // Get unresolved predictions that have passed their target date
    const predictions = await query(
      `SELECT * FROM predictions
       WHERE is_resolved = false
       AND target_date < NOW()`
    );

    for (const prediction of predictions.rows) {
      try {
        const quote = await getQuote(prediction.symbol);
        if (!quote) continue;

        // Calculate accuracy based on prediction type
        let accuracy = 0;
        const predData = prediction.prediction;

        if (prediction.prediction_type === 'direction') {
          // Check if direction prediction was correct
          const actualDirection = quote.price > prediction.price_at_prediction ? 'up' : 'down';
          accuracy = actualDirection === predData.direction ? 100 : 0;
        } else if (prediction.prediction_type === 'price_target') {
          // Calculate how close the price got to target
          const targetPrice = predData.target;
          const maxError = Math.abs(targetPrice - prediction.price_at_prediction);
          const actualError = Math.abs(quote.price - targetPrice);
          accuracy = Math.max(0, (1 - actualError / maxError) * 100);
        }

        // Update prediction with outcome
        await query(
          `UPDATE predictions SET
           is_resolved = true,
           resolved_at = NOW(),
           outcome = $1,
           accuracy_score = $2
           WHERE id = $3`,
          [
            JSON.stringify({ finalPrice: quote.price, resolvedAt: new Date().toISOString() }),
            accuracy,
            prediction.id,
          ]
        );

        console.log(`🤖 Prediction resolved: ${prediction.symbol} | Accuracy: ${accuracy.toFixed(1)}%`);
      } catch (error) {
        console.error(`🤖 Error resolving prediction ${prediction.id}:`, error);
      }
    }
  } catch (error) {
    console.error('🤖 Error reviewing predictions:', error);
  }
}

/**
 * Log bot activity
 */
async function logBotActivity(
  activityType: string,
  symbol: string | null,
  details: any,
  status: 'success' | 'error' | 'skipped',
  errorMessage?: string | null,
  durationMs?: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO bot_activity_log (activity_type, symbol, details, status, error_message, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [activityType, symbol, JSON.stringify(details), status, errorMessage || null, durationMs || null]
    );
  } catch (error) {
    console.error('🤖 Error logging bot activity:', error);
  }
}

/**
 * Get bot status
 */
export function getBotStatus(): BotState & { isMarketHours: boolean } {
  return {
    ...botState,
    isMarketHours: isMarketHours(),
  };
}

/**
 * Utility sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Manually trigger a scan for a specific symbol
 */
export async function scanSymbolManually(symbol: string): Promise<ScanResult | null> {
  console.log(`🤖 Manual scan requested for ${symbol}`);
  const result = await scanSymbol(symbol);
  if (result) {
    await processSignals(result);
  }
  return result;
}

/**
 * Get recent signals for a symbol or all symbols
 */
export async function getRecentSignals(symbol?: string, limit: number = 20): Promise<any[]> {
  let queryStr = `
    SELECT * FROM signals
    WHERE is_active = true
    ${symbol ? 'AND symbol = $1' : ''}
    ORDER BY created_at DESC
    LIMIT ${symbol ? '$2' : '$1'}
  `;

  const params = symbol ? [symbol, limit] : [limit];
  const result = await query(queryStr, params);
  return result.rows;
}

/**
 * Get user notifications
 */
export async function getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<any[]> {
  const result = await query(
    `SELECT * FROM notifications
     WHERE user_id = $1 ${unreadOnly ? 'AND is_read = false' : ''}
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows;
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
}
