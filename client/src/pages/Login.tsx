import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Mail, Lock, ArrowRight, TrendingUp, BarChart3, Shield, Zap } from 'lucide-react';
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
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-surface-950">
        {/* Background gradient */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-500/5 via-transparent to-accent-600/5" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-600/5 rounded-full blur-[80px]" />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(251, 191, 36, 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(251, 191, 36, 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/20">
                <TrendingUp className="w-6 h-6 text-surface-950" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  <span className="text-gradient">FD Central</span>
                </h1>
                <p className="text-xs text-surface-500 font-medium tracking-widest uppercase">Trading Intelligence</p>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="max-w-lg">
            <h2 className="text-4xl font-bold text-surface-100 leading-tight mb-6">
              Your competitive edge in the
              <span className="text-gradient"> markets</span>
            </h2>
            <p className="text-lg text-surface-400 mb-10 leading-relaxed">
              AI-powered technical analysis, real-time alerts, and intelligent trade recommendations
              designed to help you make better decisions.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              <FeatureCard
                icon={BarChart3}
                title="Technical Analysis"
                description="RSI, MACD, Bollinger Bands & more"
              />
              <FeatureCard
                icon={Zap}
                title="AI Recommendations"
                description="Data-driven trade signals"
              />
              <FeatureCard
                icon={TrendingUp}
                title="Real-Time Data"
                description="Live quotes & market updates"
              />
              <FeatureCard
                icon={Shield}
                title="Risk Management"
                description="Smart stop-loss & targets"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-surface-600 text-sm">
              Trusted by traders worldwide
            </p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-surface-800 border-2 border-surface-950 flex items-center justify-center text-xs font-bold text-surface-400"
                  >
                    {['JD', 'MK', 'AS', 'RW'][i]}
                  </div>
                ))}
              </div>
              <span className="text-sm text-surface-500">+2.4k active users</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-900">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-surface-950" />
            </div>
            <span className="text-xl font-bold text-gradient">FD Central</span>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl font-bold text-surface-100 mb-2">Welcome back</h2>
            <p className="text-surface-400">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-12"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-12"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base group"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-surface-950/30 border-t-surface-950 rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>
          </form>

          <div className="divider my-8" />

          <p className="text-center text-surface-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-accent-400 hover:text-accent-300 font-semibold transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface-900/50 border border-surface-800/50 backdrop-blur-sm">
      <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-accent-400" />
      </div>
      <h3 className="font-semibold text-surface-200 mb-1">{title}</h3>
      <p className="text-sm text-surface-500">{description}</p>
    </div>
  );
}
