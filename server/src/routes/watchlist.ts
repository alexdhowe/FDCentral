import { Router, Response } from 'express';
import { query } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all watchlists for user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT w.*, u.username as creator_name,
        (SELECT COUNT(*) FROM watchlist_items WHERE watchlist_id = w.id) as item_count
       FROM watchlists w
       LEFT JOIN users u ON w.created_by = u.id
       WHERE w.created_by = $1
         OR w.id IN (SELECT watchlist_id FROM watchlist_members WHERE user_id = $1)
       ORDER BY w.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get watchlists error:', error);
    res.status(500).json({ error: 'Failed to get watchlists' });
  }
});

// Create watchlist
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isShared } = req.body;

    const result = await query(
      `INSERT INTO watchlists (name, description, is_shared, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || '', isShared || false, req.user!.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create watchlist error:', error);
    res.status(500).json({ error: 'Failed to create watchlist' });
  }
});

// Get watchlist items
router.get('/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check access
    const access = await query(
      `SELECT 1 FROM watchlists WHERE id = $1 AND (created_by = $2 OR is_shared = true)
       UNION
       SELECT 1 FROM watchlist_members WHERE watchlist_id = $1 AND user_id = $2`,
      [id, req.user!.id]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `SELECT wi.*, u.username as added_by_name
       FROM watchlist_items wi
       LEFT JOIN users u ON wi.added_by = u.id
       WHERE wi.watchlist_id = $1
       ORDER BY wi.added_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get watchlist items error:', error);
    res.status(500).json({ error: 'Failed to get watchlist items' });
  }
});

// Add item to watchlist
router.post('/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { symbol, itemType, optionDetails, notes } = req.body;

    // Check access
    const access = await query(
      `SELECT 1 FROM watchlists WHERE id = $1 AND created_by = $2
       UNION
       SELECT 1 FROM watchlist_members WHERE watchlist_id = $1 AND user_id = $2 AND can_edit = true`,
      [id, req.user!.id]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `INSERT INTO watchlist_items (watchlist_id, symbol, item_type, option_details, notes, added_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (watchlist_id, symbol, item_type, option_details) DO UPDATE SET notes = $5
       RETURNING *`,
      [id, symbol.toUpperCase(), itemType || 'stock', optionDetails || null, notes || '', req.user!.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add watchlist item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Remove item from watchlist
router.delete('/:id/items/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const { id, itemId } = req.params;

    // Check access
    const access = await query(
      `SELECT 1 FROM watchlists WHERE id = $1 AND created_by = $2
       UNION
       SELECT 1 FROM watchlist_members WHERE watchlist_id = $1 AND user_id = $2 AND can_edit = true`,
      [id, req.user!.id]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query('DELETE FROM watchlist_items WHERE id = $1 AND watchlist_id = $2', [itemId, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove watchlist item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Share watchlist with user
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, canEdit } = req.body;

    // Check ownership
    const ownership = await query(
      'SELECT 1 FROM watchlists WHERE id = $1 AND created_by = $2',
      [id, req.user!.id]
    );

    if (ownership.rows.length === 0) {
      return res.status(403).json({ error: 'Only owner can share' });
    }

    // Update watchlist to shared
    await query('UPDATE watchlists SET is_shared = true WHERE id = $1', [id]);

    // Add member
    const result = await query(
      `INSERT INTO watchlist_members (watchlist_id, user_id, can_edit)
       VALUES ($1, $2, $3)
       ON CONFLICT (watchlist_id, user_id) DO UPDATE SET can_edit = $3
       RETURNING *`,
      [id, userId, canEdit || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Share watchlist error:', error);
    res.status(500).json({ error: 'Failed to share watchlist' });
  }
});

// Delete watchlist
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM watchlists WHERE id = $1 AND created_by = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete watchlist error:', error);
    res.status(500).json({ error: 'Failed to delete watchlist' });
  }
});

export { router as watchlistRouter };
