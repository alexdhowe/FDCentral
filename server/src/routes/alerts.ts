import { Router, Response } from 'express';
import { query } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all alerts for user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Create alert
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol, alertType, triggerValue } = req.body;

    if (!symbol || !alertType || triggerValue === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['price_above', 'price_below', 'percent_change_up', 'percent_change_down', 'volume_spike'];
    if (!validTypes.includes(alertType)) {
      return res.status(400).json({ error: 'Invalid alert type' });
    }

    const result = await query(
      `INSERT INTO alerts (user_id, symbol, alert_type, trigger_value)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.id, symbol.toUpperCase(), alertType, triggerValue]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Update alert
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, triggerValue } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (triggerValue !== undefined) {
      updates.push(`trigger_value = $${paramIndex++}`);
      values.push(triggerValue);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id, req.user!.id);

    const result = await query(
      `UPDATE alerts SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete alert
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get triggered alerts (recent)
router.get('/triggered', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM alerts
       WHERE user_id = $1 AND is_triggered = true
       ORDER BY triggered_at DESC
       LIMIT 50`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get triggered alerts error:', error);
    res.status(500).json({ error: 'Failed to get triggered alerts' });
  }
});

// Reset triggered alert (to re-enable)
router.post('/:id/reset', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE alerts
       SET is_triggered = false, is_active = true, triggered_at = NULL
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Reset alert error:', error);
    res.status(500).json({ error: 'Failed to reset alert' });
  }
});

export { router as alertsRouter };
