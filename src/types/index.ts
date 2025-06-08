
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
  botName?: string;
  version?: string;
  targetSymbols?: string[]; // Updated to string[]
  emaShortPeriod?: number;
  emaMediumPeriod?: number;
  emaLongPeriod?: number;
  atrPeriod?: number;
  stopLossMultiplier?: number;
  takeProfitMultiplier?: number;
  tradingEnabled?: boolean;
  telegramChatId?: string;
  // Allow any other string-keyed properties for flexibility
  [key: string]: string | number | boolean | string[] | undefined;
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

export interface CustomStrategyDoc {
  pineScript?: string;
  explanation?: string;
}

// Types for AI Configuration Suggester
export interface StrategyConfigSuggesterInput {
  strategyDescription: string;
  capital: number;
}

export interface SuggestedBotConfig {
  targetSymbols?: string[];
  emaShortPeriod?: number;
  emaMediumPeriod?: number;
  emaLongPeriod?: number;
  atrPeriod?: number;
}

export interface StrategyConfigSuggesterOutput {
  suggestions: SuggestedBotConfig;
  aiAssumptions?: string;
  warnings?: string[];
  summary: string;
}
