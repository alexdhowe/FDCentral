import { useState, useEffect, useRef } from 'react';
import { Send, Hash, Users, TrendingUp, Image } from 'lucide-react';
import { useSocketStore } from '../stores/socketStore';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { getTimeSince } from '../lib/utils';

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  message: string;
  message_type: string;
  metadata?: any;
  created_at: string;
}

interface Room {
  room: string;
  message_count: number;
  last_message_at: string;
}

export default function Chat() {
  const { socket, joinRoom, leaveRoom, sendMessage: socketSendMessage } = useSocketStore();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchRooms();
    fetchMessages();
    joinRoom(currentRoom);

    return () => {
      leaveRoom(currentRoom);
    };
  }, [currentRoom]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleTyping = (data: { userId: string; username: string; isTyping: boolean }) => {
      if (data.userId === user?.id) return;

      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.username) ? prev : [...prev, data.username];
        } else {
          return prev.filter((u) => u !== data.username);
        }
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRooms = async () => {
    try {
      const response = await api.get('/chat/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error('Failed to fetch rooms');
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await api.get('/chat/messages', {
        params: { room: currentRoom },
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socketSendMessage(currentRoom, newMessage);
    setNewMessage('');
  };

  const handleTyping = () => {
    socket?.emit('typing', { room: currentRoom, isTyping: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('typing', { room: currentRoom, isTyping: false });
    }, 2000);
  };

  const switchRoom = (room: string) => {
    leaveRoom(currentRoom);
    setCurrentRoom(room);
    setMessages([]);
  };

  const renderMessage = (msg: Message) => {
    const isOwn = msg.user_id === user?.id;

    if (msg.message_type === 'chart_share' && msg.metadata) {
      return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
          <div className={`max-w-md ${isOwn ? 'order-2' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm">
                {msg.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-400">{msg.username}</span>
              <span className="text-xs text-gray-500">{getTimeSince(msg.created_at)}</span>
            </div>
            <div className={`rounded-lg p-4 ${isOwn ? 'bg-primary-600' : 'bg-gray-700'}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">{msg.metadata.symbol} Chart</span>
              </div>
              <p className="text-sm text-gray-300">{msg.message}</p>
            </div>
          </div>
        </div>
      );
    }

    if (msg.message_type === 'recommendation_share' && msg.metadata) {
      return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
          <div className={`max-w-md ${isOwn ? 'order-2' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm">
                {msg.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-400">{msg.username}</span>
              <span className="text-xs text-gray-500">{getTimeSince(msg.created_at)}</span>
            </div>
            <div className={`rounded-lg p-4 ${isOwn ? 'bg-primary-600' : 'bg-gray-700'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">💡</span>
                <span className="font-medium">{msg.metadata.symbol} Recommendation</span>
              </div>
              <p className="text-sm text-gray-300">{msg.message}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-md ${isOwn ? 'order-2' : ''}`}>
          {!isOwn && (
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm">
                {msg.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-400">{msg.username}</span>
              <span className="text-xs text-gray-500">{getTimeSince(msg.created_at)}</span>
            </div>
          )}
          <div
            className={`rounded-lg px-4 py-2 ${
              isOwn ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-100'
            }`}
          >
            {msg.message}
          </div>
          {isOwn && (
            <p className="text-xs text-gray-500 text-right mt-1">{getTimeSince(msg.created_at)}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 hidden md:flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-bold">Channels</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room.room}
              onClick={() => switchRoom(room.room)}
              className={`w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-700/50 transition-colors ${
                currentRoom === room.room ? 'bg-gray-700/50 text-primary-400' : 'text-gray-300'
              }`}
            >
              <Hash className="w-4 h-4" />
              <span>{room.room}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-gray-400" />
            <span className="font-bold">{currentRoom}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span className="text-sm">Trading Hub</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : messages.length > 0 ? (
            <>
              {messages.map((msg) => (
                <div key={msg.id}>{renderMessage(msg)}</div>
              ))}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Hash className="w-16 h-16 mb-4 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Be the first to say something!</p>
            </div>
          )}
        </div>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 text-sm text-gray-400">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder={`Message #${currentRoom}`}
              className="input flex-1"
            />
            <button type="submit" className="btn-primary px-4">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
