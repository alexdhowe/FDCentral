import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Sparkles,
  Trophy,
  XCircle,
  Clock,
} from 'lucide-react';
import api from '../lib/api';
import { formatCurrency, formatPercent, getChangeClass, getTimeSince } from '../lib/utils';
import toast from 'react-hot-toast';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface Recommendation {
  id: string;
  symbol: string;
  recommendation_type: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  option_details: any;
  reasoning: string;
  confidence_score: number;
  status: string;
  created_by_name: string;
  created_at: string;
  exit_price?: number;
  profit_loss_percent?: number;
  bullish_count: number;
  bearish_count: number;
  following_count: number;
  user_reaction?: string;
}

interface PerformanceStats {
  wins: number;
  losses: number;
  active: number;
  expired: number;
  winRate: number;
  avg_return: number;
  total_pnl: number;
  total_recommendations: number;
}

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [generatingSymbol, setGeneratingSymbol] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const [recsRes, statsRes] = await Promise.all([
        api.get('/recommendations', { params: { status: filter } }),
        api.get('/recommendations/performance'),
      ]);

      setRecommendations(recsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendation = async () => {
    if (!generatingSymbol.trim()) return;

    try {
      setLoading(true);
      await api.post(`/recommendations/generate/${generatingSymbol}`);
      toast.success('Recommendation generated!');
      setShowGenerateModal(false);
      setGeneratingSymbol('');
      fetchData();
    } catch (error) {
      toast.error('Failed to generate recommendation');
    } finally {
      setLoading(false);
    }
  };

  const react = async (recId: string, reactionType: string) => {
    try {
      await api.post(`/recommendations/${recId}/react`, { reactionType });
      setRecommendations(
        recommendations.map((r) =>
          r.id === recId
            ? {
                ...r,
                user_reaction: reactionType,
                bullish_count: reactionType === 'bullish' ? r.bullish_count + 1 : r.bullish_count,
                bearish_count: reactionType === 'bearish' ? r.bearish_count + 1 : r.bearish_count,
                following_count: reactionType === 'following' ? r.following_count + 1 : r.following_count,
              }
            : r
        )
      );
    } catch (error) {
      toast.error('Failed to react');
    }
  };

  const pieData = stats
    ? [
        { name: 'Wins', value: stats.wins, color: '#22c55e' },
        { name: 'Losses', value: stats.losses, color: '#ef4444' },
        { name: 'Active', value: stats.active, color: '#0ea5e9' },
        { name: 'Expired', value: stats.expired, color: '#6b7280' },
      ]
    : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hit_target':
        return <Trophy className="w-5 h-5 text-green-400" />;
      case 'hit_stop':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'expired':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Target className="w-5 h-5 text-blue-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    if (type.includes('buy') || type.includes('call')) return 'badge-success';
    if (type.includes('sell') || type.includes('put')) return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recommendations</h1>
          <p className="text-gray-400">AI-powered trade ideas with performance tracking</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Pick
        </button>
      </div>

      {/* Performance Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-900/50 rounded-lg">
              <Trophy className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Win Rate</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{stats?.winRate || 0}%</p>
          <p className="text-sm text-gray-400 mt-1">
            {stats?.wins || 0} wins / {stats?.losses || 0} losses
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">Active Plays</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{stats?.active || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Currently tracking</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Avg Return</span>
          </div>
          <p className={`text-3xl font-bold ${getChangeClass(stats?.avg_return || 0)}`}>
            {formatPercent(stats?.avg_return || 0)}
          </p>
          <p className="text-sm text-gray-400 mt-1">Per recommendation</p>
        </div>

        <div className="card p-4">
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-gray-400">
            {stats?.total_recommendations || 0} total picks
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'active', 'hit_target', 'hit_stop', 'expired'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {f.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Recommendations List */}
      {loading ? (
        <div className="grid gap-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-24 mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="grid gap-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(rec.status)}
                  <Link to={`/stock/${rec.symbol}`} className="text-xl font-bold hover:text-primary-400">
                    {rec.symbol}
                  </Link>
                  <span className={`badge ${getTypeColor(rec.recommendation_type)}`}>
                    {rec.recommendation_type.replace('_', ' ')}
                  </span>
                  <span className="badge badge-info">{rec.confidence_score}% confidence</span>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-400">{getTimeSince(rec.created_at)}</p>
                  <p className="text-sm text-gray-400">by {rec.created_by_name}</p>
                </div>
              </div>

              <p className="text-gray-300 mb-4">{rec.reasoning}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-400">Entry</p>
                  <p className="font-medium">{formatCurrency(rec.entry_price)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Target</p>
                  <p className="font-medium text-green-400">{formatCurrency(rec.target_price)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Stop Loss</p>
                  <p className="font-medium text-red-400">{formatCurrency(rec.stop_loss)}</p>
                </div>
                {rec.exit_price && (
                  <div>
                    <p className="text-sm text-gray-400">Exit</p>
                    <p className={`font-medium ${getChangeClass(rec.profit_loss_percent || 0)}`}>
                      {formatCurrency(rec.exit_price)} ({formatPercent(rec.profit_loss_percent || 0)})
                    </p>
                  </div>
                )}
              </div>

              {rec.option_details && (
                <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-400">Options Play:</p>
                  <p className="font-medium">
                    ${rec.option_details.strike} {rec.option_details.type} @{' '}
                    {formatCurrency(rec.option_details.premium)} (IV:{' '}
                    {(rec.option_details.impliedVolatility * 100).toFixed(1)}%)
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
                <button
                  onClick={() => react(rec.id, 'bullish')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    rec.user_reaction === 'bullish'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>{rec.bullish_count}</span>
                </button>
                <button
                  onClick={() => react(rec.id, 'bearish')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    rec.user_reaction === 'bearish'
                      ? 'bg-red-900/50 text-red-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>{rec.bearish_count}</span>
                </button>
                <button
                  onClick={() => react(rec.id, 'following')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    rec.user_reaction === 'following'
                      ? 'bg-primary-900/50 text-primary-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{rec.following_count} following</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
          <p className="text-gray-400 mb-4">Generate your first AI-powered trade idea</p>
          <button onClick={() => setShowGenerateModal(true)} className="btn-primary">
            Generate Pick
          </button>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Generate AI Recommendation</h3>
            <p className="text-gray-400 mb-4">
              Enter a stock symbol to analyze with our AI-powered recommendation engine.
            </p>
            <input
              type="text"
              value={generatingSymbol}
              onChange={(e) => setGeneratingSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL, TSLA, NVDA..."
              className="input mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowGenerateModal(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={generateRecommendation} className="btn-primary">
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
