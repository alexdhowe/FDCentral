# FDCentral - Stock & Options Trading Hub

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

A real-time stock and options watchlist, alerts, and analysis platform with AI-powered recommendations and social trading features.

## Features

### Real-Time Market Data
- Live stock quotes via Yahoo Finance API (free)
- Interactive candlestick and line charts with TradingView Lightweight Charts
- Market overview with major indices (S&P 500, Dow, Nasdaq, VIX)
- Stock search with autocomplete
- Company info and key statistics

### Options Analysis
- Full options chain viewer (calls & puts)
- Greeks calculator (Delta, Gamma, Theta, Vega, Rho)
- Interactive P&L visualization
- Unusual options activity detection

### AI-Powered Recommendations
- Technical analysis engine (RSI, MACD, Moving Averages)
- Automatic target price and stop loss calculation
- Options play recommendations
- Performance tracking with win rate analytics
- Community reactions (bullish/bearish/following)

### Watchlists & Alerts
- Multiple watchlists with sharing capabilities
- Price alerts (above/below thresholds)
- Percent change alerts
- Volume spike detection
- Real-time notifications via WebSocket

### Social Features
- Real-time chat rooms
- Share charts and recommendations
- Typing indicators
- Message history

## Tech Stack

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Real-time**: Socket.io
- **Data**: yahoo-finance2

### Frontend
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: TradingView Lightweight Charts + Recharts
- **State**: Zustand
- **Routing**: React Router

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/FDCentral.git
cd FDCentral
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your database URL and JWT secret
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Start development servers:
```bash
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Deployment on Render

### One-Click Deploy
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Deployment

1. Create a new PostgreSQL database on Render

2. Create a Web Service for the API:
   - Build Command: `npm install && npm run build:server`
   - Start Command: `npm run start`
   - Environment Variables:
     - `NODE_ENV`: production
     - `DATABASE_URL`: (from your Render PostgreSQL)
     - `JWT_SECRET`: (generate a secure random string)
     - `CLIENT_URL`: (your frontend URL)

3. Create a Static Site for the frontend:
   - Build Command: `npm install && npm run build:client`
   - Publish Directory: `client/dist`

4. Run database migrations:
```bash
npm run db:migrate
```

## Project Structure

```
FDCentral/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand stores
│   │   └── lib/            # Utilities
│   └── public/             # Static assets
│
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API routes
│       ├── services/       # Business logic
│       ├── socket/         # WebSocket handlers
│       ├── jobs/           # Scheduled tasks
│       ├── middleware/     # Express middleware
│       └── db/             # Database config
│
├── render.yaml             # Render deployment config
└── package.json            # Monorepo root
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Stocks
- `GET /api/stocks/quote/:symbol` - Get quote
- `POST /api/stocks/quotes` - Get multiple quotes
- `GET /api/stocks/history/:symbol` - Get price history
- `GET /api/stocks/search` - Search symbols
- `GET /api/stocks/trending` - Get trending stocks
- `GET /api/stocks/market-overview` - Get market indices

### Options
- `GET /api/options/chain/:symbol` - Get options chain
- `POST /api/options/calculate-greeks` - Calculate Greeks
- `POST /api/options/calculate-pnl` - Calculate P&L

### Watchlists
- `GET /api/watchlist` - Get all watchlists
- `POST /api/watchlist` - Create watchlist
- `GET /api/watchlist/:id/items` - Get items
- `POST /api/watchlist/:id/items` - Add item
- `DELETE /api/watchlist/:id/items/:itemId` - Remove item

### Recommendations
- `GET /api/recommendations` - Get all recommendations
- `POST /api/recommendations/generate/:symbol` - Generate AI pick
- `GET /api/recommendations/performance` - Get stats
- `POST /api/recommendations/:id/react` - React to pick

### Alerts
- `GET /api/alerts` - Get all alerts
- `POST /api/alerts` - Create alert
- `DELETE /api/alerts/:id` - Delete alert
- `POST /api/alerts/:id/reset` - Reset triggered alert

### Chat
- `GET /api/chat/messages` - Get messages
- `POST /api/chat/messages` - Send message
- `GET /api/chat/rooms` - Get rooms

## WebSocket Events

### Client -> Server
- `join_room` - Join chat room
- `leave_room` - Leave chat room
- `send_message` - Send chat message
- `typing` - Typing indicator
- `subscribe_stock` - Subscribe to stock updates
- `unsubscribe_stock` - Unsubscribe from stock updates

### Server -> Client
- `new_message` - New chat message
- `user_typing` - User typing indicator
- `stock_update` - Real-time stock quote
- `alert_triggered` - Price alert notification
- `recommendation_update` - Recommendation status change

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- [Yahoo Finance](https://finance.yahoo.com/) for market data
- [TradingView](https://www.tradingview.com/) for Lightweight Charts
- [Render](https://render.com/) for hosting
