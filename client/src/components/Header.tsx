import { TrendingUp, Search, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import SearchBar from './SearchBar';

export default function Header() {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/50">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/20 group-hover:shadow-accent-500/40 transition-shadow">
            <TrendingUp className="w-5 h-5 text-surface-950" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-gradient">FD Central</span>
            </h1>
            <p className="text-[10px] text-surface-500 font-medium tracking-widest uppercase -mt-0.5">
              Trading Intelligence
            </p>
          </div>
        </Link>

        {/* Center - Search (Desktop) */}
        <div className="hidden md:block flex-1 max-w-md mx-8">
          <SearchBar />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search toggle (Mobile) */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="md:hidden p-2.5 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/50 border border-surface-700/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
            </span>
            <span className="text-xs font-medium text-surface-400">Markets Open</span>
          </div>

          {/* Notifications */}
          <button className="relative p-2.5 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full"></span>
          </button>
        </div>
      </div>

      {/* Mobile Search */}
      {showSearch && (
        <div className="md:hidden px-4 pb-4">
          <SearchBar />
        </div>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-500/30 to-transparent" />
    </header>
  );
}
