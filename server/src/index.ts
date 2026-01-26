import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

import { authRouter } from './routes/auth';
import { watchlistRouter } from './routes/watchlist';
import { stocksRouter } from './routes/stocks';
import { optionsRouter } from './routes/options';
import { recommendationsRouter } from './routes/recommendations';
import { alertsRouter } from './routes/alerts';
import { chatRouter } from './routes/chat';
import { setupSocketHandlers } from './socket';
import { startScheduledJobs } from './jobs';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/watchlist', authenticateToken, watchlistRouter);
app.use('/api/stocks', authenticateToken, stocksRouter);
app.use('/api/options', authenticateToken, optionsRouter);
app.use('/api/recommendations', authenticateToken, recommendationsRouter);
app.use('/api/alerts', authenticateToken, alertsRouter);
app.use('/api/chat', authenticateToken, chatRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 FDCentral server running on port ${PORT}`);
  console.log(`📈 Ready to track some stonks!`);
});

export { io };
