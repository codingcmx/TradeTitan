
'use server';
/**
 * @fileOverview An AI assistant to suggest bot configuration parameters based on a natural language strategy description AND Pine Script.
 *
 * - suggestBotConfigParameters - A function that provides suggestions for bot config.
 * - StrategyConfigSuggesterInput - The input type. (Now includes pineScript and explanation separately in a combined string)
 * - StrategyConfigSuggesterOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// import type { BotConfig } from '@/types'; // Not directly outputting BotConfig, but SuggestedBotConfig

const StrategyConfigSuggesterInputSchema = z.object({
  // The strategyDescription will now be a combination of Pine Script and Explanation
  strategyDescription: z.string().min(10).describe('A combined string containing Pine Script and its natural language explanation.'),
  capital: z.number().positive().describe('The total available trading capital (for AI context, not for direct trade size calculation by AI).'),
});
export type StrategyConfigSuggesterInput = z.infer<typeof StrategyConfigSuggesterInputSchema>;

const SuggestedBotConfigSchema = z.object({
  targetSymbols: z.array(z.string()).optional().describe('Suggested target symbols if mentioned (e.g., ["BTCUSDT", "ETHUSDT"]). Prioritize Pine Script `tickerid` or similar.'),
  emaShortPeriod: z.number().int().positive().optional().describe('Suggested period for a short-term EMA (e.g., from Pine `input.int(9, "Short EMA")`).'),
  emaMediumPeriod: z.number().int().positive().optional().describe('Suggested period for a medium-term EMA (e.g., from Pine `input.int(21, "Medium EMA")`).'),
  emaLongPeriod: z.number().int().positive().optional().describe('Suggested period for a long-term EMA (e.g., from Pine `input.int(55, "Long EMA")`).'),
  atrPeriod: z.number().int().positive().optional().describe('Suggested period for ATR (e.g., from Pine `input.int(14, "ATR Period")`).'),
  // The AI is NOT expected to reliably suggest these multipliers from generic Pine/NL. User must set these.
  // stopLossMultiplier: z.number().positive().optional().describe('Suggested ATR multiplier for stop loss if explicitly determinable from a very clear pattern.'),
  // takeProfitMultiplier: z.number().positive().optional().describe('Suggested ATR multiplier for take profit if explicitly determinable.'),
}).describe("Suggested parameters for the bot configuration based on the user's Pine Script and strategy explanation. Only include fields if clearly inferable. Ensure periods are positive integers.");
export type SuggestedBotConfig = z.infer<typeof SuggestedBotConfigSchema>;


const StrategyConfigSuggesterOutputSchema = z.object({
  suggestions: SuggestedBotConfigSchema,
  aiAssumptions: z.string().optional().describe("Any assumptions the AI made (e.g., 'Assumed standard EMA usage for crossovers', 'Interpreted `input.int(X)` as a parameter')."),
  warnings: z.array(z.string()).optional().describe("Any warnings, parameters the AI couldn't determine, or indicators mentioned but not supported by the current config fields (e.g., 'Could not determine specific take profit levels from the description.', 'RSI mentioned; user needs to implement RSI logic in bot or use a bot supporting it.')."),
  summary: z.string().describe("A brief summary of the AI's understanding of the strategy and the parameters it suggested. This summary MUST remind the user to carefully review and MANUALLY SET critical risk management parameters like stop-loss and take-profit multipliers, as the AI does not suggest these."),
});
export type StrategyConfigSuggesterOutput = z.infer<typeof StrategyConfigSuggesterOutputSchema>;


export async function suggestBotConfigParameters(input: StrategyConfigSuggesterInput): Promise<StrategyConfigSuggesterOutput> {
  return strategyConfigSuggesterFlow(input);
}

const systemPrompt = `You are an AI Trading Strategy Configuration Assistant.
The user will provide their Pine Script code, a natural language explanation of the strategy, and their available capital.
Your goal is to extract relevant parameters primarily from the Pine Script (e.g., from \`input.int()\`, \`input.symbol()\`) and secondarily from the explanation to suggest values for a predefined set of bot configuration fields.

The bot configuration supports the following parameters that you can suggest values for from the Pine Script/explanation:
- targetSymbols: array of strings (e.g., ["BTCUSDT", "ETHUSDT"]). Look for \`tickerid\` in Pine Script or explicitly mentioned trading pairs. If "Bitcoin" is mentioned and no specific pair, suggest "BTCUSDT".
- emaShortPeriod: number (e.g., from \`ema(close, input.int(9, title="Short EMA"))\`). This is typically the fastest EMA.
- emaMediumPeriod: number (e.g., from \`ema(close, input.int(21, title="Mid EMA"))\`).
- emaLongPeriod: number (e.g., from \`ema(close, input.int(50, title="Long EMA"))\`).
- atrPeriod: number (e.g., from \`atr(input.int(14, title="ATR Period"))\`).

From the user's Pine Script and explanation:
1.  **Prioritize Pine Script for Parameters**:
    *   **Symbols**: Look for \`syminfo.tickerid\`, \`input.symbol()\`, or common ways symbols are defined or used in Pine Script.
    *   **EMAs**: Examine \`ta.ema()\` calls and their length arguments, especially if linked to \`input.int()\` definitions (e.g., \`len = input.int(9, "EMA Length")\`, then \`ta.ema(source, len)\`). Identify up to three distinct EMA periods and map them to short, medium, long based on their values.
    *   **ATR**: Examine \`ta.atr()\` calls and their length arguments, especially if linked to \`input.int()\`.
    *   If parameters are hardcoded in Pine Script (e.g., \`ta.ema(close, 10)\`), use those values.
2.  **Use Explanation for Clarification**: If Pine Script is ambiguous or uses variables without clear \`input\` definitions, use the natural language explanation to help infer the parameter values.
3.  **Handle Unclear Parameters**:
    *   If an EMA or ATR period is mentioned generically (e.g., "a fast EMA") without a number in Pine Script or explanation, do NOT suggest a value. State this in 'warnings'.
    *   If other indicators (RSI, MACD, etc.) are found in Pine Script or mentioned in the explanation, acknowledge them in 'summary' and add to 'warnings' that the current bot config fields don't directly support them.
4.  **Output**:
    *   Strictly adhere to 'StrategyConfigSuggesterOutputSchema'.
    *   Populate 'suggestions' only with parameters you confidently extracted. All periods MUST be positive integers.
    *   Use 'aiAssumptions' for any logical leaps (e.g., "Assumed 'EMA1' in comments refers to the 9-period EMA defined in inputs").
    *   Use 'warnings' for parameters not extractable or indicators not supported by the output schema.
    *   The 'summary' MUST remind the user:
        *   To review all AI suggestions.
        *   That they MUST MANUALLY set crucial risk management parameters like stop-loss multipliers and take-profit multipliers in the bot configuration section.
        *   That the provided capital (\`\${{{capital}}}\`) is for their context and they need to manage trade size/position sizing themselves.
        *   Explicitly state that YOU ARE NOT SUGGESTING stop-loss or take-profit multipliers.

User's combined strategy input (Pine Script and Explanation):
{{{strategyDescription}}}

User's capital: {{{capital}}}

Respond ONLY with a valid JSON object that conforms to the StrategyConfigSuggesterOutputSchema.
`;

const strategyConfigSuggesterFlow = ai.defineFlow(
  {
    name: 'strategyConfigSuggesterFlow',
    inputSchema: StrategyConfigSuggesterInputSchema,
    outputSchema: StrategyConfigSuggesterOutputSchema,
    // System prompt is complex, so we'll use it in the direct ai.generate call
    // prompt: systemPrompt, // Not using this here for more control
    model: 'googleai/gemini-2.0-flash', 
  },
  async (input) => {
    const { output } = await ai.generate({
        // prompt: input.strategyDescription, // This is now part of the system prompt's context via handlebars
        system: systemPrompt, // Pass the system prompt with handlebars for input
        input: input, // Provide the input for handlebars templating within the systemPrompt
        output: { schema: StrategyConfigSuggesterOutputSchema },
        model: 'googleai/gemini-2.0-flash',
      });

    if (!output) {
      return {
        suggestions: {},
        summary: "Sorry, I couldn't generate configuration suggestions at this time. The AI model did not return a valid response.",
        warnings: ["AI model did not return a valid response."],
      };
    }
    return output;
  }
);
