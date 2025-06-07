
'use server';
/**
 * @fileOverview An AI flow to validate consistency between Pine Script and its natural language explanation.
 *
 * - validateStrategyConsistency - A function that compares Pine Script with its explanation.
 * - StrategyValidationInput - The input type for the validateStrategyConsistency function.
 * - StrategyValidationOutput - The return type for the validateStrategyConsistency function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const StrategyValidationInputSchema = z.object({
  pineScript: z.string().describe('The Pine Script code of the trading strategy.'),
  explanation: z.string().describe('The natural language explanation of the trading strategy.'),
});
export type StrategyValidationInput = z.infer<typeof StrategyValidationInputSchema>;

const StrategyValidationOutputSchema = z.object({
  isConsistent: z.boolean().describe('True if the Pine Script and explanation are generally consistent, false if significant mismatches are found.'),
  feedback: z.string().describe('Detailed analysis, highlighting mismatches or confirming consistency.'),
});
export type StrategyValidationOutput = z.infer<typeof StrategyValidationOutputSchema>;

export async function validateStrategyConsistency(input: StrategyValidationInput): Promise<StrategyValidationOutput> {
  return strategyValidatorFlow(input);
}

const systemPrompt = `You are an AI assistant specializing in analyzing trading strategies. You will be given a Pine Script and a natural language explanation of that script.
Your task is to compare the Pine Script with the explanation and identify any significant mismatches or inconsistencies in their described logic.

Analyze both. Focus on:
- Key indicators used (e.g., EMA, RSI, MACD) and their parameters.
- Entry conditions for long and short trades (e.g., crossovers, threshold breaches).
- Exit conditions (take profit levels, stop loss mechanisms, other exit signals).
- Risk management aspects mentioned (e.g., position sizing, max drawdown).

If you find significant discrepancies between the Pine Script logic and the textual explanation, clearly point them out.
If they appear to be generally consistent, state that.

Respond ONLY with a JSON object adhering to the StrategyValidationOutputSchema.
The 'feedback' field should contain your detailed analysis.
If there are mismatches, provide specific examples in the feedback if possible.
`;

const strategyValidatorFlow = ai.defineFlow(
  {
    name: 'strategyValidatorFlow',
    inputSchema: StrategyValidationInputSchema,
    outputSchema: StrategyValidationOutputSchema,
  },
  async (input) => {
    if (!input.pineScript || !input.explanation) {
        return {
            isConsistent: false,
            feedback: "Pine Script and/or explanation is missing. Please provide both to validate consistency."
        }
    }

    const { output } = await ai.generate({
      prompt: `Pine Script:\n\`\`\`pinescript\n${input.pineScript}\n\`\`\`\n\nExplanation:\n\`\`\`\n${input.explanation}\n\`\`\``,
      system: systemPrompt,
      output: { schema: StrategyValidationOutputSchema },
      model: 'googleai/gemini-2.0-flash', // Ensure this model is suitable
    });

    if (!output) {
      return {
        isConsistent: false,
        feedback: "Sorry, I couldn't analyze the strategy right now. The AI model did not return a valid response. Please try again later.",
      };
    }
    return output;
  }
);
