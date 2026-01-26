import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, TrendingUp, TrendingDown, Activity, Calculator } from 'lucide-react';
import api from '../lib/api';
import { formatCurrency, formatPercent, getChangeClass } from '../lib/utils';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface OptionContract {
  contractSymbol: string;
  strike: number;
  expiration: string;
  type: 'call' | 'put';
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  percentChange: number;
}

interface OptionChain {
  expirationDates: string[];
  calls: OptionContract[];
  puts: OptionContract[];
}

export default function Options() {
  const { symbol: paramSymbol } = useParams();
  const [searchParams] = useSearchParams();
  const [symbol, setSymbol] = useState(paramSymbol || searchParams.get('symbol') || '');
  const [searchSymbol, setSearchSymbol] = useState(symbol);
  const [chain, setChain] = useState<OptionChain | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [selectedExpiration, setSelectedExpiration] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<OptionContract | null>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (symbol) {
      fetchData();
    }
  }, [symbol, selectedExpiration]);

  const fetchData = async () => {
    if (!symbol) return;
    setLoading(true);

    try {
      const [chainRes, quoteRes] = await Promise.all([
        api.get(`/options/chain/${symbol}`, {
          params: selectedExpiration ? { expiration: selectedExpiration } : {},
        }),
        api.get(`/stocks/quote/${symbol}`),
      ]);

      setChain(chainRes.data);
      setQuote(quoteRes.data);

      if (!selectedExpiration && chainRes.data.expirationDates.length > 0) {
        setSelectedExpiration(chainRes.data.expirationDates[0]);
      }
    } catch (error) {
      toast.error('Failed to load options data');
    } finally {
      setLoading(false);
    }
  };

  const calculatePnl = async (option: OptionContract) => {
    if (!quote) return;

    try {
      const response = await api.post('/options/calculate-pnl', {
        optionType: option.type,
        strikePrice: option.strike,
        premium: option.lastPrice,
        quantity: 1,
        currentPrice: quote.price,
        position: 'long',
      });

      setPnlData(response.data);
      setSelectedOption(option);
      setShowCalculator(true);
    } catch (error) {
      toast.error('Failed to calculate P&L');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSymbol.trim()) {
      setSymbol(searchSymbol.toUpperCase());
      setSelectedExpiration('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Options Chain</h1>
          <p className="text-gray-400">Analyze options and visualize P&L</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol..."
              className="input pl-10 w-48"
            />
          </div>
          <button type="submit" className="btn-primary">
            Load Chain
          </button>
        </form>
      </div>

      {symbol && quote && (
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold">{symbol}</span>
            <span className="text-2xl font-bold ml-4">{formatCurrency(quote.price)}</span>
            <span className={`ml-2 ${getChangeClass(quote.changePercent)}`}>
              {formatPercent(quote.changePercent)}
            </span>
          </div>

          {chain && chain.expirationDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Expiration:</span>
              <select
                value={selectedExpiration}
                onChange={(e) => setSelectedExpiration(e.target.value)}
                className="input w-auto"
              >
                {chain.expirationDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : chain ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calls */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="font-bold text-green-400">Calls</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Strike</th>
                    <th className="px-4 py-3 text-right">Last</th>
                    <th className="px-4 py-3 text-right">Bid/Ask</th>
                    <th className="px-4 py-3 text-right">IV</th>
                    <th className="px-4 py-3 text-right">Vol</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {chain.calls.slice(0, 15).map((call) => (
                    <tr
                      key={call.contractSymbol}
                      className={`hover:bg-gray-700/50 ${call.inTheMoney ? 'bg-green-900/20' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium">{call.strike}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(call.lastPrice)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {call.bid}/{call.ask}
                      </td>
                      <td className="px-4 py-3 text-right">{(call.impliedVolatility * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">{call.volume.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => calculatePnl(call)}
                          className="p-1 text-gray-400 hover:text-primary-400"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Puts */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-red-400">Puts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Strike</th>
                    <th className="px-4 py-3 text-right">Last</th>
                    <th className="px-4 py-3 text-right">Bid/Ask</th>
                    <th className="px-4 py-3 text-right">IV</th>
                    <th className="px-4 py-3 text-right">Vol</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {chain.puts.slice(0, 15).map((put) => (
                    <tr
                      key={put.contractSymbol}
                      className={`hover:bg-gray-700/50 ${put.inTheMoney ? 'bg-red-900/20' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium">{put.strike}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(put.lastPrice)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {put.bid}/{put.ask}
                      </td>
                      <td className="px-4 py-3 text-right">{(put.impliedVolatility * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">{put.volume.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => calculatePnl(put)}
                          className="p-1 text-gray-400 hover:text-primary-400"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">Enter a symbol</h3>
          <p className="text-gray-400">Search for a stock to view its options chain</p>
        </div>
      )}

      {/* P&L Calculator Modal */}
      {showCalculator && selectedOption && pnlData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">
                {symbol} ${selectedOption.strike} {selectedOption.type.toUpperCase()}
              </h3>
              <button onClick={() => setShowCalculator(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <p className="text-gray-400 text-sm">Break Even</p>
                <p className="text-xl font-bold">{formatCurrency(pnlData.breakEven)}</p>
              </div>
              <div className="text-center p-4 bg-green-900/30 rounded-lg">
                <p className="text-gray-400 text-sm">Max Profit</p>
                <p className="text-xl font-bold text-green-400">
                  {typeof pnlData.maxProfit === 'number' ? formatCurrency(pnlData.maxProfit) : pnlData.maxProfit}
                </p>
              </div>
              <div className="text-center p-4 bg-red-900/30 rounded-lg">
                <p className="text-gray-400 text-sm">Max Loss</p>
                <p className="text-xl font-bold text-red-400">
                  {typeof pnlData.maxLoss === 'number' ? formatCurrency(pnlData.maxLoss) : pnlData.maxLoss}
                </p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlData.pricePoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="stockPrice"
                    stroke="#9ca3af"
                    tickFormatter={(val) => `$${val}`}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    formatter={(value: number) => [formatCurrency(value), 'P&L']}
                    labelFormatter={(label) => `Stock: ${formatCurrency(label)}`}
                  />
                  <ReferenceLine y={0} stroke="#6b7280" />
                  <ReferenceLine x={quote?.price} stroke="#0ea5e9" strokeDasharray="5 5" label="Current" />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 text-center">
              <p className="text-gray-400">
                Current P&L:{' '}
                <span className={getChangeClass(pnlData.currentPnL)}>
                  {formatCurrency(pnlData.currentPnL)}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
