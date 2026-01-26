import cron from 'node-cron';
import { Server } from 'socket.io';
import { query } from '../db/index.js';
import { getQuote, getMultipleQuotes } from '../services/stockData.js';
import { emitToUser, emitStockUpdate } from '../socket/index.js';

export function startScheduledJobs(io: Server) {
  console.log('📅 Starting scheduled jobs...');

  // Check price alerts every minute during market hours
  cron.schedule('* * * * 1-5', async () => {
    await checkPriceAlerts(io);
  });

  // Update recommendation status every 5 minutes
  cron.schedule('*/5 * * * 1-5', async () => {
    await updateRecommendationStatus(io);
  });

  // Broadcast live quotes to subscribed clients every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    await broadcastLiveQuotes(io);
  });

  console.log('✅ Scheduled jobs started');
}

async function checkPriceAlerts(io: Server) {
  try {
    // Get all active alerts
    const alerts = await query(
      `SELECT a.*, u.username, u.email
       FROM alerts a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.is_active = true AND a.is_triggered = false`
    );

    if (alerts.rows.length === 0) return;

    // Group alerts by symbol
    const alertsBySymbol = new Map<string, typeof alerts.rows>();
    for (const alert of alerts.rows) {
      const existing = alertsBySymbol.get(alert.symbol) || [];
      existing.push(alert);
      alertsBySymbol.set(alert.symbol, existing);
    }

    // Fetch quotes for all symbols
    const symbols = Array.from(alertsBySymbol.keys());
    const quotes = await getMultipleQuotes(symbols);

    // Check each alert
    for (const [symbol, symbolAlerts] of alertsBySymbol) {
      const quote = quotes.get(symbol);
      if (!quote) continue;

      for (const alert of symbolAlerts) {
        let triggered = false;

        switch (alert.alert_type) {
          case 'price_above':
            triggered = quote.price >= alert.trigger_value;
            break;
          case 'price_below':
            triggered = quote.price <= alert.trigger_value;
            break;
          case 'percent_change_up':
            triggered = quote.changePercent >= alert.trigger_value;
            break;
          case 'percent_change_down':
            triggered = quote.changePercent <= -alert.trigger_value;
            break;
          case 'volume_spike':
            // Volume spike would require historical comparison
            // Simplified: trigger if volume > trigger_value
            triggered = quote.volume >= alert.trigger_value;
            break;
        }

        if (triggered) {
          // Mark alert as triggered
          await query(
            `UPDATE alerts SET is_triggered = true, triggered_at = NOW() WHERE id = $1`,
            [alert.id]
          );

          // Send notification via socket
          emitToUser(io, alert.user_id, 'alert_triggered', {
            alertId: alert.id,
            symbol: alert.symbol,
            alertType: alert.alert_type,
            triggerValue: alert.trigger_value,
            currentPrice: quote.price,
            currentChange: quote.changePercent,
            message: getAlertMessage(alert, quote)
          });

          console.log(`🔔 Alert triggered: ${alert.symbol} ${alert.alert_type} at ${quote.price}`);
        }
      }
    }
  } catch (error) {
    console.error('Check alerts error:', error);
  }
}

async function updateRecommendationStatus(io: Server) {
  try {
    // Get active recommendations
    const recs = await query(
      `SELECT * FROM recommendations WHERE status = 'active'`
    );

    if (recs.rows.length === 0) return;

    // Get current prices
    const symbols = [...new Set(recs.rows.map(r => r.symbol))];
    const quotes = await getMultipleQuotes(symbols);

    for (const rec of recs.rows) {
      const quote = quotes.get(rec.symbol);
      if (!quote) continue;

      let newStatus = null;
      let exitPrice = quote.price;

      // Check if target or stop hit
      if (rec.recommendation_type === 'buy' || rec.recommendation_type === 'options_call') {
        if (rec.target_price && quote.price >= rec.target_price) {
          newStatus = 'hit_target';
        } else if (rec.stop_loss && quote.price <= rec.stop_loss) {
          newStatus = 'hit_stop';
        }
      } else if (rec.recommendation_type === 'sell' || rec.recommendation_type === 'options_put') {
        if (rec.target_price && quote.price <= rec.target_price) {
          newStatus = 'hit_target';
        } else if (rec.stop_loss && quote.price >= rec.stop_loss) {
          newStatus = 'hit_stop';
        }
      }

      if (newStatus) {
        const pnlPercent = ((exitPrice - rec.entry_price) / rec.entry_price) * 100;
        const pnlAmount = exitPrice - rec.entry_price;

        await query(
          `UPDATE recommendations
           SET status = $1, exit_price = $2, profit_loss_percent = $3, profit_loss_amount = $4, closed_at = NOW()
           WHERE id = $5`,
          [newStatus, exitPrice, pnlPercent, pnlAmount, rec.id]
        );

        // Notify followers
        const followers = await query(
          `SELECT user_id FROM recommendation_reactions
           WHERE recommendation_id = $1 AND reaction_type = 'following'`,
          [rec.id]
        );

        for (const follower of followers.rows) {
          emitToUser(io, follower.user_id, 'recommendation_update', {
            recommendationId: rec.id,
            symbol: rec.symbol,
            status: newStatus,
            entryPrice: rec.entry_price,
            exitPrice,
            pnlPercent,
            message: `${rec.symbol} recommendation ${newStatus === 'hit_target' ? '✅ hit target!' : '❌ hit stop loss'} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`
          });
        }

        console.log(`📊 Recommendation ${rec.symbol} ${newStatus}: ${pnlPercent.toFixed(2)}%`);
      }
    }
  } catch (error) {
    console.error('Update recommendations error:', error);
  }
}

async function broadcastLiveQuotes(io: Server) {
  try {
    // Get all symbols being watched
    const rooms = io.sockets.adapter.rooms;
    const stockRooms = Array.from(rooms.keys()).filter(r => r.startsWith('stock:'));

    if (stockRooms.length === 0) return;

    const symbols = stockRooms.map(r => r.replace('stock:', ''));
    const quotes = await getMultipleQuotes(symbols);

    for (const [symbol, quote] of quotes) {
      emitStockUpdate(io, symbol, quote);
    }
  } catch (error) {
    console.error('Broadcast quotes error:', error);
  }
}

function getAlertMessage(alert: any, quote: any): string {
  switch (alert.alert_type) {
    case 'price_above':
      return `${alert.symbol} is now above $${alert.trigger_value} (current: $${quote.price.toFixed(2)})`;
    case 'price_below':
      return `${alert.symbol} is now below $${alert.trigger_value} (current: $${quote.price.toFixed(2)})`;
    case 'percent_change_up':
      return `${alert.symbol} is up ${quote.changePercent.toFixed(2)}% today!`;
    case 'percent_change_down':
      return `${alert.symbol} is down ${Math.abs(quote.changePercent).toFixed(2)}% today!`;
    case 'volume_spike':
      return `${alert.symbol} volume spike detected: ${(quote.volume / 1000000).toFixed(2)}M`;
    default:
      return `Alert triggered for ${alert.symbol}`;
  }
}
