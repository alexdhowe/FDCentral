import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { TrendingUp, Mail, Lock } from 'lucide-react';
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
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 to-gray-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-10 h-10 text-primary-400" />
            <h1 className="text-3xl font-bold text-white">FDCentral</h1>
          </div>
          <p className="text-primary-200 mt-2">Stock & Options Trading Hub</p>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Your Ultimate Trading Command Center
            </h2>
            <ul className="space-y-3 text-primary-200">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full"></span>
                Real-time stock & options data
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full"></span>
                AI-powered trade recommendations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full"></span>
                Shared watchlists with friends
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full"></span>
                Advanced charting & analysis
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full"></span>
                Real-time chat & collaboration
              </li>
            </ul>
          </div>
        </div>

        <p className="text-primary-300 text-sm">
          Track performance. Share insights. Make better trades.
        </p>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <TrendingUp className="w-8 h-8 text-primary-400" />
            <h1 className="text-2xl font-bold">FDCentral</h1>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
          <p className="text-gray-400 mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
