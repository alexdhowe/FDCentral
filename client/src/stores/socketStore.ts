import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  sendMessage: (room: string, message: string, messageType?: string, metadata?: any) => void;
  subscribeToStock: (symbol: string) => void;
  unsubscribeFromStock: (symbol: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: (token: string) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    const socket = io(import.meta.env.VITE_API_URL || '', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ isConnected: false });
    });

    socket.on('alert_triggered', (data) => {
      toast.success(data.message, {
        duration: 6000,
        icon: '🔔',
      });
    });

    socket.on('recommendation_update', (data) => {
      toast(data.message, {
        duration: 6000,
        icon: data.status === 'hit_target' ? '🎯' : '⚠️',
      });
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      toast.error(error.message || 'Connection error');
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  joinRoom: (room: string) => {
    const { socket } = get();
    socket?.emit('join_room', room);
  },

  leaveRoom: (room: string) => {
    const { socket } = get();
    socket?.emit('leave_room', room);
  },

  sendMessage: (room: string, message: string, messageType = 'text', metadata?: any) => {
    const { socket } = get();
    socket?.emit('send_message', { room, message, messageType, metadata });
  },

  subscribeToStock: (symbol: string) => {
    const { socket } = get();
    socket?.emit('subscribe_stock', symbol);
  },

  unsubscribeFromStock: (symbol: string) => {
    const { socket } = get();
    socket?.emit('unsubscribe_stock', symbol);
  },
}));
