
'use server';
/**
 * @fileOverview Flow for fetching market data from Binance.
 *
 * - getAvailableSymbols - A function to fetch available trading symbols from Futures Testnet.
 * - AvailableSymbolsOutput - The return type for the getAvailableSymbols function.
 * - getHistoricalCandles - A function to fetch historical candlestick data.
 * - HistoricalCandlesInput - The input type for the getHistoricalCandles function.
 * - HistoricalCandlesOutput - The return type for the getHistoricalCandles function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Binance from 'node-binance-api';
import type { Candlestick } from '@/types';

// Define the output schema for available symbols
const AvailableSymbolsOutputSchema = z.array(z.string()).describe('A list of available trading symbols, e.g., ["BTCUSDT", "ETHUSDT"].');
export type AvailableSymbolsOutput = z.infer<typeof AvailableSymbolsOutputSchema>;

// This is an exported wrapper function that calls the flow
export async function getAvailableSymbols(): Promise<AvailableSymbolsOutput> {
  return getAvailableSymbolsFlow();
}

// This is the Genkit flow
const getAvailableSymbolsFlow = ai.defineFlow(
  {
    name: 'getAvailableSymbolsFlow',
    inputSchema: z.void(), // No input needed for this flow
    outputSchema: AvailableSymbolsOutputSchema,
  },
  async () => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn('Binance API key or secret is not configured. Attempting to fetch symbols without authentication for public data.');
    }

    const binance = new Binance().options({
      APIKEY: apiKey,
      APISECRET: apiSecret,
      test: true, 
    });

    try {
      console.log('Attempting to fetch exchange info from Binance Futures Testnet...');
      const exchangeInfo = await binance.futuresExchangeInfo();
      
      if (exchangeInfo && Array.isArray(exchangeInfo.symbols)) {
        const symbols = exchangeInfo.symbols
          .filter((s: any) => s.status === 'TRADING') 
          .map((s: any) => s.symbol as string);
        console.log(`Successfully fetched ${symbols.length} symbols from Testnet.`);
        return symbols;
      } else {
        console.error('Failed to fetch symbols or unexpected response structure:', exchangeInfo);
        throw new Error('Could not retrieve valid symbols list from Binance Testnet. Unexpected response structure.');
      }
    } catch (error: any) {
      console.error('Error during Binance API call for fetching symbols:', error);
      let errorMessage = error.message || 'Unknown error';
       if (error.body) { 
        try {
          const errorBody = JSON.parse(error.body);
          if (errorBody.msg) errorMessage = errorBody.msg;
        } catch (e) {
          // ignore parsing error
        }
      }
      throw new Error(`Failed to fetch available symbols from Binance Testnet: ${errorMessage}`);
    }
  }
);


// Schema for historical candles input
const HistoricalCandlesInputSchema = z.object({
  symbol: z.string().describe('The trading symbol, e.g., BTCUSDT.'),
  interval: z.string().describe('The candle interval, e.g., 1m, 5m, 1h, 4h, 1d.'),
  limit: z.number().int().positive().optional().default(100).describe('Number of candles to fetch, default 100, max 1500 for futures.'),
});
export type HistoricalCandlesInput = z.infer<typeof HistoricalCandlesInputSchema>;

// Schema for historical candles output
const CandlestickSchema = z.object({
  timestamp: z.number().describe('Unix timestamp in milliseconds for the candle open time.'),
  open: z.number().describe('Opening price.'),
  high: z.number().describe('Highest price.'),
  low: z.number().describe('Lowest price.'),
  close: z.number().describe('Closing price.'),
  volume: z.number().describe('Trading volume.'),
});
const HistoricalCandlesOutputSchema = z.array(CandlestickSchema);
export type HistoricalCandlesOutput = z.infer<typeof HistoricalCandlesOutputSchema>;


// Exported wrapper function for fetching historical candles
export async function getHistoricalCandles(input: HistoricalCandlesInput): Promise<HistoricalCandlesOutput> {
  return getHistoricalCandlesFlow(input);
}

// Genkit flow for fetching historical candles
const getHistoricalCandlesFlow = ai.defineFlow(
  {
    name: 'getHistoricalCandlesFlow',
    inputSchema: HistoricalCandlesInputSchema,
    outputSchema: HistoricalCandlesOutputSchema,
  },
  async ({ symbol, interval, limit = 100 }) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    // API keys might not be strictly required for public candle data, but good practice
    if (!apiKey || !apiSecret) {
      console.warn('Binance API key or secret is not configured. Attempting to fetch candles without full authentication.');
    }

    const binance = new Binance().options({
      APIKEY: apiKey,
      APISECRET: apiSecret,
      test: true, // Use testnet if appropriate, or make this configurable
    });

    try {
      console.log(`Fetching ${limit} ${interval} candles for ${symbol} from Binance Futures Testnet...`);
      // For futures, use futuresCandles. For spot, use candles.
      const candlesRaw: any[] = await binance.futuresCandles(symbol.toUpperCase(), interval, { limit });
      
      if (!Array.isArray(candlesRaw)) {
        console.error('Unexpected response structure for candles:', candlesRaw);
        throw new Error('Could not retrieve valid candle data from Binance. Unexpected response structure.');
      }

      const candles: Candlestick[] = candlesRaw.map((c: any) => ({
        timestamp: c[0], // Open time
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
      }));
      
      console.log(`Successfully fetched ${candles.length} candles for ${symbol}.`);
      return candles;

    } catch (error: any) {
      console.error(`Error fetching historical candles for ${symbol} (${interval}):`, error);
      let errorMessage = error.message || 'Unknown error';
      if (error.body) {
        try {
          const errorBody = JSON.parse(error.body);
          if (errorBody.msg) errorMessage = errorBody.msg;
        } catch (e) { /* ignore parsing error */ }
      }
      throw new Error(`Failed to fetch historical candles from Binance Testnet for ${symbol}: ${errorMessage}`);
    }
  }
);
