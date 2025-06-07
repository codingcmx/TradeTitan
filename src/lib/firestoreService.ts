import type { Trade, BotLog, BotConfig } from '@/types';
// import { db } from './firebase'; // Uncomment when Firebase is fully set up
// import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore'; // Uncomment for Firebase

// MOCK DATA - Replace with actual Firebase calls
const mockTradeHistory: Trade[] = [
  { id: 'th1', symbol: 'BTC/USDT', type: 'BUY', entryPrice: 58000, exitPrice: 59500, quantity: 0.1, pnl: 150, status: 'CLOSED_WIN', timestampOpen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), timestampClose: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 30), strategy: 'EMA Cross' },
  { id: 'th2', symbol: 'ETH/USDT', type: 'SELL', entryPrice: 3100, exitPrice: 3050, quantity: 1, pnl: 50, status: 'CLOSED_WIN', timestampOpen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), timestampClose: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1 + 1000 * 60 * 15), strategy: 'ATR Breakout' },
  { id: 'th3', symbol: 'ADA/USDT', type: 'BUY', entryPrice: 1.5, exitPrice: 1.4, quantity: 1000, pnl: -100, status: 'CLOSED_LOSS', timestampOpen: new Date(Date.now() - 1000 * 60 * 60 * 12), timestampClose: new Date(Date.now() - 1000 * 60 * 60 * 12 + 1000 * 60 * 60), strategy: 'EMA Cross' },
];

const mockBotLogs: BotLog[] = [
  { id: 'log1', timestamp: new Date(Date.now() - 1000 * 60 * 5), message: 'Bot started successfully.', level: 'INFO' },
  { id: 'log2', timestamp: new Date(Date.now() - 1000 * 60 * 3), message: 'Checked BTC/USDT, no signal.', level: 'INFO' },
  { id: 'log3', timestamp: new Date(Date.now() - 1000 * 60 * 1), message: 'Attempted trade on ETH/USDT, insufficient balance.', level: 'WARN', tradeId: 'rt2' },
];

const mockBotConfig: BotConfig = {
  botName: "Ultimate 3 EMA + ATR Strategy Bot",
  version: "1.0.2",
  targetSymbols: ['BTC/USDT', 'ETH/USDT', 'ADA/USDT'],
  emaShortPeriod: 9,
  emaMediumPeriod: 21,
  emaLongPeriod: 55,
  atrPeriod: 14,
  stopLossMultiplier: 2, // 2x ATR
  takeProfitMultiplier: 3, // 3x ATR
  tradingEnabled: true,
  telegramChatId: "YOUR_TELEGRAM_CHAT_ID", // Placeholder
};

export async function getTradeHistory(count: number = 20): Promise<Trade[]> {
  // TODO: Replace with actual Firebase call
  // if (!db) return Promise.resolve([]);
  // const tradesRef = collection(db, 'trades');
  // const q = query(tradesRef, orderBy('timestampOpen', 'desc'), limit(count));
  // const snapshot = await getDocs(q);
  // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
  return Promise.resolve(mockTradeHistory.slice(0, count));
}

export async function getBotLogs(count: number = 50): Promise<BotLog[]> {
  // TODO: Replace with actual Firebase call
  // if (!db) return Promise.resolve([]);
  // const logsRef = collection(db, 'bot_logs');
  // const q = query(logsRef, orderBy('timestamp', 'desc'), limit(count));
  // const snapshot = await getDocs(q);
  // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BotLog));
  return Promise.resolve(mockBotLogs.slice(0, count));
}

export async function getBotConfiguration(): Promise<BotConfig> {
  // TODO: Replace with actual Firebase call
  // if (!db) return Promise.resolve({});
  // const configRef = doc(db, 'bot_config', 'main'); // Assuming single config doc
  // const docSnap = await getDoc(configRef);
  // if (docSnap.exists()) {
  //   return docSnap.data() as BotConfig;
  // } else {
  //   console.warn("Bot configuration not found in Firestore.");
  //   return {}; // Return empty or default config
  // }
  return Promise.resolve(mockBotConfig);
}

// Example of how to get key metrics (derived from trades)
export async function getKeyMetrics(): Promise<{ totalPnl: number; winRate: number; totalTrades: number }> {
  const trades = await getTradeHistory(1000); // Fetch a larger set for metrics
  const closedTrades = trades.filter(t => t.status !== 'OPEN' && t.pnl !== undefined);
  const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
  return {
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    totalTrades: trades.length,
  };
}
