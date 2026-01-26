import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
        id: string;
        username: string;
        email: string;
      };
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.user?.username}`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.user?.id}`);

    // Join default general room
    socket.join('room:general');

    // Handle joining chat rooms
    socket.on('join_room', (room: string) => {
      socket.join(`room:${room}`);
      console.log(`${socket.user?.username} joined room: ${room}`);
    });

    // Handle leaving chat rooms
    socket.on('leave_room', (room: string) => {
      socket.leave(`room:${room}`);
      console.log(`${socket.user?.username} left room: ${room}`);
    });

    // Handle chat messages
    socket.on('send_message', async (data: {
      room: string;
      message: string;
      messageType?: string;
      metadata?: any;
    }) => {
      try {
        const { room = 'general', message, messageType = 'text', metadata } = data;

        if (!message || message.trim().length === 0) return;

        // Save to database
        const result = await query(
          `INSERT INTO chat_messages (user_id, room, message, message_type, metadata)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [socket.user!.id, room, message.trim(), messageType, metadata ? JSON.stringify(metadata) : null]
        );

        const fullMessage = {
          ...result.rows[0],
          username: socket.user!.username,
          avatar_url: null
        };

        // Broadcast to room
        io.to(`room:${room}`).emit('new_message', fullMessage);
      } catch (error) {
        console.error('Socket send_message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data: { room: string; isTyping: boolean }) => {
      socket.to(`room:${data.room}`).emit('user_typing', {
        userId: socket.user?.id,
        username: socket.user?.username,
        isTyping: data.isTyping
      });
    });

    // Subscribe to stock updates
    socket.on('subscribe_stock', (symbol: string) => {
      socket.join(`stock:${symbol.toUpperCase()}`);
    });

    socket.on('unsubscribe_stock', (symbol: string) => {
      socket.leave(`stock:${symbol.toUpperCase()}`);
    });

    // Share chart/recommendation to chat
    socket.on('share_to_chat', async (data: {
      room: string;
      type: 'chart' | 'recommendation';
      content: any;
    }) => {
      try {
        const { room, type, content } = data;

        const message = type === 'chart'
          ? `📊 Shared chart for ${content.symbol}`
          : `💡 Shared recommendation for ${content.symbol}`;

        const result = await query(
          `INSERT INTO chat_messages (user_id, room, message, message_type, metadata)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [socket.user!.id, room, message, `${type}_share`, JSON.stringify(content)]
        );

        const fullMessage = {
          ...result.rows[0],
          username: socket.user!.username
        };

        io.to(`room:${room}`).emit('new_message', fullMessage);
      } catch (error) {
        console.error('Socket share_to_chat error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.username}`);
    });
  });

  return io;
}

// Helper to emit notifications to specific users
export function emitToUser(io: Server, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

// Helper to emit stock updates
export function emitStockUpdate(io: Server, symbol: string, data: any) {
  io.to(`stock:${symbol}`).emit('stock_update', data);
}
