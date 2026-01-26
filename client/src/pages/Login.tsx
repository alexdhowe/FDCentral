import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Mail, Lock, TrendingUp, Flame, DollarSign, BarChart2, Users, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Welcome back! Time to print tendies!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-12 flex-col justify-between">
        {/* Animated gold sparkles background */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>

        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-600 via-amber-400 to-yellow-600" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex gap-1 items-end">
              <GoldBar size="sm" />
              <GoldBar size="md" />
              <GoldBar size="lg" />
            </div>
            <PepeFrog className="w-16 h-16" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              FD
            </span>
            <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              {' '}Central
            </span>
          </h1>
          <p className="text-yellow-400/80 font-medium tracking-widest text-sm mt-2">
            TENDIES OR BUST
          </p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              Your Ultimate Trading Command Center
            </h2>
            <div className="space-y-4">
              <FeatureItem icon={BarChart2} text="Real-time stock & options data" />
              <FeatureItem icon={TrendingUp} text="AI-powered trade recommendations" />
              <FeatureItem icon={Users} text="Shared watchlists with friends" />
              <FeatureItem icon={Flame} text="Advanced charting & technical analysis" />
              <FeatureItem icon={Bell} text="Smart price alerts" />
              <FeatureItem icon={DollarSign} text="Performance tracking & P&L" />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <p className="text-yellow-300/60 text-sm">
            Track performance. Share insights. Print tendies.
          </p>
          <div className="flex gap-1 items-end">
            <GoldBar size="lg" />
            <GoldBar size="md" />
            <GoldBar size="sm" />
          </div>
        </div>

        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-600 via-amber-400 to-yellow-600" />
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-900">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <PepeFrog className="w-12 h-12" />
              <div>
                <h1 className="text-2xl font-black">
                  <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                    FD
                  </span>
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    {' '}Central
                  </span>
                </h1>
              </div>
            </div>
            <p className="text-yellow-400/70 text-xs tracking-widest">TENDIES OR BUST</p>
          </div>

          <div className="card p-8 border-yellow-600/20">
            <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
            <p className="text-gray-400 mb-6">Sign in to continue to your dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-gray-900 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:via-amber-300 hover:to-yellow-400 transition-all duration-200 shadow-lg shadow-yellow-600/20 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-700 text-center">
              <p className="text-gray-400">
                New here?{' '}
                <Link to="/register" className="text-yellow-400 hover:text-yellow-300 font-medium">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-yellow-600/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-yellow-400" />
      </div>
      <span className="text-gray-300">{text}</span>
    </div>
  );
}

function GoldBar({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 'h-6', md: 'h-10', lg: 'h-14' };
  const widths = { sm: 'w-4', md: 'w-5', lg: 'w-6' };

  return (
    <div
      className={`${heights[size]} ${widths[size]} rounded-sm relative overflow-hidden`}
      style={{
        background: 'linear-gradient(135deg, #ffd700 0%, #ffed4a 25%, #f59e0b 50%, #ffd700 75%, #b8860b 100%)',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-evenly px-0.5">
        <div className="h-px bg-amber-700/30" />
        <div className="h-px bg-amber-700/30" />
        <div className="h-px bg-amber-700/30" />
      </div>
    </div>
  );
}

function PepeFrog({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <ellipse cx="50" cy="55" rx="40" ry="35" fill="#6b8e23" />
      <ellipse cx="50" cy="55" rx="38" ry="33" fill="#7cb342" />
      <ellipse cx="32" cy="40" rx="16" ry="18" fill="white" />
      <ellipse cx="68" cy="40" rx="16" ry="18" fill="white" />
      <ellipse cx="35" cy="42" rx="8" ry="10" fill="#2d2d2d" />
      <ellipse cx="65" cy="42" rx="8" ry="10" fill="#2d2d2d" />
      <circle cx="38" cy="38" r="3" fill="white" />
      <circle cx="68" cy="38" r="3" fill="white" />
      <path d="M20 28 Q32 22 44 30" stroke="#4a5d23" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M56 30 Q68 22 80 28" stroke="#4a5d23" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M25 68 Q50 85 75 68" stroke="#4a5d23" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M30 62 Q50 70 70 62" stroke="#4a5d23" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="58" rx="8" ry="5" fill="#ff9999" opacity="0.4" />
      <ellipse cx="78" cy="58" rx="8" ry="5" fill="#ff9999" opacity="0.4" />
      <path d="M25 20 L30 5 L40 15 L50 0 L60 15 L70 5 L75 20 Z" fill="url(#goldGradientLogin)" />
      <defs>
        <linearGradient id="goldGradientLogin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ffed4a" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
    </svg>
  );
}
