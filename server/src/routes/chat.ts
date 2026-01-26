import { Router, Response } from 'express';
import { query } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get chat messages
router.get('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { room = 'general', limit = 100, before } = req.query;

    let whereClause = 'WHERE room = $1';
    const params: any[] = [room];

    if (before) {
      whereClause += ` AND created_at < $2`;
      params.push(before);
    }

    params.push(Number(limit));

    const result = await query(
      `SELECT cm.*, u.username, u.avatar_url
       FROM chat_messages cm
       LEFT JOIN users u ON cm.user_id = u.id
       ${whereClause}
       ORDER BY cm.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    // Return in chronological order
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send message (also handled via socket, but REST fallback)
router.post('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { room = 'general', message, messageType = 'text', metadata } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const result = await query(
      `INSERT INTO chat_messages (user_id, room, message, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user!.id, room, message.trim(), messageType, metadata ? JSON.stringify(metadata) : null]
    );

    // Get user info
    const userResult = await query(
      'SELECT username, avatar_url FROM users WHERE id = $1',
      [req.user!.id]
    );

    const fullMessage = {
      ...result.rows[0],
      username: userResult.rows[0]?.username,
      avatar_url: userResult.rows[0]?.avatar_url
    };

    res.status(201).json(fullMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get available rooms
router.get('/rooms', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT room, COUNT(*) as message_count,
        MAX(created_at) as last_message_at
       FROM chat_messages
       GROUP BY room
       ORDER BY last_message_at DESC`
    );

    // Always include general room
    const rooms = result.rows;
    if (!rooms.find(r => r.room === 'general')) {
      rooms.unshift({ room: 'general', message_count: 0, last_message_at: null });
    }

    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Delete message (own messages only)
router.delete('/messages/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM chat_messages WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export { router as chatRouter };
