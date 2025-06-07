
import type { Trade, BotLog, BotConfig, CustomStrategyDoc } from '@/types';
import { db } from './firebase'; 
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';

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
      const data = docSnap.data();
      // Ensure targetSymbols is always an array, even if stored as a string
      if (data.targetSymbols && typeof data.targetSymbols === 'string') {
        data.targetSymbols = data.targetSymbols.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (!Array.isArray(data.targetSymbols)) {
        data.targetSymbols = [];
      }
      return data as BotConfig;
    } else {
      console.warn("Bot configuration not found in Firestore. Returning default empty config.");
      return { targetSymbols: [] }; // Return with empty array for targetSymbols
    }
  } catch (error) {
    console.error("Error fetching bot configuration from Firestore:", error);
    return Promise.resolve({ targetSymbols: [] });
  }
}

export async function updateBotConfiguration(newConfig: Partial<BotConfig>): Promise<{success: boolean; message?: string}> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot update bot configuration.");
    return { success: false, message: "Firestore is not initialized." };
  }
  try {
    const configRef = doc(db, 'bot_config', 'main');
    // Fetch existing config to merge, or set new if it doesn't exist
    const currentDoc = await getDoc(configRef);
    const currentConfig = currentDoc.exists() ? currentDoc.data() : {};
    
    const updatedConfig = { ...currentConfig, ...newConfig };

    // Ensure specific fields are numbers if they are provided
    const numericFields: (keyof BotConfig)[] = ['emaShortPeriod', 'emaMediumPeriod', 'emaLongPeriod', 'atrPeriod', 'stopLossMultiplier', 'takeProfitMultiplier'];
    for (const field of numericFields) {
      if (updatedConfig[field] !== undefined && updatedConfig[field] !== null && updatedConfig[field] !== '') {
        const numValue = parseFloat(String(updatedConfig[field]));
        if (!isNaN(numValue)) {
          updatedConfig[field] = numValue;
        } else {
          delete updatedConfig[field]; // Remove if it's not a valid number
        }
      } else if (updatedConfig[field] === '' || updatedConfig[field] === null) {
         delete updatedConfig[field]; // Remove if empty or null
      }
    }
    
    // Ensure targetSymbols is an array of strings
    if (newConfig.targetSymbols && typeof newConfig.targetSymbols === 'string') {
      updatedConfig.targetSymbols = newConfig.targetSymbols.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(newConfig.targetSymbols)) {
      updatedConfig.targetSymbols = newConfig.targetSymbols.map(s => String(s).trim()).filter(Boolean);
    }


    await setDoc(configRef, updatedConfig, { merge: true });
    return { success: true, message: "Configuration updated successfully." };
  } catch (error: any) {
    console.error("Error updating bot configuration in Firestore:", error);
    return { success: false, message: `Failed to update configuration: ${error.message}` };
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

// Functions for Custom Strategy Document
export async function getCustomStrategyDoc(): Promise<CustomStrategyDoc> {
  if (!db) {
    console.warn("Firestore is not initialized. Returning empty custom strategy document.");
    return Promise.resolve({ pineScript: '', explanation: '' });
  }
  try {
    const docRef = doc(db, 'custom_strategy_doc', 'main');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as CustomStrategyDoc;
    } else {
      return { pineScript: '', explanation: '' }; // Default if not found
    }
  } catch (error) {
    console.error("Error fetching custom strategy document from Firestore:", error);
    return Promise.resolve({ pineScript: '', explanation: '' });
  }
}

export async function updateCustomStrategyDoc(docData: CustomStrategyDoc): Promise<{success: boolean; message?: string}> {
  if (!db) {
    console.error("Firestore is not initialized. Cannot update custom strategy document.");
    return { success: false, message: "Firestore is not initialized." };
  }
  try {
    const docRef = doc(db, 'custom_strategy_doc', 'main');
    await setDoc(docRef, docData, { merge: true });
    return { success: true, message: "Custom strategy document updated successfully." };
  } catch (error: any) {
    console.error("Error updating custom strategy document in Firestore:", error);
    return { success: false, message: `Failed to update custom strategy document: ${error.message}` };
  }
}
