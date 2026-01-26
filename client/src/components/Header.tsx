import { TrendingUp, Flame } from 'lucide-react';

export default function Header() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-yellow-600/30">
      {/* Animated gold sparkles background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      <div className="relative flex items-center justify-center gap-4 py-4 px-6">
        {/* Left Gold Bars */}
        <div className="flex gap-1 items-end">
          <GoldBar size="sm" />
          <GoldBar size="md" />
          <GoldBar size="lg" />
        </div>

        {/* Pepe */}
        <div className="relative">
          <PepeFrog className="w-16 h-16 md:w-20 md:h-20" />
          <div className="absolute -top-1 -right-1">
            <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
          </div>
        </div>

        {/* Main Title */}
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
              FD
            </span>
            <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
              {' '}Central
            </span>
          </h1>
          <p className="text-xs md:text-sm text-yellow-400/80 font-medium tracking-widest mt-1">
            TENDIES OR BUST
          </p>
        </div>

        {/* Pepe */}
        <div className="relative">
          <PepeFrog className="w-16 h-16 md:w-20 md:h-20 transform scale-x-[-1]" />
          <div className="absolute -top-1 -left-1">
            <TrendingUp className="w-5 h-5 text-green-500 animate-bounce" />
          </div>
        </div>

        {/* Right Gold Bars */}
        <div className="flex gap-1 items-end">
          <GoldBar size="lg" />
          <GoldBar size="md" />
          <GoldBar size="sm" />
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
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
      {/* Shine effect */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)',
        }}
      />
      {/* Horizontal lines for bar texture */}
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
      {/* Face base - green */}
      <ellipse cx="50" cy="55" rx="40" ry="35" fill="#6b8e23" />
      <ellipse cx="50" cy="55" rx="38" ry="33" fill="#7cb342" />

      {/* Eyes - white with pupils */}
      <ellipse cx="32" cy="40" rx="16" ry="18" fill="white" />
      <ellipse cx="68" cy="40" rx="16" ry="18" fill="white" />

      {/* Pupils */}
      <ellipse cx="35" cy="42" rx="8" ry="10" fill="#2d2d2d" />
      <ellipse cx="65" cy="42" rx="8" ry="10" fill="#2d2d2d" />

      {/* Eye shine */}
      <circle cx="38" cy="38" r="3" fill="white" />
      <circle cx="68" cy="38" r="3" fill="white" />

      {/* Eyebrows - smug look */}
      <path d="M20 28 Q32 22 44 30" stroke="#4a5d23" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M56 30 Q68 22 80 28" stroke="#4a5d23" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Smug smile */}
      <path d="M25 68 Q50 85 75 68" stroke="#4a5d23" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Mouth line */}
      <path d="M30 62 Q50 70 70 62" stroke="#4a5d23" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Blush */}
      <ellipse cx="22" cy="58" rx="8" ry="5" fill="#ff9999" opacity="0.4" />
      <ellipse cx="78" cy="58" rx="8" ry="5" fill="#ff9999" opacity="0.4" />

      {/* Crown/hat - golden */}
      <path d="M25 20 L30 5 L40 15 L50 0 L60 15 L70 5 L75 20 Z" fill="url(#goldGradient)" />
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ffed4a" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
    </svg>
  );
}
