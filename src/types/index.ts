export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  status: 'OPEN' | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'CLOSED_NEUTRAL';
  timestampOpen: Date;
  timestampClose?: Date;
  strategy: string;
}

export interface BotLog {
  id: string;
  timestamp: Date;
  message: string;
  level: 'INFO' | 'ERROR' | 'WARN';
  tradeId?: string; // Optional: link log to a specific trade
}

export interface BotConfig {
  [key: string]: string | number | boolean | string[] | undefined; // Allow arrays for things like symbols
  botName?: string;
  version?: string;
  targetSymbols?: string[];
  emaShortPeriod?: number;
  emaMediumPeriod?: number;
  emaLongPeriod?: number;
  atrPeriod?: number;
  stopLossMultiplier?: number;
  takeProfitMultiplier?: number;
  tradingEnabled?: boolean;
  telegramChatId?: string;
}

export interface KeyMetric {
  label: string;
  value: string | number;
  change?: string; // e.g., "+5%"
  changeType?: 'positive' | 'negative' | 'neutral';
}

export interface AccountBalance {
  usdtBalance: number;
  totalEquity: number; // Example of another balance metric
  // Add other relevant balance fields here
}
