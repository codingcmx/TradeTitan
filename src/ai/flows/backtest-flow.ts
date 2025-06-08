
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
import type { BotConfig, HistoricalDataPoint, BacktestSimulatedTrade, BacktestInput as BacktestInputType } from '@/types'; // Renamed BacktestInput to BacktestInputType
import { getBotConfiguration } from '@/lib/firestoreService';

// Input schema for the flow invocation from the client
const BacktestInputSchema = z.object({
  historicalDataCsv: z.string().describe("CSV string of historical market data. Format: timestamp,open,high,low,close(,volume). Timestamp should be Unix milliseconds."),
  initialCapital: z.number().positive().describe("The starting capital for the backtest simulation."),
  tradeAmountUSD: z.number().positive().describe("The fixed USD amount to allocate per trade (e.g., 100 for $100)."),
  targetSymbolOverride: z.string().optional().describe("Specify a symbol if the CSV data is for a specific one, overriding bot config's first symbol."),
  // Optional strategy parameter overrides
  emaShortPeriod: z.number().int().positive().optional().describe("Override EMA Short Period for this backtest."),
  emaMediumPeriod: z.number().int().positive().optional().describe("Override EMA Medium Period for this backtest."),
  atrPeriod: z.number().int().positive().optional().describe("Override ATR Period for this backtest."),
  stopLossMultiplier: z.number().positive().optional().describe("Override Stop Loss Multiplier for this backtest."),
  takeProfitMultiplier: z.number().positive().optional().describe("Override Take Profit Multiplier for this backtest."),
  timeframe: z.string().optional().describe("Override trading timeframe for this backtest (e.g., '1h', '4h')."),
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
  configUsed: z.object({
    type: z.enum(['global', 'override']),
    params: z.any(), // Can be BotConfig or the override subset from BacktestInput
  }).optional().describe("The configuration parameters used for this backtest (global or override)."),
  symbolTested: z.string().describe("The symbol that was tested."),
});
export type BacktestOutput = z.infer<typeof BacktestOutputSchema>;


export async function runBacktest(input: BacktestInput): Promise<BacktestOutput> {
  return backtestFlow(input);
}

// Placeholder for EMA calculation
const calculateEMA = (data: number[], period: number): (number | undefined)[] => {
  if (!data || data.length < period || period <= 0 || !Number.isInteger(period)) return Array(data.length).fill(undefined);
  const k = 2 / (period + 1);
  const emaArray: (number | undefined)[] = Array(data.length).fill(undefined);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    if (typeof data[i] !== 'number' || isNaN(data[i])) { // Handle NaN in input data for initial sum
        // Fill preceding EMAs as undefined and return if initial data is bad
        for(let j=0; j < data.length; j++) emaArray[j] = undefined;
        return emaArray;
    }
    sum += data[i];
  }
  emaArray[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    if (typeof data[i] !== 'number' || isNaN(data[i]) || emaArray[i-1] === undefined) {
        emaArray[i] = undefined; // Propagate undefined if current data is bad or previous EMA is undefined
        continue;
    }
    emaArray[i] = (data[i] * k) + (emaArray[i - 1]! * (1 - k));
  }
  return emaArray;
};

// Placeholder for ATR calculation
const calculateATR = (high: number[], low: number[], close: number[], period: number): (number | undefined)[] => {
  if (!high || high.length < period || !low || low.length < period || !close || close.length < period || period <=0 || !Number.isInteger(period)) {
    return Array(high.length).fill(undefined);
  }
  const trArray: number[] = [];
  for (let i = 0; i < high.length; i++) {
    if (typeof high[i] !== 'number' || isNaN(high[i]) || typeof low[i] !== 'number' || isNaN(low[i]) || typeof close[i] !== 'number' || isNaN(close[i])) {
        // if any OHLC is NaN, TR cannot be calculated reliably for this point
        return Array(high.length).fill(undefined); // Signal error for ATR calc
    }
    const tr1 = high[i] - low[i];
    const tr2 = i > 0 && (typeof close[i-1] === 'number' && !isNaN(close[i-1])) ? Math.abs(high[i] - close[i-1]) : tr1;
    const tr3 = i > 0 && (typeof close[i-1] === 'number' && !isNaN(close[i-1])) ? Math.abs(low[i] - close[i-1]) : tr1;
    trArray.push(Math.max(tr1, tr2, tr3));
  }
  
  const atrArray: (number | undefined)[] = Array(high.length).fill(undefined);
  if (trArray.length < period) return atrArray;

  let sumTR = 0;
  for (let i = 0; i < period; i++) sumTR += trArray[i];
  atrArray[period - 1] = sumTR / period;

  for (let i = period; i < trArray.length; i++) {
     if (atrArray[i-1] === undefined) {
        atrArray[i] = undefined;
        continue;
     }
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
  async (input: BacktestInput) => { // Explicitly type input
    let strategyParams: Partial<BotConfig>;
    let configUsedForOutput: BacktestOutput['configUsed'];

    // Check if override parameters are provided and valid
    const hasOverrideParams = 
        input.emaShortPeriod !== undefined &&
        input.emaMediumPeriod !== undefined &&
        input.atrPeriod !== undefined &&
        input.stopLossMultiplier !== undefined &&
        input.takeProfitMultiplier !== undefined &&
        input.timeframe !== undefined;

    if (hasOverrideParams) {
        strategyParams = {
            emaShortPeriod: input.emaShortPeriod,
            emaMediumPeriod: input.emaMediumPeriod,
            atrPeriod: input.atrPeriod,
            stopLossMultiplier: input.stopLossMultiplier,
            takeProfitMultiplier: input.takeProfitMultiplier,
            timeframe: input.timeframe,
            targetSymbols: input.targetSymbolOverride ? [input.targetSymbolOverride] : [], // Use override symbol
        };
        configUsedForOutput = { type: 'override', params: { ...strategyParams, targetSymbolOverride: input.targetSymbolOverride } };
        console.log("Using override parameters for backtest:", strategyParams);
    } else {
        try {
            const globalBotConfig = await getBotConfiguration();
            strategyParams = globalBotConfig;
            configUsedForOutput = { type: 'global', params: globalBotConfig };
            console.log("Using global bot configuration for backtest:", globalBotConfig);
        } catch (e: any) {
            return { errorMessage: `Failed to load global bot configuration: ${e.message}`, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: input.targetSymbolOverride || 'UNKNOWN' };
        }
    }
    
    const symbolToTest = input.targetSymbolOverride || strategyParams.targetSymbols?.[0];
    if (!symbolToTest) {
      return { errorMessage: "No target symbol specified for backtesting (either in Bot Config, override, or as CSV override).", totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: 'NONE', configUsed: configUsedForOutput };
    }

    const { emaShortPeriod, emaMediumPeriod, atrPeriod, stopLossMultiplier, takeProfitMultiplier, timeframe } = strategyParams;

    if (emaShortPeriod === undefined || emaMediumPeriod === undefined || atrPeriod === undefined || stopLossMultiplier === undefined || takeProfitMultiplier === undefined || timeframe === undefined) {
      return { errorMessage: "Missing critical strategy parameters (EMAs, ATR, SL/TP Multipliers, Timeframe) either from override or global config.", totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: symbolToTest, configUsed: configUsedForOutput };
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
        throw new Error(`Not enough historical data provided (${historicalData.length} rows) for indicator calculation (max period: ${Math.max(emaShortPeriod, emaMediumPeriod, atrPeriod)}) and trading.`);
      }
    } catch (e: any) {
      return { errorMessage: `Error parsing CSV: ${e.message}`, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: symbolToTest, configUsed: configUsedForOutput };
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

    if (emasShort.every(v => v === undefined) || emasMedium.every(v => v === undefined) || atrs.every(v => v === undefined)) {
        let missingIndicators = [];
        if (emasShort.every(v => v === undefined)) missingIndicators.push(`EMA Short (${emaShortPeriod})`);
        if (emasMedium.every(v => v === undefined)) missingIndicators.push(`EMA Medium (${emaMediumPeriod})`);
        if (atrs.every(v => v === undefined)) missingIndicators.push(`ATR (${atrPeriod})`);
        return { errorMessage: `Failed to calculate one or more indicators: ${missingIndicators.join(', ')}. Check data quality or period lengths.`, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, netProfit: 0, netProfitPercentage: 0, simulatedTrades: [], initialCapital: input.initialCapital, finalCapital: input.initialCapital, symbolTested: symbolToTest, configUsed: configUsedForOutput };
    }


    for (let i = Math.max(emaShortPeriod, emaMediumPeriod, atrPeriod); i < historicalData.length; i++) {
      const currentData = historicalData[i];
      const emaS = emasShort[i];
      const emaM = emasMedium[i];
      const emaS_prev = emasShort[i-1];
      const emaM_prev = emasMedium[i-1];
      const currentAtr = atrs[i-1] || atrs[i]; // Use previous ATR for SL/TP calc based on entry bar, or current if prev unavailable

      if (emaS === undefined || emaM === undefined || currentAtr === undefined || emaS_prev === undefined || emaM_prev === undefined) continue; 

      if (position) {
        let exitPrice: number | undefined;
        let reasonExit: string | undefined;
        const currentStopLossPrice = position.type === 'BUY' 
            ? position.entryPrice - (currentAtr * stopLossMultiplier) 
            : position.entryPrice + (currentAtr * stopLossMultiplier);
        const currentTakeProfitPrice = position.type === 'BUY' 
            ? position.entryPrice + (currentAtr * takeProfitMultiplier) 
            : position.entryPrice - (currentAtr * takeProfitMultiplier);

        if (position.type === 'BUY') {
          if (currentData.low <= currentStopLossPrice) {
            exitPrice = currentStopLossPrice; // SL hit
            reasonExit = `Stop Loss hit at ${exitPrice.toFixed(4)}`;
          } else if (currentData.high >= currentTakeProfitPrice) {
            exitPrice = currentTakeProfitPrice; // TP hit
            reasonExit = `Take Profit hit at ${exitPrice.toFixed(4)}`;
          }
        } else { // SELL position
          if (currentData.high >= currentStopLossPrice) {
            exitPrice = currentStopLossPrice; // SL hit
            reasonExit = `Stop Loss hit at ${exitPrice.toFixed(4)}`;
          } else if (currentData.low <= currentTakeProfitPrice) {
            exitPrice = currentTakeProfitPrice; // TP hit
            reasonExit = `Take Profit hit at ${exitPrice.toFixed(4)}`;
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
            quantity: quantity, reasonEntry: `EMA(${emaShortPeriod}) cross EMA(${emaMediumPeriod}) Up. Prev S:${emaS_prev?.toFixed(2)}, M:${emaM_prev?.toFixed(2)}. Curr S:${emaS?.toFixed(2)}, M:${emaM?.toFixed(2)}`,
          };
        } else if (emaS_prev >= emaM_prev && emaS < emaM) { // Short Entry
          position = {
            symbol: symbolToTest, type: 'SELL', entryPrice: currentData.close, entryTimestamp: currentData.timestamp,
            quantity: quantity, reasonEntry: `EMA(${emaShortPeriod}) cross EMA(${emaMediumPeriod}) Down. Prev S:${emaS_prev?.toFixed(2)}, M:${emaM_prev?.toFixed(2)}. Curr S:${emaS?.toFixed(2)}, M:${emaM?.toFixed(2)}`,
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
      averageWinAmount: averageWinAmount ? parseFloat(averageWinAmount.toFixed(4)) : undefined,
      averageLossAmount: averageLossAmount ? parseFloat(averageLossAmount.toFixed(4)) : undefined,
      profitFactor: profitFactor !== undefined ? (isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(2)) : Infinity) : undefined,
      netProfit: parseFloat(netProfit.toFixed(4)),
      netProfitPercentage: parseFloat(netProfitPercentage.toFixed(2)),
      simulatedTrades,
      initialCapital: input.initialCapital,
      finalCapital: parseFloat(currentCapital.toFixed(4)),
      configUsed: configUsedForOutput,
      symbolTested: symbolToTest,
    };
  }
);
