import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Bell } from 'lucide-react';
import api from '../lib/api';
import SearchBar from '../components/SearchBar';
import QuoteCard from '../components/QuoteCard';
import { formatCurrency, formatPercent, getChangeClass } from '../lib/utils';

interface MarketOverview {
  sp500?: { price: number; changePercent: number };
  dow?: { price: number; changePercent: number };
  nasdaq?: { price: number; changePercent: number };
  vix?: { price: number; changePercent: number };
}

interface PerformanceStats {
  wins: number;
  losses: number;
  active: number;
  winRate: number;
  avg_return: number;
  total_pnl: number;
}

export default function Dashboard() {
  const [marketOverview, setMarketOverview] = useState<MarketOverview>({});
  const [trending, setTrending] = useState<any[]>([]);
  const [trendingQuotes, setTrendingQuotes] = useState<any>({});
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);
  const [recentRecs, setRecentRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [marketRes, trendingRes, performanceRes, recsRes] = await Promise.all([
          api.get('/stocks/market-overview'),
          api.get('/stocks/trending'),
          api.get('/recommendations/performance'),
          api.get('/recommendations?limit=5'),
        ]);

        setMarketOverview(marketRes.data);
        setTrending(trendingRes.data.slice(0, 8));
        setPerformance(performanceRes.data);
        setRecentRecs(recsRes.data);

        // Fetch quotes for trending
        if (trendingRes.data.length > 0) {
          const symbols = trendingRes.data.slice(0, 8).map((t: any) => t.symbol);
          const quotesRes = await api.post('/stocks/quotes', { symbols });
          setTrendingQuotes(quotesRes.data);
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const indexCards = [
    { name: 'S&P 500', data: marketOverview.sp500 },
    { name: 'Dow Jones', data: marketOverview.dow },
    { name: 'Nasdaq', data: marketOverview.nasdaq },
    { name: 'VIX', data: marketOverview.vix },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400">Your market overview at a glance</p>
        </div>
        <SearchBar />
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indexCards.map((index) => (
          <div key={index.name} className="card p-4">
            <p className="text-sm text-gray-400 mb-1">{index.name}</p>
            {index.data ? (
              <>
                <p className="text-xl font-bold">{formatCurrency(index.data.price)}</p>
                <p className={`text-sm font-medium ${getChangeClass(index.data.changePercent)}`}>
                  {formatPercent(index.data.changePercent)}
                </p>
              </>
            ) : (
              <div className="animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-24 mb-1"></div>
                <div className="h-4 bg-gray-700 rounded w-16"></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-900/50 rounded-lg">
              <Target className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Win Rate</span>
          </div>
          <p className="text-2xl font-bold text-green-400">
            {performance?.winRate || 0}%
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">Active Plays</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {performance?.active || 0}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Avg Return</span>
          </div>
          <p className={`text-2xl font-bold ${getChangeClass(performance?.avg_return || 0)}`}>
            {formatPercent(performance?.avg_return || 0)}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${(performance?.total_pnl || 0) >= 0 ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              {(performance?.total_pnl || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <span className="text-sm text-gray-400">Total P&L</span>
          </div>
          <p className={`text-2xl font-bold ${getChangeClass(performance?.total_pnl || 0)}`}>
            {formatCurrency(performance?.total_pnl || 0)}
          </p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trending Stocks */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Trending Stocks</h2>
            <Link to="/watchlist" className="text-primary-400 hover:text-primary-300 text-sm">
              View all
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {loading ? (
              Array(4)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="card p-4 animate-pulse">
                    <div className="h-6 bg-gray-700 rounded w-20 mb-2"></div>
                    <div className="h-8 bg-gray-700 rounded w-32"></div>
                  </div>
                ))
            ) : (
              trending.map((stock) => {
                const quote = trendingQuotes[stock.symbol];
                if (!quote) return null;
                return (
                  <QuoteCard
                    key={stock.symbol}
                    quote={{
                      symbol: stock.symbol,
                      price: quote.price,
                      change: quote.change,
                      changePercent: quote.changePercent,
                      volume: quote.volume,
                      high: quote.high,
                      low: quote.low,
                    }}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Recent Recommendations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent Picks</h2>
            <Link to="/recommendations" className="text-primary-400 hover:text-primary-300 text-sm">
              View all
            </Link>
          </div>
          <div className="card divide-y divide-gray-700">
            {loading ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="h-5 bg-gray-700 rounded w-20 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-full"></div>
                  </div>
                ))
            ) : recentRecs.length > 0 ? (
              recentRecs.map((rec) => (
                <Link
                  key={rec.id}
                  to="/recommendations"
                  className="block p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{rec.symbol}</span>
                    <span
                      className={`badge ${
                        rec.recommendation_type.includes('buy') || rec.recommendation_type.includes('call')
                          ? 'badge-success'
                          : rec.recommendation_type.includes('sell') || rec.recommendation_type.includes('put')
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {rec.recommendation_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{rec.reasoning}</p>
                  {rec.profit_loss_percent !== null && (
                    <p className={`text-sm font-medium mt-1 ${getChangeClass(rec.profit_loss_percent)}`}>
                      {formatPercent(rec.profit_loss_percent)}
                    </p>
                  )}
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recommendations yet</p>
                <Link to="/recommendations" className="text-primary-400 text-sm">
                  Generate one
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
