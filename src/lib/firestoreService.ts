
import type { Trade, BotLog, BotConfig } from '@/types';
import { db } from './firebase'; 
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';

export async function getTradeHistory(count: number = 20): Promise<Trade[]> {
  if (!db) {
    console.warn("Firestore is not initialized. Returning empty trade history.");
    return Promise.resolve([]);
  }
  try {
    const tradesRef = collection(db, 'trades');
    const q = query(tradesRef, orderBy('timestampOpen', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        // Ensure timestamps are Date objects if they are Firestore Timestamps
        timestampOpen: data.timestampOpen?.toDate ? data.timestampOpen.toDate() : new Date(data.timestampOpen),
        timestampClose: data.timestampClose?.toDate ? data.timestampClose.toDate() : data.timestampClose ? new Date(data.timestampClose) : undefined,
      } as Trade;
    });
  } catch (error) {
    console.error("Error fetching trade history from Firestore:", error);
    return Promise.resolve([]);
  }
}

export async function getBotLogs(count: number = 50): Promise<BotLog[]> {
  if (!db) {
    console.warn("Firestore is not initialized. Returning empty bot logs.");
    return Promise.resolve([]);
  }
  try {
    const logsRef = collection(db, 'bot_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
      } as BotLog;
    });
  } catch (error) {
    console.error("Error fetching bot logs from Firestore:", error);
    return Promise.resolve([]);
  }
}

export async function getBotConfiguration(): Promise<BotConfig> {
  if (!db) {
    console.warn("Firestore is not initialized. Returning empty bot configuration.");
    return Promise.resolve({});
  }
  try {
    const configRef = doc(db, 'bot_config', 'main'); 
    const docSnap = await getDoc(configRef);
    if (docSnap.exists()) {
      return docSnap.data() as BotConfig;
    } else {
      console.warn("Bot configuration not found in Firestore.");
      return {}; 
    }
  } catch (error) {
    console.error("Error fetching bot configuration from Firestore:", error);
    return Promise.resolve({});
  }
}

export async function getKeyMetrics(): Promise<{ totalPnl: number; winRate: number; totalTrades: number }> {
  const trades = await getTradeHistory(1000); 
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
