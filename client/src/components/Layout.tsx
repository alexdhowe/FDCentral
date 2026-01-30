import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';
import {
  LayoutDashboard,
  List,
  Bell,
  MessageSquare,
  LineChart,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Zap,
  ChevronRight,
  Settings,
  Bot,
} from 'lucide-react';
import { useState } from 'react';
import Header from './Header';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', description: 'Overview & stats' },
  { to: '/watchlist', icon: List, label: 'Watchlists', description: 'Track symbols' },
  { to: '/signals', icon: Bot, label: 'Signals', description: 'AI market intelligence' },
  { to: '/options', icon: LineChart, label: 'Options', description: 'Options analysis' },
  { to: '/recommendations', icon: Zap, label: 'AI Picks', description: 'Trade signals' },
  { to: '/alerts', icon: Bell, label: 'Alerts', description: 'Price notifications' },
  { to: '/chat', icon: MessageSquare, label: 'Chat', description: 'Team discussion' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { isConnected } = useSocketStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <Header />

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside
          className={`hidden lg:flex lg:flex-col bg-surface-900/50 border-r border-surface-800/50 transition-all duration-300 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
          style={{ height: 'calc(100vh - 73px)', position: 'sticky', top: '73px' }}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-400 hover:text-surface-100 hover:bg-surface-700 transition-colors z-10"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-none">
            {navItems.map((item) => {
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-accent-500/10 text-accent-400'
                      : 'text-surface-400 hover:bg-surface-800/80 hover:text-surface-200'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isActive ? 'bg-accent-500/20' : 'bg-surface-800/50 group-hover:bg-surface-700/50'
                  }`}>
                    <item.icon className="w-[18px] h-[18px]" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-surface-500 truncate">{item.description}</p>
                    </div>
                  )}
                  {!sidebarCollapsed && isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-400" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-surface-800/50">
            <div className={`flex items-center gap-3 p-2 rounded-xl bg-surface-800/30 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center font-bold text-surface-950 text-sm flex-shrink-0">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-surface-200 truncate">{user?.username}</p>
                  <div className="flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <Wifi className="w-3 h-3 text-success-400" />
                        <span className="text-xs text-success-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-danger-400" />
                        <span className="text-xs text-danger-400">Offline</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full mt-2 px-3 py-2 text-surface-500 hover:text-surface-300 hover:bg-surface-800/50 rounded-lg transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            )}
          </div>
        </aside>

        {/* Mobile menu button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-900/95 backdrop-blur-xl border-t border-surface-800/50 px-2 py-2 safe-area-pb">
          <nav className="flex items-center justify-around">
            {navItems.slice(0, 5).map((item) => {
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                    isActive ? 'text-accent-400' : 'text-surface-500'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </NavLink>
              );
            })}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-surface-500"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </nav>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-surface-900 rounded-t-3xl border-t border-surface-800 p-6 animate-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Menu</h3>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-surface-800 text-surface-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 mb-6">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-accent-500/10 text-accent-400'
                          : 'text-surface-300 hover:bg-surface-800'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-surface-500">{item.description}</p>
                    </div>
                  </NavLink>
                ))}
              </div>

              <div className="divider mb-4" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center font-bold text-surface-950">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{user?.username}</p>
                    <p className="text-xs text-surface-500">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-surface-800 text-surface-400 hover:text-danger-400"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-h-[calc(100vh-73px)] pb-20 lg:pb-0">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
