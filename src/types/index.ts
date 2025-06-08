
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
  targetSymbols?: string[]; 
  emaShortPeriod?: number;
  emaMediumPeriod?: number;
  emaLongPeriod?: number;
  atrPeriod?: number;
  stopLossMultiplier?: number;
  takeProfitMultiplier?: number;
  tradingEnabled?: boolean;
  telegramChatId?: string;
  capital?: number; 
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface KeyMetric {
  label: string;
  value: string | number;
  change?: string; 
  changeType?: 'positive' | 'negative' | 'neutral';
}

export interface AccountBalance {
  usdtBalance: number;
  totalEquity: number; 
}

export interface CustomStrategyDoc {
  pineScript?: string;
  explanation?: string;
}

// Types for Backtesting Feature
export interface HistoricalDataPoint {
  timestamp: number; // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface BacktestInput {
  historicalDataCsv: string; // CSV string: timestamp,open,high,low,close(,volume)
  initialCapital: number;
  tradeAmountPercentage: number; // e.g. 1 for 1% of capital per trade
  targetSymbolOverride?: string; // Optional: to specify which symbol in CSV if BotConfig has multiple targetSymbols
}

export interface BacktestSimulatedTrade {
  symbol: string;
  type: 'BUY' | 'SELL';
  entryTimestamp: number;
  entryPrice: number;
  exitTimestamp?: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number; // Profit or Loss for this trade
  pnlPercentage?: number; // PnL as a percentage of entry value or capital used
  reasonEntry?: string;
  reasonExit?: string;
  highestPriceReached?: number; // During long trade
  lowestPriceReached?: number;  // During short trade
}

export interface BacktestOutput {
  summary?: string; // LLM generated summary if we add it later
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // Percentage
  averageWinAmount?: number;
  averageLossAmount?: number;
  profitFactor?: number; // Gross profit / Gross loss (absolute)
  netProfit: number;
  netProfitPercentage: number; // Net profit as % of initial capital
  maxDrawdown?: number; // Max drawdown as a percentage of capital (optional, harder to implement simply)
  simulatedTrades: BacktestSimulatedTrade[];
  initialCapital: number;
  finalCapital: number;
  errorMessage?: string;
  configUsed?: BotConfig; // To show what config was used for the backtest
  symbolTested: string;
}
