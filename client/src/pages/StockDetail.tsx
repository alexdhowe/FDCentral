import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Bell, TrendingUp, Sparkles, Share2 } from 'lucide-react';
import api from '../lib/api';
import StockChart from '../components/StockChart';
import { formatCurrency, formatPercent, formatVolume, formatMarketCap, getChangeClass } from '../lib/utils';
import toast from 'react-hot-toast';

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

interface CompanyInfo {
  profile?: {
    industry?: string;
    sector?: string;
    website?: string;
    longBusinessSummary?: string;
  };
  details?: {
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    dividendYield?: number;
    beta?: number;
  };
  keyStats?: {
    trailingPE?: number;
    forwardPE?: number;
    priceToBook?: number;
  };
}

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [quoteRes, infoRes] = await Promise.all([
          api.get(`/stocks/quote/${symbol}`),
          api.get(`/stocks/company/${symbol}`).catch(() => ({ data: null })),
        ]);

        setQuote(quoteRes.data);
        setCompanyInfo(infoRes.data);
      } catch (error) {
        toast.error('Failed to load stock data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  const generateRecommendation = async () => {
    if (!symbol) return;
    setGenerating(true);

    try {
      const response = await api.post(`/recommendations/generate/${symbol}`);
      toast.success(`Generated ${response.data.recommendation.recommendation_type} recommendation!`);
    } catch (error) {
      toast.error('Failed to generate recommendation');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Stock not found</p>
        <Link to="/" className="text-primary-400 mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl font-bold">{quote.symbol}</h1>
            <span className="text-4xl font-bold">{formatCurrency(quote.price)}</span>
            <span className={`text-xl font-medium ${getChangeClass(quote.changePercent)}`}>
              {quote.change >= 0 ? '+' : ''}{formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
            </span>
          </div>
          {companyInfo?.profile?.sector && (
            <p className="text-gray-400 mt-1">
              {companyInfo.profile.sector} · {companyInfo.profile.industry}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={generateRecommendation}
            disabled={generating}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Analyzing...' : 'Get AI Pick'}
          </button>
          <Link to={`/options/${symbol}`} className="btn-secondary flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Options
          </Link>
          <Link to={`/alerts?symbol=${symbol}`} className="btn-ghost flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alert
          </Link>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <StockChart symbol={symbol!} height={450} />
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-400">Open</p>
          <p className="text-lg font-bold">{formatCurrency(quote.open)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Previous Close</p>
          <p className="text-lg font-bold">{formatCurrency(quote.previousClose)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Day Range</p>
          <p className="text-lg font-bold">
            {formatCurrency(quote.low)} - {formatCurrency(quote.high)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Volume</p>
          <p className="text-lg font-bold">{formatVolume(quote.volume)}</p>
        </div>
      </div>

      {/* More Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4">Key Statistics</h3>
          <div className="space-y-3">
            {quote.marketCap && (
              <div className="flex justify-between">
                <span className="text-gray-400">Market Cap</span>
                <span className="font-medium">{formatMarketCap(quote.marketCap)}</span>
              </div>
            )}
            {companyInfo?.details?.fiftyTwoWeekHigh && (
              <div className="flex justify-between">
                <span className="text-gray-400">52 Week High</span>
                <span className="font-medium">{formatCurrency(companyInfo.details.fiftyTwoWeekHigh)}</span>
              </div>
            )}
            {companyInfo?.details?.fiftyTwoWeekLow && (
              <div className="flex justify-between">
                <span className="text-gray-400">52 Week Low</span>
                <span className="font-medium">{formatCurrency(companyInfo.details.fiftyTwoWeekLow)}</span>
              </div>
            )}
            {companyInfo?.keyStats?.trailingPE && (
              <div className="flex justify-between">
                <span className="text-gray-400">P/E Ratio</span>
                <span className="font-medium">{companyInfo.keyStats.trailingPE.toFixed(2)}</span>
              </div>
            )}
            {companyInfo?.details?.beta && (
              <div className="flex justify-between">
                <span className="text-gray-400">Beta</span>
                <span className="font-medium">{companyInfo.details.beta.toFixed(2)}</span>
              </div>
            )}
            {companyInfo?.details?.dividendYield && (
              <div className="flex justify-between">
                <span className="text-gray-400">Dividend Yield</span>
                <span className="font-medium">{(companyInfo.details.dividendYield * 100).toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4">About</h3>
          {companyInfo?.profile?.longBusinessSummary ? (
            <p className="text-gray-300 text-sm leading-relaxed line-clamp-6">
              {companyInfo.profile.longBusinessSummary}
            </p>
          ) : (
            <p className="text-gray-400">No company description available.</p>
          )}
          {companyInfo?.profile?.website && (
            <a
              href={companyInfo.profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 text-sm mt-4 inline-block hover:underline"
            >
              Visit website →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
