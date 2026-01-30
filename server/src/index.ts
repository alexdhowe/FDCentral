import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { authRouter } from './routes/auth.js';
import { watchlistRouter } from './routes/watchlist.js';
import { stocksRouter } from './routes/stocks.js';
import { optionsRouter } from './routes/options.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { alertsRouter } from './routes/alerts.js';
import { chatRouter } from './routes/chat.js';
import signalsRouter from './routes/signals.js';
import { setupSocketHandlers } from './socket/index.js';
import { startScheduledJobs } from './jobs/index.js';
import { authenticateToken } from './middleware/auth.js';
import { initializeSignalBot } from './services/signalBot.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow all origins for now (can restrict later)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const io = new Server(httpServer, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/watchlist', authenticateToken, watchlistRouter);
app.use('/api/stocks', authenticateToken, stocksRouter);
app.use('/api/options', authenticateToken, optionsRouter);
app.use('/api/recommendations', authenticateToken, recommendationsRouter);
app.use('/api/alerts', authenticateToken, alertsRouter);
app.use('/api/chat', authenticateToken, chatRouter);
app.use('/api/signals', authenticateToken, signalsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: '🐸 FD Central API - Tendies Incoming!'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Socket.io setup
setupSocketHandlers(io);

// Start scheduled jobs (price alerts, recommendation tracking)
startScheduledJobs(io);

// Initialize the Signal Bot (autonomous market analysis)
initializeSignalBot();

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log('');
  console.log('🐸💰 ================================== 💰🐸');
  console.log('');
  console.log('   FD CENTRAL - TENDIES OR BUST');
  console.log('');
  console.log(`   🚀 Server running on port ${PORT}`);
  console.log('   📈 Ready to print money!');
  console.log('');
  console.log('🐸💰 ================================== 💰🐸');
  console.log('');
});

export { io };
