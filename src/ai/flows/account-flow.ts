
'use server';
/**
 * @fileOverview Flow for interacting with Binance account.
 *
 * - getAccountBalance - A function to fetch account balance.
 * - AccountBalanceOutput - The return type for the getAccountBalance function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import Binance from 'node-binance-api';

// Define the output schema for the account balance
const AccountBalanceOutputSchema = z.object({
  usdtBalance: z.number().describe('The available USDT balance in the futures account for new positions.'),
  totalEquity: z.number().describe('The total wallet balance in USDT across the futures account (or total USDT held if from asset-specific balance).'),
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
      test: true 
    });

    try {
      const accountInfo = await binance.futuresAccount();

      if (typeof accountInfo !== 'object' || accountInfo === null) {
        console.error('Binance API returned non-object or null for futuresAccount():', accountInfo);
        throw new Error('Invalid response type from Binance API for futuresAccount().');
      }
      
      // Try to get balances from futuresAccount() first (overall summary)
      if (typeof accountInfo.availableBalance !== 'undefined' && typeof accountInfo.totalWalletBalance !== 'undefined') {
        const usdtBalance = parseFloat(accountInfo.availableBalance);
        const totalEquity = parseFloat(accountInfo.totalWalletBalance);

        if (isNaN(usdtBalance) || isNaN(totalEquity)) {
          console.error('Parsed balance values from futuresAccount() are NaN. Raw data:', JSON.stringify(accountInfo, null, 2));
          throw new Error('Failed to parse balance information from Binance futuresAccount().');
        }
        console.log('Successfully fetched balance using futuresAccount()');
        return {
          usdtBalance,
          totalEquity,
        };
      } else {
        // Fallback to futuresBalance() if specific fields are missing in futuresAccount()
        console.warn('Key fields (availableBalance, totalWalletBalance) missing in futuresAccount() response. Received:', JSON.stringify(accountInfo, null, 2));
        console.log('Attempting to use futuresBalance() for USDT specific balances as a fallback...');
        
        const balances: any[] = await binance.futuresBalance(); // Array of asset balances
        const usdtAsset = balances.find((b: any) => b.asset === 'USDT');

        if (!usdtAsset || typeof usdtAsset.availableBalance === 'undefined' || typeof usdtAsset.balance === 'undefined') {
          console.error('Failed to retrieve expected USDT balance fields from futuresBalance(). Full balances response:', JSON.stringify(balances, null, 2));
          throw new Error('Could not retrieve valid USDT balance information using futuresBalance() from Binance.');
        }
        
        const usdtAvailable = parseFloat(usdtAsset.availableBalance);
        // 'balance' field in futuresBalance for an asset is its wallet balance.
        const usdtTotalInWallet = parseFloat(usdtAsset.balance); 

        if (isNaN(usdtAvailable) || isNaN(usdtTotalInWallet)) {
          console.error('Parsed USDT balance values from futuresBalance() are NaN. Raw USDT asset data:', JSON.stringify(usdtAsset, null, 2));
          throw new Error('Failed to parse USDT balance information from futuresBalance().');
        }
        console.log('Successfully fetched USDT-specific balance using futuresBalance()');
        return {
          usdtBalance: usdtAvailable,
          totalEquity: usdtTotalInWallet, // This represents total USDT held.
        };
      }
    } catch (error: any) {
      console.error('Error during Binance API call or processing:', error);
      if (error.message && error.message.includes('Invalid API-key')) {
         throw new Error('Binance API Key is invalid or does not have sufficient permissions for Futures.');
      }
      if (error.message && error.message.includes('Timestamp for this request was')) {
        throw new Error('Timestamp error with Binance API. Check your system clock or network latency.');
      }
      // Re-throw the original error or a new formatted one if it's not one of the specific checks above
      throw new Error(`Failed to fetch account balance from Binance: ${error.message || 'Unknown error'}`);
    }
  }
);
