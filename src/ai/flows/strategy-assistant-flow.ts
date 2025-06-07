
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
  explanation: z.string().describe('A conversational explanation of the calculations, the role of leverage, and guidance for bot configuration or manual trading. This explanation should directly state the key calculated figures.'),
  isValidInput: z.boolean().describe('Whether the input values were valid for calculation.')
});
export type StrategyAssistantOutput = z.infer<typeof StrategyAssistantOutputSchema>;

export async function getStrategySuggestions(input: StrategyAssistantInput): Promise<StrategyAssistantOutput> {
  return strategyAssistantFlow(input);
}

const systemPrompt = `You are a friendly and helpful trading strategy assistant. The user has provided their financial parameters for a single trade.
Your task is to reply directly to the user, explaining the implications of their inputs.

1.  **Validate Inputs**: First, internally check if:
    *   Trade size is positive.
    *   Take profit value is greater than trade size.
    *   Stop loss value is less than trade size.
    *   Trade size does not exceed capital.
    *   If any of these are invalid, set 'isValidInput' to false in the JSON output and provide a polite, user-friendly message in the 'explanation' field explaining the issue. Do not proceed with calculations if inputs are invalid.

2.  **Perform Calculations** (if inputs are valid):
    *   Profit Amount = (user's takeProfitValue) - (user's tradeSize)
    *   Loss Amount = (user's tradeSize) - (user's stopLossValue)
    *   Risk/Reward Ratio: Calculate as Profit Amount / Loss Amount. Present as a simplified ratio string like "2:1" or "1:1.5". Handle division by zero if Loss Amount is 0 (e.g., "N/A" or "Infinite").
    *   Take Profit % on Margin = (Profit Amount / user's tradeSize) * 100
    *   Stop Loss % on Margin = (Loss Amount / user's tradeSize) * 100
    (These calculations are for your internal use to populate the output JSON fields. The user's input values like 'takeProfitValue' and 'tradeSize' will be provided in their message to you.)

3.  **Generate Conversational Explanation**:
    *   Start by acknowledging their input (which will be provided in the user's message).
    *   Clearly state the calculated **Profit Amount** (e.g., "If your trade hits its take profit, you'd make $[Profit Amount]...").
    *   Clearly state the calculated **Loss Amount** (e.g., "...and if it hits your stop loss, you'd lose $[Loss Amount].").
    *   State the **Risk/Reward Ratio** (e.g., "This gives you a risk/reward ratio of [Risk/Reward Ratio].").
    *   Explain the **Take Profit Percentage on Margin**. Use the user's provided 'takeProfitValue' and 'tradeSize' from their message, and your calculated 'takeProfitPercentageOnMargin' from the output JSON. For example: "Your take profit target of $[user's provided takeProfitValue] on a $[user's provided tradeSize] margin means you're aiming for a [takeProfitPercentageOnMargin]% gain on your margin for this trade."
    *   Explain the **Stop Loss Percentage on Margin** similarly, using the user's 'stopLossValue', 'tradeSize', and your calculated 'stopLossPercentageOnMargin'. For example: "Your stop loss target of $[user's provided stopLossValue] on a $[user's provided tradeSize] margin means you'd accept a [stopLossPercentageOnMargin]% loss on your margin for this trade."
    *   **Explain Conceptual Leverage**: Describe how these margin percentages relate to underlying asset price movements and leverage. For example: "To achieve a [takeProfitPercentageOnMargin]% profit on your margin, if the underlying asset's price moves 1% in your favor (without considering fees), you'd conceptually need about {[takeProfitPercentageOnMargin] / 1}x leverage. If the price moves 2% in your favor, you'd need about {[takeProfitPercentageOnMargin] / 2}x leverage." Provide a similar example for the stop loss percentage. Emphasize this is conceptual and actual outcomes depend on the leverage set on their Binance account for the specific symbol.
    *   **Guidance for Action**: Briefly explain that these calculated percentages (TP: [takeProfitPercentageOnMargin]%, SL: [stopLossPercentageOnMargin]%) are key figures they can use. For example: "You can use these percentages (TP: [takeProfitPercentageOnMargin]%, SL: [stopLossPercentageOnMargin]%) when setting up your trading bot if it supports percentage-based targets, or to inform your manual trading decisions."
    *   Maintain a helpful and clear tone.

4.  **Output Format**:
    *   Return ONLY a JSON object adhering to the StrategyAssistantOutputSchema.
    *   Ensure 'isValidInput' is true if calculations were performed, false otherwise.
    *   The 'explanation' field should contain your full conversational reply to the user, incorporating the calculated values.
    *   The other fields in the schema (profitAmount, lossAmount, etc.) should be populated with the raw calculated numbers.
`;

const strategyAssistantFlow = ai.defineFlow(
  {
    name: 'strategyAssistantFlow',
    inputSchema: StrategyAssistantInputSchema,
    outputSchema: StrategyAssistantOutputSchema,
  },
  async (input) => {
    // Perform initial validation before calling the LLM, as the LLM might not always adhere strictly
    if (input.tradeSize <= 0 || input.takeProfitValue <= input.tradeSize || input.stopLossValue >= input.tradeSize || input.tradeSize > input.capital) {
      let message = "It looks like there's an issue with the values you provided: ";
      if (input.tradeSize <= 0) message += "Trade size must be a positive number. ";
      if (input.tradeSize > input.capital) message += "Trade size cannot be greater than your total capital. ";
      if (input.takeProfitValue <= input.tradeSize) message += "Your take profit value should be higher than your trade size. ";
      if (input.stopLossValue >= input.tradeSize) message += "Your stop loss value should be lower than your trade size. ";
      
      return {
        profitAmount: 0,
        lossAmount: 0,
        riskRewardRatio: "N/A",
        takeProfitPercentageOnMargin: 0,
        stopLossPercentageOnMargin: 0,
        explanation: message.trim() + "Please adjust them and try again!",
        isValidInput: false,
      };
    }

    // Construct the prompt for the LLM, including the user's input for context
    const userContextPrompt = `Okay, I have $${input.capital} capital. I want to place trades of $${input.tradeSize} each. I want to take profit when my $${input.tradeSize} margin becomes $${input.takeProfitValue}, and set a stop loss if it drops to $${input.stopLossValue}. What should I know?`;

    const { output } = await ai.generate({
        prompt: userContextPrompt, // This provides the user's specific scenario to the LLM
        system: systemPrompt, // This provides the detailed instructions on how to respond
        output: { schema: StrategyAssistantOutputSchema },
        model: 'googleai/gemini-2.0-flash', 
    });

    if (!output) {
        return {
            profitAmount: 0,
            lossAmount: 0,
            riskRewardRatio: "N/A",
            takeProfitPercentageOnMargin: 0,
            stopLossPercentageOnMargin: 0,
            explanation: "Sorry, I couldn't generate suggestions right now. Please try again later.",
            isValidInput: false, 
          };
    }
    
    // The LLM is expected to set isValidInput based on the system prompt.
    // We also trust the LLM to perform calculations and include them in the explanation.
    // If isValidInput is false from the LLM, its explanation should state why.
    if (output.isValidInput === false && output.explanation) {
        return {
            ...output, 
            profitAmount: output.profitAmount || 0,
            lossAmount: output.lossAmount || 0,
            riskRewardRatio: output.riskRewardRatio || "N/A",
            takeProfitPercentageOnMargin: output.takeProfitPercentageOnMargin || 0,
            stopLossPercentageOnMargin: output.stopLossPercentageOnMargin || 0,
        };
    }
    
    // If LLM says valid, but somehow missed calculations (fallback, should ideally not happen)
    // This is more of a safeguard; the LLM should be doing this based on the system prompt.
    const profitAmount = input.takeProfitValue - input.tradeSize;
    const lossAmount = input.tradeSize - input.stopLossValue;
    const tpPercentage = (profitAmount / input.tradeSize) * 100;
    const slPercentage = (lossAmount / input.tradeSize) * 100;
    let rrRatio = "N/A";
    if (lossAmount > 0) {
        const ratio = profitAmount / lossAmount;
        // Simplify ratio, e.g., 2:1, 1:1.5. For simplicity, just present the number.
        rrRatio = `${ratio.toFixed(1)}:1`; 
    } else if (profitAmount > 0 && lossAmount === 0) {
        rrRatio = "Infinite (SL at entry)";
    }


    return {
        profitAmount: output.profitAmount !== undefined ? output.profitAmount : profitAmount,
        lossAmount: output.lossAmount !== undefined ? output.lossAmount : lossAmount,
        riskRewardRatio: output.riskRewardRatio || rrRatio,
        takeProfitPercentageOnMargin: output.takeProfitPercentageOnMargin !== undefined ? output.takeProfitPercentageOnMargin : tpPercentage,
        stopLossPercentageOnMargin: output.stopLossPercentageOnMargin !== undefined ? output.stopLossPercentageOnMargin : slPercentage,
        explanation: output.explanation || "No explanation provided by AI.", 
        isValidInput: output.isValidInput !== undefined ? output.isValidInput : true, 
    };
  }
);
