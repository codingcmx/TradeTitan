
'use server';
/**
 * @fileOverview Flow for backtesting a trading strategy.
 *
 * - runBacktest - Simulates a trading strategy against historical data.
 * - BacktestInput - The input type for the runBacktest function.
 * - BacktestOutput - The return type for the runBacktest function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { BotConfig, HistoricalDataPoint, BacktestSimulatedTrade } from '@/types';
import { getBotConfiguration } from '@/lib/firestoreService';

// Input schema for the flow invocation from the client
const BacktestInputSchema = z.object({
  historicalDataCsv: z.string().describe("CSV string of historical market data. Format: timestamp,open,high,low,close(,volume). Timestamp should be Unix milliseconds."),
  initialCapital: z.number().positive().describe("The starting capital for the backtest simulation."),
  tradeAmountUSD: z.number().positive().describe("The fixed USD amount to allocate per trade (e.g., 100 for $100)."), // Changed from percentage
  targetSymbolOverride: z.string().optional().describe("Specify a symbol if the CSV data is for a specific one, overriding bot config's first symbol."),
});
export type BacktestInput = z.infer<typeof BacktestInputSchema>;


// Output schema for the backtest results
const BacktestOutputSchema = z.object({
  summary: z.string().optional().describe("AI-generated summary of backtest performance (future feature)."),
  totalTrades: z.number().int().describe("Total number of trades executed."),
  winningTrades: z.number().int().describe("Number of trades that resulted in a profit."),
  losingTrades: z.number().int().describe("Number of trades that resulted in a loss."),
  winRate: z.number().describe("Percentage of winning trades (0-100)."),
  averageWinAmount: z.number().optional().describe("Average profit amount of winning trades."),
  averageLossAmount: z.number().optional().describe("Average loss amount of losing trades (positive number)."),
  profitFactor: z.number().optional().describe("Gross profit divided by gross loss. Undefined if no losses."),
  netProfit: z.number().describe("Total profit or loss from all trades."),
  netProfitPercentage: z.number().describe("Net profit as a percentage of the initial capital."),
  maxDrawdown: z.number().optional().describe("Maximum peak-to-trough decline during a specific period, as a percentage of capital (future feature)."),
  simulatedTrades: z.array(z.object({
    symbol: z.string(),
    type: z.enum(['BUY', 'SELL']),
    entryTimestamp: z.number(),
    entryPrice: z.number(),
    exitTimestamp: z.number().optional(),
    exitPrice: z.number().optional(),
    quantity: z.number(),
    pnl: z.number().optional(),
    pnlPercentage: z.number().optional(), // PnL % based on initial trade value
    reasonEntry: z.string().optional(),
    reasonExit: z.string().optional(),
    highestPriceReached: z.number().optional(),
    lowestPriceReached: z.number().optional(),
  })).describe("List of all trades executed during the simulation."),
  initialCapital: z.number().describe("The initial capital at the start of the backtest."),
  finalCapital: z.number().describe("The capital at the end of the backtest."),
  errorMessage: z.string().optional().describe("Error message if the backtest failed."),
  configUsed: z.any().optional().describe("The bot configuration used for this backtest."), 
  symbolTested: z.string().describe("The symbol that was tested."),
});
export type BacktestOutput = z.infer<typeof BacktestOutputSchema>;


export async function runBacktest(input: BacktestInput): Promise<BacktestOutput> {
  return backtestFlow(input);
}

// Placeholder for EMA calculation
const calculateEMA = (data: number[], period: number): (number | undefined)[] => {
  if (!data || data.length < period) return Array(data.length).fill(undefined);
  const k = 2 / (period + 1);
  const emaArray: (number | undefined)[] = Array(data.length).fill(undefined);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  emaArray[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    emaArray[i] = (data[i] * k) + (emaArray[i - 1]! * (1 - k));
  }
  return emaArray;
};

// Placeholder for ATR calculation
const calculateATR = (high: number[], low: number[], close: number[], period: number): (number | undefined)[] => {
  if (!high || high.length < period || !low || low.length < period || !close || close.length < period) {
    return Array(high.length).fill(undefined);
  }
  const trArray: number[] = [];
  for (let i = 0; i < high.length; i++) {
    const tr1 = high[i] - low[i];
    const tr2 = i > 0 ? Math.abs(high[i] - close[i-1]) : tr1;
    const tr3 = i > 0 ? Math.abs(low[i] - close[i-1]) : tr1;
    trArray.push(Math.max(tr1, tr2, tr3));
  }
  
  const atrArray: (number | undefined)[] = Array(high.length).fill(undefined);
  if (trArray.length < period) return atrArray;

  let sumTR = 0;
  for (let i = 0; i < period; i++) sumTR += trArray[i];
  atrArray[period - 1] = sumTR / period;

  for (let i = period; i < trArray.length; i++) {
    atrArray[i] = (atrArray[i - 1]! * (period - 1) + trArray[i]) / period;
  }
  return atrArray;
};


const backtestFlow = ai.defineFlow(
  {
    name: 'backtestFlow',
    inputSchema: BacktestInputSchema,
    outputSchema: BacktestOutputSchema,
  },
  async (input) => {
    let botConfig: BotConfig;
    try {
      botConfig = await getBotConfiguration();
    } catch (e: any) {
      return { errorMessage: `Failed to load bot configuration: ${e.message}`, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: input.targetSymbolOverride || 'UNKNOWN' };
    }
    
    const symbolToTest = input.targetSymbolOverride || botConfig.targetSymbols?.[0];
    if (!symbolToTest) {
      return { errorMessage: "No target symbol specified for backtesting (either in Bot Config or as override).", totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: 'NONE' };
    }

    const { emaShortPeriod, emaMediumPeriod, atrPeriod, stopLossMultiplier, takeProfitMultiplier, timeframe } = botConfig; // timeframe is from botConfig now

    if (!emaShortPeriod || !emaMediumPeriod || !atrPeriod || !stopLossMultiplier || !takeProfitMultiplier || !timeframe) {
      return { errorMessage: "Missing critical strategy parameters in Bot Configuration (EMAs, ATR, SL/TP Multipliers, Timeframe).", totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: symbolToTest, configUsed: botConfig };
    }

    const historicalData: HistoricalDataPoint[] = [];
    try {
      const lines = input.historicalDataCsv.trim().split('\n');
      const header = lines[0].toLowerCase().split(',');
      const tsIndex = header.indexOf('timestamp');
      const openIndex = header.indexOf('open');
      const highIndex = header.indexOf('high');
      const lowIndex = header.indexOf('low');
      const closeIndex = header.indexOf('close');

      if (tsIndex === -1 || openIndex === -1 || highIndex === -1 || lowIndex === -1 || closeIndex === -1) {
        throw new Error("CSV header must contain: timestamp, open, high, low, close.");
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        historicalData.push({
          timestamp: parseInt(values[tsIndex]),
          open: parseFloat(values[openIndex]),
          high: parseFloat(values[highIndex]),
          low: parseFloat(values[lowIndex]),
          close: parseFloat(values[closeIndex]),
        });
      }
      if (historicalData.length < Math.max(emaShortPeriod, emaMediumPeriod, atrPeriod) + 5) { 
        throw new Error("Not enough historical data provided for indicator calculation and trading.");
      }
    } catch (e: any) {
      return { errorMessage: `Error parsing CSV: ${e.message}`, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: symbolToTest, configUsed: botConfig };
    }
    
    const simulatedTrades: BacktestSimulatedTrade[] = [];
    let currentCapital = input.initialCapital;
    let position: BacktestSimulatedTrade | null = null;

    const closePrices = historicalData.map(p => p.close);
    const highPrices = historicalData.map(p => p.high);
    const lowPrices = historicalData.map(p => p.low);

    const emasShort = calculateEMA(closePrices, emaShortPeriod);
    const emasMedium = calculateEMA(closePrices, emaMediumPeriod);
    const atrs = calculateATR(highPrices, lowPrices, closePrices, atrPeriod);

    for (let i = Math.max(emaShortPeriod, emaMediumPeriod, atrPeriod); i < historicalData.length; i++) {
      const currentData = historicalData[i];
      const emaS = emasShort[i];
      const emaM = emasMedium[i];
      const emaS_prev = emasShort[i-1];
      const emaM_prev = emasMedium[i-1];
      const atr = atrs[i];

      if (!emaS || !emaM || !atr || !emaS_prev || !emaM_prev) continue; 

      if (position) {
        let exitPrice: number | undefined;
        let reasonExit: string | undefined;
        const currentStopLossPrice = position.type === 'BUY' 
            ? position.entryPrice - (atr * stopLossMultiplier) 
            : position.entryPrice + (atr * stopLossMultiplier);
        const currentTakeProfitPrice = position.type === 'BUY' 
            ? position.entryPrice + (atr * takeProfitMultiplier) 
            : position.entryPrice - (atr * takeProfitMultiplier);

        if (position.type === 'BUY') {
          if (currentData.low <= currentStopLossPrice) {
            exitPrice = currentStopLossPrice; // SL hit
            reasonExit = `Stop Loss hit at ${exitPrice.toFixed(2)}`;
          } else if (currentData.high >= currentTakeProfitPrice) {
            exitPrice = currentTakeProfitPrice; // TP hit
            reasonExit = `Take Profit hit at ${exitPrice.toFixed(2)}`;
          }
        } else { // SELL position
          if (currentData.high >= currentStopLossPrice) {
            exitPrice = currentStopLossPrice; // SL hit
            reasonExit = `Stop Loss hit at ${exitPrice.toFixed(2)}`;
          } else if (currentData.low <= currentTakeProfitPrice) {
            exitPrice = currentTakeProfitPrice; // TP hit
            reasonExit = `Take Profit hit at ${exitPrice.toFixed(2)}`;
          }
        }
        
        if (exitPrice) {
            position.exitPrice = exitPrice;
            position.exitTimestamp = currentData.timestamp;
            position.reasonExit = reasonExit;
            const pnl = position.type === 'BUY' ? (position.exitPrice - position.entryPrice) * position.quantity : (position.entryPrice - position.exitPrice) * position.quantity;
            position.pnl = pnl;
            const initialTradeValue = position.entryPrice * position.quantity;
            position.pnlPercentage = initialTradeValue > 0 ? (pnl / initialTradeValue) * 100 : 0;
            currentCapital += pnl;
            simulatedTrades.push(position);
            position = null;
        }
      }

      if (!position && currentCapital > input.tradeAmountUSD) { // Ensure enough capital for one trade
        const quantity = input.tradeAmountUSD / currentData.close; 

        if (emaS_prev <= emaM_prev && emaS > emaM) { // Long Entry
          position = {
            symbol: symbolToTest, type: 'BUY', entryPrice: currentData.close, entryTimestamp: currentData.timestamp,
            quantity: quantity, reasonEntry: `EMA(${emaShortPeriod}) cross EMA(${emaMediumPeriod}) Up`,
          };
        } else if (emaS_prev >= emaM_prev && emaS < emaM) { // Short Entry
          position = {
            symbol: symbolToTest, type: 'SELL', entryPrice: currentData.close, entryTimestamp: currentData.timestamp,
            quantity: quantity, reasonEntry: `EMA(${emaShortPeriod}) cross EMA(${emaMediumPeriod}) Down`,
          };
        }
      }
    }
    
    if (position) { // Close any open position at the end of data
        const lastData = historicalData[historicalData.length - 1];
        position.exitPrice = lastData.close;
        position.exitTimestamp = lastData.timestamp;
        position.reasonExit = "End of data";
        const pnl = position.type === 'BUY' ? (position.exitPrice - position.entryPrice) * position.quantity : (position.entryPrice - position.exitPrice) * position.quantity;
        position.pnl = pnl;
        const initialTradeValue = position.entryPrice * position.quantity;
        position.pnlPercentage = initialTradeValue > 0 ? (pnl / initialTradeValue) * 100 : 0;
        currentCapital += pnl;
        simulatedTrades.push(position);
    }

    const totalTrades = simulatedTrades.length;
    const tradesWithPnl = simulatedTrades.filter(t => t.pnl !== undefined);
    const winningTrades = tradesWithPnl.filter(t => t.pnl! > 0).length;
    const losingTrades = tradesWithPnl.filter(t => t.pnl! < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const netProfit = currentCapital - input.initialCapital;
    const netProfitPercentage = (netProfit / input.initialCapital) * 100;
    const grossProfit = tradesWithPnl.filter(t => t.pnl! > 0).reduce((sum, t) => sum + t.pnl!, 0);
    const grossLoss = Math.abs(tradesWithPnl.filter(t => t.pnl! < 0).reduce((sum, t) => sum + t.pnl!, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : undefined);
    const averageWinAmount = winningTrades > 0 ? grossProfit / winningTrades : undefined;
    const averageLossAmount = losingTrades > 0 ? grossLoss / losingTrades : undefined;

    return {
      totalTrades, winningTrades, losingTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      averageWinAmount: averageWinAmount ? parseFloat(averageWinAmount.toFixed(2)) : undefined,
      averageLossAmount: averageLossAmount ? parseFloat(averageLossAmount.toFixed(2)) : undefined,
      profitFactor: profitFactor !== undefined ? (isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(2)) : Infinity) : undefined,
      netProfit: parseFloat(netProfit.toFixed(2)),
      netProfitPercentage: parseFloat(netProfitPercentage.toFixed(2)),
      simulatedTrades,
      initialCapital: input.initialCapital,
      finalCapital: parseFloat(currentCapital.toFixed(2)),
      configUsed: botConfig,
      symbolTested: symbolToTest,
    };
  }
);
