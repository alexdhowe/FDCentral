import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatPercent, formatVolume, getChangeClass } from '../lib/utils';

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
}

interface QuoteCardProps {
  quote: Quote;
  showDetails?: boolean;
  onClick?: () => void;
}

export default function QuoteCard({ quote, showDetails = false, onClick }: QuoteCardProps) {
  const changeClass = getChangeClass(quote.changePercent);

  const TrendIcon =
    quote.changePercent > 0 ? TrendingUp : quote.changePercent < 0 ? TrendingDown : Minus;

  const content = (
    <div className="card p-4 hover:border-gray-600 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">{quote.symbol}</h3>
        <TrendIcon className={`w-5 h-5 ${changeClass}`} />
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold">{formatCurrency(quote.price)}</span>
        <span className={`text-sm font-medium ${changeClass}`}>
          {formatPercent(quote.changePercent)}
        </span>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 mt-3 pt-3 border-t border-gray-700">
          <div>
            <span className="block text-gray-500">High</span>
            <span className="text-white">{formatCurrency(quote.high)}</span>
          </div>
          <div>
            <span className="block text-gray-500">Low</span>
            <span className="text-white">{formatCurrency(quote.low)}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-gray-500">Volume</span>
            <span className="text-white">{formatVolume(quote.volume)}</span>
          </div>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return <Link to={`/stock/${quote.symbol}`}>{content}</Link>;
}
