
'use server';
/**
 * @fileOverview An AI assistant to help with trading strategy setup.
 *
 * - getStrategySuggestions - A function that provides calculations and explanations based on user's financial goals.
 * - StrategyAssistantInput - The input type for the getStrategySuggestions function.
 * - StrategyAssistantOutput - The return type for the getStrategySuggestions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const StrategyAssistantInputSchema = z.object({
  capital: z.number().positive().describe('Total available trading capital.'),
  tradeSize: z.number().positive().describe('The amount of margin to be used per trade.'),
  takeProfitValue: z.number().positive().describe('The value the margin should reach for take profit (e.g., if margin is $50, TP value could be $60).'),
  stopLossValue: z.number().positive().describe('The value the margin should fall to for stop loss (e.g., if margin is $50, SL value could be $45).'),
});
export type StrategyAssistantInput = z.infer<typeof StrategyAssistantInputSchema>;

const StrategyAssistantOutputSchema = z.object({
  profitAmount: z.number().describe('Calculated profit amount per trade if take profit is hit.'),
  lossAmount: z.number().describe('Calculated loss amount per trade if stop loss is hit.'),
  riskRewardRatio: z.string().describe('The calculated risk/reward ratio, e.g., "1:2".'),
  takeProfitPercentageOnMargin: z.number().describe('The take profit as a percentage of the margin used.'),
  stopLossPercentageOnMargin: z.number().describe('The stop loss as a percentage of the margin used.'),
  explanation: z.string().describe('An explanation of the calculations, the role of leverage, and guidance for bot configuration.'),
  isValidInput: z.boolean().describe('Whether the input values were valid for calculation.')
});
export type StrategyAssistantOutput = z.infer<typeof StrategyAssistantOutputSchema>;

export async function getStrategySuggestions(input: StrategyAssistantInput): Promise<StrategyAssistantOutput> {
  return strategyAssistantFlow(input);
}

const systemPrompt = `You are a trading strategy assistant. The user has provided their financial parameters for a single trade.
Your task is to:
1. Validate the inputs. Trade size must be less than or equal to capital. Take profit value must be greater than trade size. Stop loss value must be less than trade size.
2. Calculate the profit amount, loss amount, risk/reward ratio, take profit percentage on margin, and stop loss percentage on margin.
3. Provide a clear, concise explanation that includes these calculations.
4. Explain the relationship between these margin-based percentages, underlying asset price movement, and leverage.
5. Offer guidance on how these calculations can inform settings for a trading bot, particularly regarding take profit and stop loss.

Calculation Details:
- Profit Amount = takeProfitValue - tradeSize
- Loss Amount = tradeSize - stopLossValue
- Risk/Reward Ratio: (Profit Amount / Loss Amount). Present as "X:Y" (e.g., if profit is $10 and loss is $5, R/R is "2:1"). Handle division by zero if Loss Amount is 0.
- Take Profit % on Margin = (Profit Amount / tradeSize) * 100
- Stop Loss % on Margin = (Loss Amount / tradeSize) * 100

Leverage Explanation Example:
"To achieve a {takeProfitPercentageOnMargin}% profit on your margin, if the underlying asset price moves 1% in your favor, you would need approximately {takeProfitPercentageOnMargin / 1}x leverage. If it moves 2%, you'd need {takeProfitPercentageOnMargin / 2}x leverage." (Similarly for stop loss).

Bot Configuration Guidance:
Mention that these calculated percentages ({takeProfitPercentageOnMargin}% and {stopLossPercentageOnMargin}%) could be used for fixed percentage-based take profit/stop loss settings if the bot supports them. If the bot uses ATR-based stops/profits, these percentages provide a target that the user would then need to translate into ATR multiples based on the specific asset's price and ATR value.

Output Format:
Return ONLY a JSON object adhering to the StrategyAssistantOutputSchema. Ensure all numbers are actual numbers, not strings with units.
If inputs are invalid (e.g. takeProfitValue <= tradeSize or stopLossValue >= tradeSize or tradeSize <=0), set isValidInput to false and provide a helpful message in the explanation. Otherwise, set isValidInput to true and proceed with calculations.
`;

const strategyAssistantFlow = ai.defineFlow(
  {
    name: 'strategyAssistantFlow',
    inputSchema: StrategyAssistantInputSchema,
    outputSchema: StrategyAssistantOutputSchema,
  },
  async (input) => {
    if (input.tradeSize <= 0 || input.takeProfitValue <= input.tradeSize || input.stopLossValue >= input.tradeSize || input.tradeSize > input.capital) {
      let message = "Invalid input: ";
      if (input.tradeSize <= 0) message += "Trade size must be positive. ";
      if (input.takeProfitValue <= input.tradeSize) message += "Take profit value must be greater than trade size. ";
      if (input.stopLossValue >= input.tradeSize) message += "Stop loss value must be less than trade size. ";
      if (input.tradeSize > input.capital) message += "Trade size cannot exceed total capital. ";
      
      return {
        profitAmount: 0,
        lossAmount: 0,
        riskRewardRatio: "N/A",
        takeProfitPercentageOnMargin: 0,
        stopLossPercentageOnMargin: 0,
        explanation: message.trim(),
        isValidInput: false,
      };
    }

    const { output } = await ai.generate({
        prompt: `User input:
        - Total Capital: $${input.capital}
        - Margin per trade: $${input.tradeSize}
        - Take Profit target (margin becomes): $${input.takeProfitValue}
        - Stop Loss target (margin becomes): $${input.stopLossValue}

        Calculate and explain based on the system prompt guidelines.`,
        system: systemPrompt,
        output: { schema: StrategyAssistantOutputSchema },
        model: 'googleai/gemini-2.0-flash', // or your preferred model
    });

    // Ensure the output from the LLM is correctly structured, 
    // especially if the LLM doesn't perfectly adhere to schema for complex explanations.
    // For now, we trust the LLM with the new system prompt.
    if (!output) {
        return {
            profitAmount: 0,
            lossAmount: 0,
            riskRewardRatio: "N/A",
            takeProfitPercentageOnMargin: 0,
            stopLossPercentageOnMargin: 0,
            explanation: "AI could not generate suggestions. Please try again.",
            isValidInput: false,
          };
    }
    
    // LLM should set isValidInput correctly based on system prompt instructions
    // If LLM doesn't do the math itself, we can do it here and merge with LLM's explanation
    // But the goal is for the LLM to do it all.
    // For robustness, we can recalculate if needed.
    const profitAmount = input.takeProfitValue - input.tradeSize;
    const lossAmount = input.tradeSize - input.stopLossValue;

    return {
        profitAmount: output.profitAmount !== undefined ? output.profitAmount : profitAmount,
        lossAmount: output.lossAmount !== undefined ? output.lossAmount : lossAmount,
        riskRewardRatio: output.riskRewardRatio || "N/A",
        takeProfitPercentageOnMargin: output.takeProfitPercentageOnMargin !== undefined ? output.takeProfitPercentageOnMargin : (profitAmount / input.tradeSize) * 100,
        stopLossPercentageOnMargin: output.stopLossPercentageOnMargin !== undefined ? output.stopLossPercentageOnMargin : (lossAmount / input.tradeSize) * 100,
        explanation: output.explanation || "No explanation provided.",
        isValidInput: output.isValidInput !== undefined ? output.isValidInput : true, // Assume valid if LLM doesn't say otherwise
    };
  }
);

    
