import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Share2, Users, Eye, MoreVertical } from 'lucide-react';
import api from '../lib/api';
import SearchBar from '../components/SearchBar';
import QuoteCard from '../components/QuoteCard';
import toast from 'react-hot-toast';

interface Watchlist {
  id: string;
  name: string;
  description: string;
  is_shared: boolean;
  item_count: number;
  creator_name: string;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  item_type: string;
  notes: string;
  added_by_name: string;
}

export default function Watchlist() {
  const { id } = useParams();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState<Watchlist | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newWatchlistName, setNewWatchlistName] = useState('');

  useEffect(() => {
    fetchWatchlists();
  }, []);

  useEffect(() => {
    if (id && watchlists.length > 0) {
      const wl = watchlists.find((w) => w.id === id);
      if (wl) {
        setSelectedWatchlist(wl);
        fetchItems(wl.id);
      }
    } else if (watchlists.length > 0 && !selectedWatchlist) {
      setSelectedWatchlist(watchlists[0]);
      fetchItems(watchlists[0].id);
    }
  }, [id, watchlists]);

  const fetchWatchlists = async () => {
    try {
      const response = await api.get('/watchlist');
      setWatchlists(response.data);
    } catch (error) {
      toast.error('Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (watchlistId: string) => {
    try {
      const response = await api.get(`/watchlist/${watchlistId}/items`);
      setItems(response.data);

      if (response.data.length > 0) {
        const symbols = response.data.map((item: WatchlistItem) => item.symbol);
        const quotesRes = await api.post('/stocks/quotes', { symbols });
        setQuotes(quotesRes.data);
      }
    } catch (error) {
      toast.error('Failed to load watchlist items');
    }
  };

  const createWatchlist = async () => {
    if (!newWatchlistName.trim()) return;

    try {
      const response = await api.post('/watchlist', {
        name: newWatchlistName,
        description: '',
      });
      setWatchlists([...watchlists, response.data]);
      setNewWatchlistName('');
      setShowNewModal(false);
      toast.success('Watchlist created!');
    } catch (error) {
      toast.error('Failed to create watchlist');
    }
  };

  const addSymbol = async () => {
    if (!newSymbol.trim() || !selectedWatchlist) return;

    try {
      await api.post(`/watchlist/${selectedWatchlist.id}/items`, {
        symbol: newSymbol.toUpperCase(),
      });
      await fetchItems(selectedWatchlist.id);
      setNewSymbol('');
      setShowAddSymbol(false);
      toast.success(`${newSymbol.toUpperCase()} added to watchlist`);
    } catch (error) {
      toast.error('Failed to add symbol');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!selectedWatchlist) return;

    try {
      await api.delete(`/watchlist/${selectedWatchlist.id}/items/${itemId}`);
      setItems(items.filter((i) => i.id !== itemId));
      toast.success('Removed from watchlist');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const deleteWatchlist = async (wlId: string) => {
    try {
      await api.delete(`/watchlist/${wlId}`);
      setWatchlists(watchlists.filter((w) => w.id !== wlId));
      if (selectedWatchlist?.id === wlId) {
        setSelectedWatchlist(null);
        setItems([]);
      }
      toast.success('Watchlist deleted');
    } catch (error) {
      toast.error('Failed to delete watchlist');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Watchlists</h1>
          <p className="text-gray-400">Track your favorite stocks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Watchlist
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Watchlist Sidebar */}
        <div className="lg:col-span-1">
          <div className="card divide-y divide-gray-700">
            {loading ? (
              <div className="p-4 animate-pulse space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-700 rounded"></div>
                ))}
              </div>
            ) : watchlists.length > 0 ? (
              watchlists.map((wl) => (
                <button
                  key={wl.id}
                  onClick={() => {
                    setSelectedWatchlist(wl);
                    fetchItems(wl.id);
                  }}
                  className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors flex items-center justify-between ${
                    selectedWatchlist?.id === wl.id ? 'bg-gray-700/50' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{wl.name}</span>
                      {wl.is_shared && <Users className="w-4 h-4 text-primary-400" />}
                    </div>
                    <span className="text-sm text-gray-400">{wl.item_count} items</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWatchlist(wl.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No watchlists yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Watchlist Content */}
        <div className="lg:col-span-3">
          {selectedWatchlist ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedWatchlist.name}</h2>
                  {selectedWatchlist.is_shared && (
                    <p className="text-sm text-gray-400">Shared watchlist</p>
                  )}
                </div>
                <button
                  onClick={() => setShowAddSymbol(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Symbol
                </button>
              </div>

              {items.length > 0 ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const quote = quotes[item.symbol];
                    return (
                      <div key={item.id} className="relative group">
                        {quote ? (
                          <QuoteCard
                            quote={{
                              symbol: item.symbol,
                              price: quote.price,
                              change: quote.change,
                              changePercent: quote.changePercent,
                              volume: quote.volume,
                              high: quote.high,
                              low: quote.low,
                            }}
                            showDetails
                          />
                        ) : (
                          <div className="card p-4">
                            <p className="font-bold">{item.symbol}</p>
                            <p className="text-gray-400">Loading...</p>
                          </div>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute top-2 right-2 p-1.5 bg-gray-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-12 text-center">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg font-medium mb-2">No stocks yet</h3>
                  <p className="text-gray-400 mb-4">Add some symbols to start tracking</p>
                  <button
                    onClick={() => setShowAddSymbol(true)}
                    className="btn-primary"
                  >
                    Add Symbol
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center">
              <Eye className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-medium mb-2">Select a watchlist</h3>
              <p className="text-gray-400">Choose from the sidebar or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* New Watchlist Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Create Watchlist</h3>
            <input
              type="text"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              placeholder="Watchlist name"
              className="input mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewModal(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={createWatchlist} className="btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Symbol Modal */}
      {showAddSymbol && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Symbol</h3>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL, TSLA, SPY..."
              className="input mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddSymbol(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={addSymbol} className="btn-primary">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
