import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getOptionChain, getQuote } from '../services/stockData.js';

const router = Router();

// Get option chain for symbol
router.get('/chain/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const { expiration } = req.query;

    const expirationDate = expiration ? new Date(expiration as string) : undefined;
    const chain = await getOptionChain(symbol.toUpperCase(), expirationDate);

    if (!chain) {
      return res.status(404).json({ error: 'Options not found for this symbol' });
    }

    res.json(chain);
  } catch (error) {
    console.error('Get options chain error:', error);
    res.status(500).json({ error: 'Failed to get options chain' });
  }
});

// Calculate options Greeks (simplified Black-Scholes)
router.post('/calculate-greeks', async (req: AuthRequest, res: Response) => {
  try {
    const {
      spotPrice,
      strikePrice,
      daysToExpiry,
      volatility,
      riskFreeRate = 0.05,
      optionType = 'call'
    } = req.body;

    if (!spotPrice || !strikePrice || !daysToExpiry || !volatility) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const T = daysToExpiry / 365;
    const S = spotPrice;
    const K = strikePrice;
    const r = riskFreeRate;
    const sigma = volatility;

    // Standard normal CDF approximation
    const normalCDF = (x: number): number => {
      const a1 = 0.254829592;
      const a2 = -0.284496736;
      const a3 = 1.421413741;
      const a4 = -1.453152027;
      const a5 = 1.061405429;
      const p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1.0 + sign * y);
    };

    // Standard normal PDF
    const normalPDF = (x: number): number => {
      return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    };

    // d1 and d2
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    let delta, gamma, theta, vega, rho, price;

    if (optionType === 'call') {
      delta = normalCDF(d1);
      price = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
      theta = (-(S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365;
      rho = K * T * Math.exp(-r * T) * normalCDF(d2) / 100;
    } else {
      delta = normalCDF(d1) - 1;
      price = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
      theta = (-(S * normalPDF(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
      rho = -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;
    }

    gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T));
    vega = S * normalPDF(d1) * Math.sqrt(T) / 100;

    res.json({
      price: Math.round(price * 100) / 100,
      delta: Math.round(delta * 1000) / 1000,
      gamma: Math.round(gamma * 10000) / 10000,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
      rho: Math.round(rho * 100) / 100
    });
  } catch (error) {
    console.error('Calculate Greeks error:', error);
    res.status(500).json({ error: 'Failed to calculate Greeks' });
  }
});

// Get unusual options activity (simplified version)
router.get('/unusual-activity/:symbol', async (req: AuthRequest, res: Response) => {
  try {
    const { symbol } = req.params;
    const chain = await getOptionChain(symbol.toUpperCase());
    const quote = await getQuote(symbol.toUpperCase());

    if (!chain || !quote) {
      return res.status(404).json({ error: 'Data not found' });
    }

    // Find options with high volume relative to open interest
    const allOptions = [...chain.calls, ...chain.puts];
    const unusual = allOptions
      .filter(opt => opt.openInterest > 0 && opt.volume > 0)
      .map(opt => ({
        ...opt,
        volumeOIRatio: opt.volume / opt.openInterest,
        premium: opt.lastPrice * 100, // Per contract
        totalVolumePremium: opt.volume * opt.lastPrice * 100
      }))
      .filter(opt => opt.volumeOIRatio > 1.5) // Volume > 1.5x open interest
      .sort((a, b) => b.totalVolumePremium - a.totalVolumePremium)
      .slice(0, 10);

    res.json({
      symbol,
      currentPrice: quote.price,
      unusualActivity: unusual
    });
  } catch (error) {
    console.error('Unusual activity error:', error);
    res.status(500).json({ error: 'Failed to get unusual activity' });
  }
});

// Calculate profit/loss for option position
router.post('/calculate-pnl', async (req: AuthRequest, res: Response) => {
  try {
    const {
      optionType,
      strikePrice,
      premium,
      quantity,
      currentPrice,
      position = 'long' // 'long' or 'short'
    } = req.body;

    const contractMultiplier = 100;
    const totalPremium = premium * quantity * contractMultiplier;

    // Calculate P&L at various price points
    const pricePoints: { stockPrice: number; pnl: number; percentReturn: number }[] = [];
    const range = strikePrice * 0.4; // 40% range
    const step = range / 20;

    for (let price = strikePrice - range; price <= strikePrice + range; price += step) {
      let intrinsicValue = 0;

      if (optionType === 'call') {
        intrinsicValue = Math.max(0, price - strikePrice);
      } else {
        intrinsicValue = Math.max(0, strikePrice - price);
      }

      let pnl;
      if (position === 'long') {
        pnl = (intrinsicValue - premium) * quantity * contractMultiplier;
      } else {
        pnl = (premium - intrinsicValue) * quantity * contractMultiplier;
      }

      pricePoints.push({
        stockPrice: Math.round(price * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        percentReturn: Math.round((pnl / totalPremium) * 10000) / 100
      });
    }

    // Calculate break-even
    let breakEven;
    if (optionType === 'call') {
      breakEven = position === 'long' ? strikePrice + premium : strikePrice + premium;
    } else {
      breakEven = position === 'long' ? strikePrice - premium : strikePrice - premium;
    }

    // Current P&L
    let currentIntrinsic = 0;
    if (optionType === 'call') {
      currentIntrinsic = Math.max(0, currentPrice - strikePrice);
    } else {
      currentIntrinsic = Math.max(0, strikePrice - currentPrice);
    }

    const currentPnL = position === 'long'
      ? (currentIntrinsic - premium) * quantity * contractMultiplier
      : (premium - currentIntrinsic) * quantity * contractMultiplier;

    res.json({
      breakEven,
      maxProfit: position === 'long'
        ? (optionType === 'call' ? 'Unlimited' : (strikePrice - premium) * quantity * contractMultiplier)
        : totalPremium,
      maxLoss: position === 'long'
        ? totalPremium
        : (optionType === 'call' ? 'Unlimited' : (strikePrice - premium) * quantity * contractMultiplier),
      currentPnL: Math.round(currentPnL * 100) / 100,
      pricePoints
    });
  } catch (error) {
    console.error('Calculate P&L error:', error);
    res.status(500).json({ error: 'Failed to calculate P&L' });
  }
});

export { router as optionsRouter };
