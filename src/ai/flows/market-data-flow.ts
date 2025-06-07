
'use server';
/**
 * @fileOverview Flow for fetching market data from Binance.
 *
 * - getAvailableSymbols - A function to fetch available trading symbols from Futures Testnet.
 * - AvailableSymbolsOutput - The return type for the getAvailableSymbols function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Binance from 'node-binance-api';

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

    // API keys are not strictly required for futuresExchangeInfo, but it's good practice if other authenticated calls are made.
    // For public data endpoints, they might not be needed, but the library setup usually includes them.
    if (!apiKey || !apiSecret) {
      console.warn('Binance API key or secret is not configured. Attempting to fetch symbols without authentication for public data.');
      // Depending on the library and endpoint, this might still work or fail.
      // For futuresExchangeInfo, it often works without full auth.
    }

    const binance = new Binance().options({
      APIKEY: apiKey,
      APISECRET: apiSecret,
      test: true, // IMPORTANT: Ensure this is true for Testnet
    });

    try {
      console.log('Attempting to fetch exchange info from Binance Futures Testnet...');
      const exchangeInfo = await binance.futuresExchangeInfo();
      
      if (exchangeInfo && Array.isArray(exchangeInfo.symbols)) {
        const symbols = exchangeInfo.symbols
          .filter((s: any) => s.status === 'TRADING') // Ensure only trading symbols are included
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
