/**
 * Signals API Routes
 * Provides access to bot-generated signals, analysis, and notifications
 */

import { Router, Response } from 'express';
import { query } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  getBotStatus,
  getRecentSignals,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  scanSymbolManually,
} from '../services/signalBot.js';
import { addTrackedSymbol } from '../services/marketScanner.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /signals - Get recent signals
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbol, type, direction, limit = '20' } = req.query;

    let queryStr = `
      SELECT * FROM signals
      WHERE is_active = true
      ${symbol ? 'AND symbol = $1' : ''}
      ${type ? `AND signal_type = $${symbol ? 2 : 1}` : ''}
      ${direction ? `AND direction = $${symbol && type ? 3 : symbol || type ? 2 : 1}` : ''}
      ORDER BY created_at DESC
      LIMIT $${[symbol, type, direction].filter(Boolean).length + 1}
    `;

    const params: any[] = [];
    if (symbol) params.push((symbol as string).toUpperCase());
    if (type) params.push(type);
    if (direction) params.push(direction);
    params.push(parseInt(limit as string) || 20);

    const result = await query(queryStr, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

/**
 * GET /signals/feed - Get personalized signal feed based on user's watchlists
 */
router.get('/feed', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { limit = '30' } = req.query;

    // Get signals for symbols in user's watchlists
    const result = await query(
      `SELECT DISTINCT s.*
       FROM signals s
       WHERE s.is_active = true
       AND (
         s.symbol IN (
           SELECT DISTINCT wi.symbol
           FROM watchlist_items wi
           JOIN watchlists w ON w.id = wi.watchlist_id
           LEFT JOIN watchlist_members wm ON wm.watchlist_id = w.id
           WHERE w.created_by = $1 OR wm.user_id = $1
         )
         OR s.strength >= 8  -- Include all high-strength signals
       )
       ORDER BY s.created_at DESC
       LIMIT $2`,
      [userId, parseInt(limit as string) || 30]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching signal feed:', error);
    res.status(500).json({ error: 'Failed to fetch signal feed' });
  }
});

/**
 * GET /signals/symbol/:symbol - Get signals for a specific symbol
 */
router.get('/symbol/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { limit = '10' } = req.query;

    const result = await query(
      `SELECT * FROM signals
       WHERE symbol = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [symbol.toUpperCase(), parseInt(limit as string) || 10]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching symbol signals:', error);
    res.status(500).json({ error: 'Failed to fetch symbol signals' });
  }
});

/**
 * POST /signals/scan/:symbol - Manually trigger a scan for a symbol
 */
router.post('/scan/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const result = await scanSymbolManually(symbol.toUpperCase());

    if (!result) {
      return res.status(404).json({ error: 'Could not scan symbol' });
    }

    res.json({
      symbol: result.symbol,
      price: result.price,
      change: result.change,
      changePercent: result.changePercent,
      signalCount: result.signals.length,
      signals: result.signals,
      score: result.score,
      analysis: result.analysis,
    });
  } catch (error) {
    console.error('Error scanning symbol:', error);
    res.status(500).json({ error: 'Failed to scan symbol' });
  }
});

/**
 * GET /signals/analysis/:symbol - Get recent analysis for a symbol
 */
router.get('/analysis/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { limit = '5' } = req.query;

    const result = await query(
      `SELECT * FROM market_analysis
       WHERE symbol = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [symbol.toUpperCase(), parseInt(limit as string) || 5]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

/**
 * GET /signals/stats - Get signal statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT
        COUNT(*) as total_signals,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as signals_today,
        COUNT(CASE WHEN direction = 'bullish' THEN 1 END) as bullish_signals,
        COUNT(CASE WHEN direction = 'bearish' THEN 1 END) as bearish_signals,
        COUNT(CASE WHEN outcome = 'hit_target' THEN 1 END) as successful_signals,
        COUNT(CASE WHEN outcome IS NOT NULL THEN 1 END) as resolved_signals,
        AVG(strength) as avg_strength,
        AVG(confidence) as avg_confidence
      FROM signals
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const topSymbols = await query(`
      SELECT symbol, COUNT(*) as signal_count,
             AVG(strength) as avg_strength
      FROM signals
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY symbol
      ORDER BY signal_count DESC
      LIMIT 10
    `);

    res.json({
      ...stats.rows[0],
      topSymbols: topSymbols.rows,
      botStatus: getBotStatus(),
    });
  } catch (error) {
    console.error('Error fetching signal stats:', error);
    res.status(500).json({ error: 'Failed to fetch signal stats' });
  }
});

/**
 * GET /signals/notifications - Get user notifications
 */
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { unread } = req.query;

    const notifications = await getUserNotifications(userId, unread === 'true');

    // Get unread count
    const unreadCount = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      notifications,
      unreadCount: parseInt(unreadCount.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /signals/notifications/:id/read - Mark notification as read
 */
router.post('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await markNotificationRead(id, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

/**
 * POST /signals/notifications/read-all - Mark all notifications as read
 */
router.post('/notifications/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await markAllNotificationsRead(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications read' });
  }
});

/**
 * GET /signals/tracked - Get tracked symbols
 */
router.get('/tracked', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM tracked_symbols
       WHERE is_active = true
       ORDER BY priority DESC, symbol ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tracked symbols:', error);
    res.status(500).json({ error: 'Failed to fetch tracked symbols' });
  }
});

/**
 * POST /signals/tracked - Add a symbol to tracking
 */
router.post('/tracked', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { symbol, name } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    await addTrackedSymbol(symbol.toUpperCase(), name, userId);

    res.json({ success: true, symbol: symbol.toUpperCase() });
  } catch (error) {
    console.error('Error adding tracked symbol:', error);
    res.status(500).json({ error: 'Failed to add tracked symbol' });
  }
});

/**
 * DELETE /signals/tracked/:symbol - Remove a symbol from tracking
 */
router.delete('/tracked/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    await query(
      `UPDATE tracked_symbols SET is_active = false WHERE symbol = $1`,
      [symbol.toUpperCase()]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing tracked symbol:', error);
    res.status(500).json({ error: 'Failed to remove tracked symbol' });
  }
});

/**
 * GET /signals/bot-status - Get bot status
 */
router.get('/bot-status', async (req: Request, res: Response) => {
  try {
    const status = getBotStatus();

    // Get recent bot activity
    const recentActivity = await query(
      `SELECT * FROM bot_activity_log
       ORDER BY created_at DESC
       LIMIT 20`
    );

    res.json({
      ...status,
      recentActivity: recentActivity.rows,
    });
  } catch (error) {
    console.error('Error fetching bot status:', error);
    res.status(500).json({ error: 'Failed to fetch bot status' });
  }
});

/**
 * GET /signals/predictions - Get predictions
 */
router.get('/predictions', async (req: Request, res: Response) => {
  try {
    const { symbol, resolved } = req.query;

    let queryStr = `
      SELECT * FROM predictions
      WHERE 1=1
      ${symbol ? 'AND symbol = $1' : ''}
      ${resolved === 'true' ? `AND is_resolved = true` : resolved === 'false' ? `AND is_resolved = false` : ''}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const params = symbol ? [symbol] : [];
    const result = await query(queryStr, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

export default router;
