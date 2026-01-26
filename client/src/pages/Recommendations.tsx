import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Target,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Sparkles,
  Trophy,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  DollarSign,
  Percent,
  Shield,
} from 'lucide-react';
import api from '../lib/api';
import { formatCurrency, formatPercent, getChangeClass, getTimeSince } from '../lib/utils';
import toast from 'react-hot-toast';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface OptionsPlay {
  strategy: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  strikes: {
    type: 'call' | 'put';
    action: 'buy' | 'sell';
    strikePrice: number;
    expiration: string;
  }[];
  maxProfit: string;
  maxLoss: string;
  breakeven: number;
  probability: number;
  riskReward: string;
  reasoning: string[];
  confidence: number;
}

interface Recommendation {
  id: string;
  symbol: string;
  recommendation_type: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  option_details: OptionsPlay | any;
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
  const [generating, setGenerating] = useState(false);

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
      setGenerating(true);
      const response = await api.post(`/recommendations/generate/${generatingSymbol}`);
      if (response.data.message) {
        toast(response.data.message, { icon: '🤔' });
      } else {
        toast.success('Recommendation generated! Time for tendies!');
      }
      setShowGenerateModal(false);
      setGeneratingSymbol('');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate recommendation');
    } finally {
      setGenerating(false);
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
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 'hit_stop':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'expired':
        return <Clock className="w-5 h-5 text-surface-400" />;
      default:
        return <Target className="w-5 h-5 text-blue-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    if (type.includes('buy') || type.includes('call') || type.includes('bull')) return 'bg-green-900/50 text-green-400';
    if (type.includes('sell') || type.includes('put') || type.includes('bear')) return 'bg-red-900/50 text-red-400';
    if (type.includes('straddle') || type.includes('neutral')) return 'bg-purple-900/50 text-purple-400';
    return 'bg-yellow-900/50 text-yellow-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            AI Recommendations
          </h1>
          <p className="text-surface-400">Technical analysis powered trade ideas with performance tracking</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-6 py-3 rounded-lg font-bold text-surface-900 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:via-amber-300 hover:to-yellow-400 transition-all duration-200 shadow-lg shadow-yellow-600/20 flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Generate Pick
        </button>
      </div>

      {/* Performance Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-green-600/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-900/50 rounded-xl">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-surface-400 font-medium">Win Rate</span>
          </div>
          <p className="text-4xl font-black text-green-400">{stats?.winRate || 0}%</p>
          <p className="text-sm text-surface-500 mt-2">
            {stats?.wins || 0} wins / {stats?.losses || 0} losses
          </p>
        </div>

        <div className="card p-5 border-blue-600/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-900/50 rounded-xl">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-surface-400 font-medium">Active Plays</span>
          </div>
          <p className="text-4xl font-black text-blue-400">{stats?.active || 0}</p>
          <p className="text-sm text-surface-500 mt-2">Currently tracking</p>
        </div>

        <div className="card p-5 border-purple-600/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-purple-900/50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-surface-400 font-medium">Avg Return</span>
          </div>
          <p className={`text-4xl font-black ${getChangeClass(stats?.avg_return || 0)}`}>
            {formatPercent(stats?.avg_return || 0)}
          </p>
          <p className="text-sm text-surface-500 mt-2">Per recommendation</p>
        </div>

        <div className="card p-5">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={45}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-surface-400 font-medium">
            {stats?.total_recommendations || 0} total picks
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'hit_target', 'hit_stop', 'expired'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === f
                ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-white shadow-lg shadow-yellow-600/20'
                : 'bg-surface-800 text-surface-300 hover:bg-surface-700 border border-surface-700'
            }`}
          >
            {f === 'hit_target' ? 'Winners' : f === 'hit_stop' ? 'Losers' : f.replace(/\b\w/g, (l) => l.toUpperCase())}
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
                <div className="h-6 bg-surface-700 rounded w-24 mb-4"></div>
                <div className="h-4 bg-surface-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-surface-700 rounded w-3/4"></div>
              </div>
            ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="grid gap-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="card p-6 hover:border-yellow-600/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {getStatusIcon(rec.status)}
                  <Link to={`/stock/${rec.symbol}`} className="text-2xl font-black hover:text-yellow-400 transition-colors">
                    {rec.symbol}
                  </Link>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTypeColor(rec.recommendation_type)}`}>
                    {rec.recommendation_type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-900/50 text-blue-400">
                    {rec.confidence_score}% confidence
                  </span>
                </div>

                <div className="text-right text-sm">
                  <p className="text-surface-400">{getTimeSince(rec.created_at)}</p>
                  <p className="text-surface-500">by {rec.created_by_name}</p>
                </div>
              </div>

              {/* Reasoning - show in preformatted style */}
              <div className="bg-surface-900/50 rounded-lg p-4 mb-4 font-mono text-sm text-surface-300 whitespace-pre-wrap border border-surface-700/50">
                {rec.reasoning}
              </div>

              {/* Price levels */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-surface-800/50 rounded-lg p-3">
                  <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Entry</p>
                  <p className="text-lg font-bold">{formatCurrency(rec.entry_price)}</p>
                </div>
                <div className="bg-surface-800/50 rounded-lg p-3">
                  <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Target</p>
                  <p className="text-lg font-bold text-green-400 flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    {formatCurrency(rec.target_price)}
                  </p>
                </div>
                <div className="bg-surface-800/50 rounded-lg p-3">
                  <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Stop Loss</p>
                  <p className="text-lg font-bold text-red-400 flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4" />
                    {formatCurrency(rec.stop_loss)}
                  </p>
                </div>
                {rec.exit_price ? (
                  <div className="bg-surface-800/50 rounded-lg p-3">
                    <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Exit</p>
                    <p className={`text-lg font-bold ${getChangeClass(rec.profit_loss_percent || 0)}`}>
                      {formatCurrency(rec.exit_price)}
                      <span className="text-sm ml-1">({formatPercent(rec.profit_loss_percent || 0)})</span>
                    </p>
                  </div>
                ) : (
                  <div className="bg-surface-800/50 rounded-lg p-3">
                    <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Status</p>
                    <p className="text-lg font-bold text-blue-400 capitalize">{rec.status}</p>
                  </div>
                )}
              </div>

              {/* Options Play Card */}
              {rec.option_details && <OptionsPlayCard optionsPlay={rec.option_details} />}

              {/* Reactions */}
              <div className="flex items-center gap-3 pt-4 border-t border-surface-700/50">
                <button
                  onClick={() => react(rec.id, 'bullish')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    rec.user_reaction === 'bullish'
                      ? 'bg-green-600 text-white'
                      : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>{rec.bullish_count}</span>
                </button>
                <button
                  onClick={() => react(rec.id, 'bearish')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    rec.user_reaction === 'bearish'
                      ? 'bg-red-600 text-white'
                      : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>{rec.bearish_count}</span>
                </button>
                <button
                  onClick={() => react(rec.id, 'following')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    rec.user_reaction === 'following'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
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
        <div className="card p-12 text-center border-dashed border-2 border-surface-700">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-surface-800 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">No recommendations yet</h3>
          <p className="text-surface-400 mb-6 max-w-md mx-auto">
            Generate your first AI-powered trade recommendation based on technical analysis
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-6 py-3 rounded-lg font-bold text-surface-900 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:via-amber-300 hover:to-yellow-400 transition-all duration-200 shadow-lg shadow-yellow-600/20"
          >
            Generate Your First Pick
          </button>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md border-yellow-600/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-600/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Generate AI Recommendation</h3>
                <p className="text-surface-400 text-sm">Powered by technical analysis</p>
              </div>
            </div>
            <p className="text-surface-300 mb-4">
              Enter a stock symbol to analyze. Our AI will evaluate RSI, MACD, Bollinger Bands, ADX, and more to generate a trade recommendation.
            </p>
            <input
              type="text"
              value={generatingSymbol}
              onChange={(e) => setGeneratingSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL, TSLA, NVDA..."
              className="input mb-4 text-lg font-mono"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && generateRecommendation()}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 rounded-lg font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateRecommendation}
                disabled={generating || !generatingSymbol.trim()}
                className="px-6 py-2 rounded-lg font-bold text-surface-900 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Options Play Card Component
function OptionsPlayCard({ optionsPlay }: { optionsPlay: OptionsPlay | any }) {
  // Handle both new TA-based format and legacy format
  if (!optionsPlay) return null;

  // New TA-based options play format
  if (optionsPlay.strategy) {
    const directionColors = {
      bullish: 'border-green-600/30 bg-green-900/10',
      bearish: 'border-red-600/30 bg-red-900/10',
      neutral: 'border-purple-600/30 bg-purple-900/10',
    };

    const directionIcons = {
      bullish: <TrendingUp className="w-5 h-5 text-green-400" />,
      bearish: <TrendingDown className="w-5 h-5 text-red-400" />,
      neutral: <Zap className="w-5 h-5 text-purple-400" />,
    };

    return (
      <div className={`rounded-xl p-4 mb-4 border ${directionColors[optionsPlay.direction as keyof typeof directionColors] || 'border-surface-600/30'}`}>
        <div className="flex items-center gap-3 mb-3">
          {directionIcons[optionsPlay.direction as keyof typeof directionIcons]}
          <h4 className="text-lg font-bold">{optionsPlay.strategy}</h4>
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
            optionsPlay.direction === 'bullish' ? 'bg-green-600 text-white' :
            optionsPlay.direction === 'bearish' ? 'bg-red-600 text-white' :
            'bg-purple-600 text-white'
          }`}>
            {optionsPlay.direction}
          </span>
        </div>

        {/* Strikes */}
        <div className="space-y-2 mb-4">
          {optionsPlay.strikes?.map((strike: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                strike.action === 'buy' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {strike.action.toUpperCase()}
              </span>
              <span className="font-mono font-bold">${strike.strikePrice}</span>
              <span className={`${strike.type === 'call' ? 'text-green-400' : 'text-red-400'}`}>
                {strike.type.toUpperCase()}
              </span>
              <span className="text-surface-500">exp: {strike.expiration}</span>
            </div>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-surface-800/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-surface-500 mb-1">
              <DollarSign className="w-3 h-3" />
              Max Profit
            </div>
            <p className="text-sm font-bold text-green-400">{optionsPlay.maxProfit}</p>
          </div>
          <div className="bg-surface-800/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-surface-500 mb-1">
              <Shield className="w-3 h-3" />
              Max Loss
            </div>
            <p className="text-sm font-bold text-red-400">{optionsPlay.maxLoss}</p>
          </div>
          <div className="bg-surface-800/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-surface-500 mb-1">
              <Target className="w-3 h-3" />
              Breakeven
            </div>
            <p className="text-sm font-bold">${optionsPlay.breakeven?.toFixed(2)}</p>
          </div>
          <div className="bg-surface-800/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-xs text-surface-500 mb-1">
              <Percent className="w-3 h-3" />
              Probability
            </div>
            <p className="text-sm font-bold text-blue-400">{optionsPlay.probability}%</p>
          </div>
        </div>

        {/* Reasoning */}
        {optionsPlay.reasoning && optionsPlay.reasoning.length > 0 && (
          <div className="space-y-1">
            {optionsPlay.reasoning.map((reason: string, i: number) => (
              <p key={i} className="text-sm text-surface-300">{reason}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Legacy format (fallback)
  return (
    <div className="bg-surface-700/50 rounded-lg p-3 mb-4">
      <p className="text-sm text-surface-400">Options Play:</p>
      <p className="font-medium">
        ${optionsPlay.strike} {optionsPlay.type} @ {formatCurrency(optionsPlay.premium || 0)}
        {optionsPlay.impliedVolatility && ` (IV: ${(optionsPlay.impliedVolatility * 100).toFixed(1)}%)`}
      </p>
    </div>
  );
}
