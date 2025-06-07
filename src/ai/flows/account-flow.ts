'use server';
/**
 * @fileOverview Flow for interacting with Binance account.
 *
 * - getAccountBalance - A function to fetch account balance.
 * - AccountBalanceOutput - The return type for the getAccountBalance function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Binance from 'node-binance-api'; // Corrected import

// Define the output schema for the account balance
const AccountBalanceOutputSchema = z.object({
  usdtBalance: z.number().describe('The available USDT balance in the futures account for new positions.'),
  totalEquity: z.number().describe('The total wallet balance in USDT across the futures account.'),
});
export type AccountBalanceOutput = z.infer<typeof AccountBalanceOutputSchema>;

// This is an exported wrapper function that calls the flow
export async function getAccountBalance(): Promise<AccountBalanceOutput> {
  return getAccountBalanceFlow();
}

// This is the Genkit flow
const getAccountBalanceFlow = ai.defineFlow(
  {
    name: 'getAccountBalanceFlow',
    inputSchema: z.void(), // No input needed for this flow
    outputSchema: AccountBalanceOutputSchema,
  },
  async () => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Binance API key or secret is not configured in environment variables.');
      throw new Error('Binance API credentials not configured. Please set BINANCE_API_KEY and BINANCE_API_SECRET environment variables.');
    }

    const binance = new Binance().options({
      APIKEY: apiKey,
      APISECRET: apiSecret,
      // Set to true to use the Binance Testnet
      // test: true 
    });

    try {
      // Fetch futures account information
      // The 'futuresAccount' method usually provides overall balance details.
      // Specific field names like 'availableBalance' and 'totalWalletBalance' can vary slightly
      // based on the API version or library implementation updates. Double-check with library docs if issues arise.
      const accountInfo = await binance.futuresAccount();

      if (!accountInfo || typeof accountInfo.availableBalance === 'undefined' || typeof accountInfo.totalWalletBalance === 'undefined') {
        console.error('Failed to retrieve expected balance fields from Binance API.', accountInfo);
        throw new Error('Could not retrieve valid balance information from Binance.');
      }
      
      const usdtBalance = parseFloat(accountInfo.availableBalance); // Typically, this is the USDT available for new trades
      const totalEquity = parseFloat(accountInfo.totalWalletBalance); // Total value of the futures wallet

      if (isNaN(usdtBalance) || isNaN(totalEquity)) {
        console.error('Parsed balance values are NaN. Raw data:', accountInfo);
        throw new Error('Failed to parse balance information from Binance.');
      }

      return {
        usdtBalance,
        totalEquity,
      };
    } catch (error: any) {
      console.error('Error fetching Binance account balance:', error.message || error);
      if (error.message && error.message.includes('Invalid API-key')) {
         throw new Error('Binance API Key is invalid or does not have sufficient permissions.');
      }
      if (error.message && error.message.includes('Timestamp for this request was')) {
        throw new Error('Timestamp error with Binance API. Check your system clock or network latency.');
      }
      throw new Error(`Failed to fetch account balance from Binance: ${error.message || 'Unknown error'}`);
    }
  }
);
