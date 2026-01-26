import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, TrendingUp, ArrowUpRight } from 'lucide-react';
import api from '../lib/api';

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get('/stocks/search', { params: { q: query } });
        setResults(response.data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSelect = (symbol: string) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    navigate(`/stock/${symbol}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex].symbol);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search symbols..."
          className="w-full pl-10 pr-10 py-2.5 bg-surface-800/50 border border-surface-700/50 rounded-xl text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:bg-surface-800 focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/10 transition-all"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-surface-600 border-t-accent-500 rounded-full animate-spin" />
          </div>
        )}
        {query && !loading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-900 border border-surface-700/50 rounded-xl shadow-2xl shadow-black/30 z-50 max-h-80 overflow-auto">
          <div className="p-2">
            {results.map((result, index) => (
              <button
                key={result.symbol}
                onClick={() => handleSelect(result.symbol)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent-500/10 text-accent-400'
                    : 'hover:bg-surface-800 text-surface-200'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-surface-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{result.symbol}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-700 text-surface-400">
                      {result.type}
                    </span>
                  </div>
                  <p className="text-sm text-surface-500 truncate">{result.name}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-900 border border-surface-700/50 rounded-xl shadow-2xl z-50 p-6 text-center">
          <Search className="w-8 h-8 text-surface-600 mx-auto mb-2" />
          <p className="text-surface-400 text-sm">No results for "{query}"</p>
          <p className="text-surface-500 text-xs mt-1">Try a different symbol or company name</p>
        </div>
      )}
    </div>
  );
}
