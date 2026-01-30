import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  Zap,
  Bell,
  Newspaper,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  Eye,
  Plus,
  X,
  ChevronRight,
  Bot,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Signal {
  id: string;
  symbol: string;
  signal_type: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  title: string;
  description: string;
  indicators: any;
  price_at_signal: number;
  target_price?: number;
  stop_price?: number;
  timeframe?: string;
  confidence: number;
  is_active: boolean;
  created_at: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  priority: string;
  is_read: boolean;
  created_at: string;
}

interface BotStatus {
  isRunning: boolean;
  lastScanTime: string | null;
  signalsGeneratedToday: number;
  errorsToday: number;
  symbolsScannedToday: number;
  isMarketHours: boolean;
}

interface TrackedSymbol {
  id: string;
  symbol: string;
  name: string;
  priority: number;
  is_active: boolean;
  last_scanned_at: string | null;
}

export default function Signals() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'signals' | 'notifications' | 'tracked'>('signals');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbol[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterStrength, setFilterStrength] = useState<number>(0);
  const [newSymbol, setNewSymbol] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };

      const [signalsRes, notificationsRes, trackedRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/signals?limit=50`, { headers }),
        fetch(`${API_URL}/signals/notifications`, { headers }),
        fetch(`${API_URL}/signals/tracked`, { headers }),
        fetch(`${API_URL}/signals/bot-status`, { headers }),
      ]);

      if (signalsRes.ok) {
        const data = await signalsRes.json();
        setSignals(data);
      }
      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(data);
      }
      if (trackedRes.ok) {
        const data = await trackedRes.json();
        setTrackedSymbols(data);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setBotStatus(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [token]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/signals/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const addTrackedSymbol = async () => {
    if (!newSymbol.trim()) return;
    setAddingSymbol(true);
    try {
      const res = await fetch(`${API_URL}/signals/tracked`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: newSymbol.toUpperCase() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTrackedSymbols(prev => [...prev, data]);
        setNewSymbol('');
      }
    } catch (err) {
      console.error('Failed to add symbol:', err);
    } finally {
      setAddingSymbol(false);
    }
  };

  const triggerScan = async (symbol: string) => {
    try {
      await fetch(`${API_URL}/signals/scan/${symbol}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    }
  };

  const filteredSignals = signals.filter(s => {
    if (filterDirection !== 'all' && s.direction !== filterDirection) return false;
    if (s.strength < filterStrength) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'bullish': return <TrendingUp className="w-4 h-4 text-success-400" />;
      case 'bearish': return <TrendingDown className="w-4 h-4 text-danger-400" />;
      default: return <Minus className="w-4 h-4 text-surface-400" />;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'bullish': return 'text-success-400 bg-success-500/10';
      case 'bearish': return 'text-danger-400 bg-danger-500/10';
      default: return 'text-surface-400 bg-surface-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-danger-500/20 text-danger-400 border-danger-500/30';
      case 'high': return 'bg-warning-500/20 text-warning-400 border-warning-500/30';
      default: return 'bg-surface-800 text-surface-300 border-surface-700';
    }
  };

  const formatTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading && signals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-accent-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-7 h-7 text-accent-400" />
            Signal Intelligence
          </h1>
          <p className="text-surface-400 mt-1">AI-powered market signals and notifications</p>
        </div>
        <button
          onClick={fetchData}
          className="btn btn-ghost gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Bot Status Card */}
      {botStatus && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${botStatus.isRunning ? 'bg-success-500/20' : 'bg-surface-800'}`}>
                <Bot className={`w-5 h-5 ${botStatus.isRunning ? 'text-success-400' : 'text-surface-500'}`} />
              </div>
              <div>
                <p className="font-medium">Signal Bot</p>
                <p className="text-sm text-surface-400">
                  {botStatus.isMarketHours ? 'Market Open - Active Scanning' : 'Market Closed - Reduced Activity'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-accent-400">{botStatus.signalsGeneratedToday}</p>
                <p className="text-surface-500">Signals Today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-surface-300">{botStatus.symbolsScannedToday}</p>
                <p className="text-surface-500">Scans Today</p>
              </div>
              {botStatus.lastScanTime && (
                <div className="text-center">
                  <p className="text-lg font-medium text-surface-300">{formatTimeAgo(botStatus.lastScanTime)}</p>
                  <p className="text-surface-500">Last Scan</p>
                </div>
              )}
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${botStatus.isRunning ? 'bg-success-500/20 text-success-400' : 'bg-surface-800 text-surface-500'}`}>
                {botStatus.isRunning ? 'Running' : 'Stopped'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-800">
        <button
          onClick={() => setActiveTab('signals')}
          className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'signals'
              ? 'border-accent-400 text-accent-400'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Signals
          <span className="px-2 py-0.5 bg-surface-800 rounded-full text-xs">{signals.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'notifications'
              ? 'border-accent-400 text-accent-400'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          Notifications
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-accent-500 text-surface-950 rounded-full text-xs font-bold">{unreadCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('tracked')}
          className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'tracked'
              ? 'border-accent-400 text-accent-400'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          Tracked Symbols
          <span className="px-2 py-0.5 bg-surface-800 rounded-full text-xs">{trackedSymbols.length}</span>
        </button>
      </div>

      {/* Signals Tab */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-surface-400" />
              <span className="text-sm text-surface-400">Filter:</span>
            </div>
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="input py-1.5 text-sm w-auto"
            >
              <option value="all">All Directions</option>
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>
            <select
              value={filterStrength}
              onChange={(e) => setFilterStrength(parseInt(e.target.value))}
              className="input py-1.5 text-sm w-auto"
            >
              <option value="0">All Strength</option>
              <option value="5">5+ Strength</option>
              <option value="7">7+ Strength</option>
              <option value="9">9+ Strength</option>
            </select>
          </div>

          {/* Signal Cards */}
          <div className="grid gap-4">
            {filteredSignals.length === 0 ? (
              <div className="card p-8 text-center">
                <Activity className="w-12 h-12 mx-auto text-surface-600 mb-3" />
                <p className="text-surface-400">No signals match your filters</p>
              </div>
            ) : (
              filteredSignals.map((signal) => (
                <div key={signal.id} className="card p-4 hover:border-surface-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getDirectionColor(signal.direction)}`}>
                        {getDirectionIcon(signal.direction)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-lg">{signal.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDirectionColor(signal.direction)}`}>
                            {signal.direction.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-surface-800 text-surface-300">
                            {signal.signal_type}
                          </span>
                          {signal.timeframe && (
                            <span className="px-2 py-0.5 rounded text-xs bg-surface-800 text-surface-400">
                              {signal.timeframe}
                            </span>
                          )}
                        </div>
                        <p className="font-medium mt-1">{signal.title}</p>
                        <p className="text-sm text-surface-400 mt-1">{signal.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <span className="text-surface-500">Price: <span className="text-surface-200">${parseFloat(signal.price_at_signal.toString()).toFixed(2)}</span></span>
                          {signal.target_price && (
                            <span className="text-surface-500">Target: <span className="text-success-400">${parseFloat(signal.target_price.toString()).toFixed(2)}</span></span>
                          )}
                          {signal.stop_price && (
                            <span className="text-surface-500">Stop: <span className="text-danger-400">${parseFloat(signal.stop_price.toString()).toFixed(2)}</span></span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm">
                          <span className="text-surface-500">Strength</span>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(10)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-4 rounded-sm ${i < signal.strength ? (signal.direction === 'bullish' ? 'bg-success-400' : signal.direction === 'bearish' ? 'bg-danger-400' : 'bg-surface-500') : 'bg-surface-800'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-sm ml-4">
                          <span className="text-surface-500">Confidence</span>
                          <p className="text-lg font-bold text-accent-400">{signal.confidence}%</p>
                        </div>
                      </div>
                      <p className="text-xs text-surface-500 mt-2">{formatTimeAgo(signal.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="card p-8 text-center">
              <Bell className="w-12 h-12 mx-auto text-surface-600 mb-3" />
              <p className="text-surface-400">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`card p-4 cursor-pointer hover:border-surface-700 transition-all ${!notification.is_read ? 'border-l-2 border-l-accent-400' : ''}`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getPriorityColor(notification.priority)}`}>
                      {notification.type === 'signal' ? <Zap className="w-4 h-4" /> :
                       notification.type === 'alert' ? <Bell className="w-4 h-4" /> :
                       notification.type === 'news' ? <Newspaper className="w-4 h-4" /> :
                       <AlertTriangle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${notification.is_read ? 'text-surface-400' : ''}`}>{notification.title}</p>
                      <p className="text-sm text-surface-500 mt-0.5">{notification.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-surface-500 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(notification.created_at)}
                    {notification.is_read && <CheckCircle className="w-4 h-4 text-success-500" />}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tracked Symbols Tab */}
      {activeTab === 'tracked' && (
        <div className="space-y-4">
          {/* Add Symbol */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Enter symbol (e.g., AAPL)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addTrackedSymbol()}
                className="input flex-1"
              />
              <button
                onClick={addTrackedSymbol}
                disabled={addingSymbol || !newSymbol.trim()}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Symbol
              </button>
            </div>
          </div>

          {/* Symbol List */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trackedSymbols.map((item) => (
              <div key={item.id} className="card p-4 hover:border-surface-700 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">{item.symbol}</p>
                    <p className="text-sm text-surface-400">{item.name || item.symbol}</p>
                  </div>
                  <button
                    onClick={() => triggerScan(item.symbol)}
                    className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-sm gap-1 transition-opacity"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Scan
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-surface-500">
                  <span>Priority: {item.priority}/10</span>
                  {item.last_scanned_at && (
                    <span>Last scan: {formatTimeAgo(item.last_scanned_at)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
