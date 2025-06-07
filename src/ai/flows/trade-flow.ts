
'use server';
/**
 * @fileOverview Flow for placing trades on Binance.
 *
 * - placeTrade - A function to place a market trade.
 * - PlaceTradeInput - The input type for the placeTrade function.
 * - PlaceTradeOutput - The return type for the placeTrade function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Binance from 'node-binance-api';

// Define the input schema for placing a trade
const PlaceTradeInputSchema = z.object({
  symbol: z.string().describe('The trading symbol, e.g., BTCUSDT.'),
  type: z.enum(['BUY', 'SELL']).describe('The type of trade: BUY or SELL.'),
  quantity: z.number().positive().describe('The quantity of the asset to trade.'),
});
export type PlaceTradeInput = z.infer<typeof PlaceTradeInputSchema>;

// Define the output schema for the trade placement result
const PlaceTradeOutputSchema = z.object({
  success: z.boolean().describe('Whether the trade placement was successful.'),
  message: z.string().describe('A message indicating the result of the trade placement.'),
  orderId: z.string().optional().describe('The order ID if the trade was successful.'),
});
export type PlaceTradeOutput = z.infer<typeof PlaceTradeOutputSchema>;

// This is an exported wrapper function that calls the flow
export async function placeTrade(input: PlaceTradeInput): Promise<PlaceTradeOutput> {
  return placeTradeFlow(input);
}

// This is the Genkit flow
const placeTradeFlow = ai.defineFlow(
  {
    name: 'placeTradeFlow',
    inputSchema: PlaceTradeInputSchema,
    outputSchema: PlaceTradeOutputSchema,
  },
  async ({ symbol, type, quantity }) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Binance API key or secret is not configured in environment variables.');
      return {
        success: false,
        message: 'Binance API credentials not configured. Please set BINANCE_API_KEY and BINANCE_API_SECRET environment variables.',
      };
    }

    const binance = new Binance().options({
      APIKEY: apiKey,
      APISECRET: apiSecret,
      test: true, // IMPORTANT: Ensure this is true for Testnet
    });

    try {
      let orderResult: any;
      const upperCaseSymbol = symbol.toUpperCase();

      console.log(`Attempting to place ${type} order for ${quantity} of ${upperCaseSymbol} on Testnet.`);

      if (type === 'BUY') {
        orderResult = await binance.futuresMarketBuy(upperCaseSymbol, quantity);
      } else { // SELL
        orderResult = await binance.futuresMarketSell(upperCaseSymbol, quantity);
      }

      console.log('Binance API response:', JSON.stringify(orderResult, null, 2));

      if (orderResult && orderResult.orderId) {
        return {
          success: true,
          message: `${type} order for ${quantity} ${upperCaseSymbol} placed successfully on Testnet. Order ID: ${orderResult.orderId}`,
          orderId: String(orderResult.orderId),
        };
      } else if (orderResult && orderResult.code && orderResult.msg) {
        // Handle Binance API errors (e.g., insufficient balance, invalid symbol)
        console.error(`Binance API Error: ${orderResult.msg} (Code: ${orderResult.code})`);
        return {
          success: false,
          message: `Binance API Error: ${orderResult.msg} (Code: ${orderResult.code})`,
        };
      } 
       else {
        console.error('Failed to place trade. Unexpected API response:', orderResult);
        return {
          success: false,
          message: 'Failed to place trade due to an unexpected API response. Check console for details.',
        };
      }
    } catch (error: any) {
      console.error('Error during Binance API call for placing trade:', error);
      let errorMessage = error.message || 'Unknown error';
      if (error.body) { // The library often includes more details in error.body
        try {
          const errorBody = JSON.parse(error.body);
          if (errorBody.msg) errorMessage = errorBody.msg;
        } catch (e) {
          // ignore parsing error
        }
      }
      return {
        success: false,
        message: `Failed to place trade on Testnet: ${errorMessage}`,
      };
    }
  }
);
