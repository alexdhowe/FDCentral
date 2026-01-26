import { query } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Watchlist members (for shared watchlists)
CREATE TABLE IF NOT EXISTS watchlist_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(watchlist_id, user_id)
);

-- Watchlist items (stocks/options being watched)
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  item_type VARCHAR(20) DEFAULT 'stock', -- 'stock' or 'option'
  option_details JSONB, -- strike, expiry, type (call/put) for options
  notes TEXT,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(watchlist_id, symbol, item_type, option_details)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'price_above', 'price_below', 'percent_change', 'volume_spike'
  trigger_value DECIMAL(20, 4) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_triggered BOOLEAN DEFAULT false,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL, -- 'buy', 'sell', 'hold', 'options_call', 'options_put'
  entry_price DECIMAL(20, 4) NOT NULL,
  target_price DECIMAL(20, 4),
  stop_loss DECIMAL(20, 4),
  option_details JSONB, -- For options: strike, expiry, premium, etc.
  reasoning TEXT NOT NULL,
  confidence_score DECIMAL(5, 2), -- 0-100
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'hit_target', 'hit_stop', 'expired', 'closed'
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  exit_price DECIMAL(20, 4),
  profit_loss_percent DECIMAL(10, 4),
  profit_loss_amount DECIMAL(20, 4)
);

-- Recommendation votes/reactions
CREATE TABLE IF NOT EXISTS recommendation_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL, -- 'bullish', 'bearish', 'following'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(recommendation_id, user_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room VARCHAR(100) DEFAULT 'general',
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'chart_share', 'recommendation_share'
  metadata JSONB, -- For shared content
  created_at TIMESTAMP DEFAULT NOW()
);

-- Price history cache (for charting)
CREATE TABLE IF NOT EXISTS price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(20) NOT NULL, -- '1d', '1w', '1m', '3m', '1y', '5y'
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, timeframe)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol ON watchlist_items(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_user_active ON alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_symbol ON recommendations(symbol);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room, created_at);
CREATE INDEX IF NOT EXISTS idx_price_cache_symbol ON price_cache(symbol, timeframe);
`;

async function migrate() {
  console.log('🔄 Running database migrations...');
  try {
    await query(migrations);
    console.log('✅ Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
