
'use server';
/**
 * @fileOverview An AI assistant to suggest bot configuration parameters based on a natural language strategy description.
 *
 * - suggestBotConfigParameters - A function that provides suggestions for bot config.
 * - StrategyConfigSuggesterInput - The input type.
 * - StrategyConfigSuggesterOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { BotConfig } from '@/types'; // Assuming BotConfig is in types

const StrategyConfigSuggesterInputSchema = z.object({
  strategyDescription: z.string().min(10).describe('A natural language description of the trading strategy.'),
  capital: z.number().positive().describe('The total available trading capital.'),
});
export type StrategyConfigSuggesterInput = z.infer<typeof StrategyConfigSuggesterInputSchema>;

// Zod schema for the 'suggestions' part of the output, mapping to BotConfig fields
const SuggestedBotConfigSchema = z.object({
  targetSymbols: z.array(z.string()).optional().describe('Suggested target symbols if mentioned (e.g., ["BTCUSDT", "ETHUSDT"]).'),
  emaShortPeriod: z.number().int().positive().optional().describe('Suggested period for a short-term Exponential Moving Average if mentioned (e.g., 9, 12).'),
  emaMediumPeriod: z.number().int().positive().optional().describe('Suggested period for a medium-term Exponential Moving Average if mentioned (e.g., 21, 26).'),
  emaLongPeriod: z.number().int().positive().optional().describe('Suggested period for a long-term Exponential Moving Average if mentioned (e.g., 50, 100, 200).'),
  atrPeriod: z.number().int().positive().optional().describe('Suggested period for Average True Range (ATR) if mentioned (e.g., 14).'),
  // We are not asking the AI to suggest these yet, as they are complex to derive from NL + budget.
  // User should set these based on risk tolerance and ATR understanding.
  // stopLossMultiplier: z.number().positive().optional().describe('Suggested ATR multiplier for stop loss if determinable.'),
  // takeProfitMultiplier: z.number().positive().optional().describe('Suggested ATR multiplier for take profit if determinable.'),
}).describe("Suggested parameters for the bot configuration based on the user's strategy description. Only include fields if clearly inferable from the description. Ensure periods are positive integers.");
export type SuggestedBotConfig = z.infer<typeof SuggestedBotConfigSchema>;


const StrategyConfigSuggesterOutputSchema = z.object({
  suggestions: SuggestedBotConfigSchema,
  aiAssumptions: z.string().optional().describe("Any assumptions the AI made while deriving the parameters (e.g., 'Assumed standard EMA usage for crossovers', 'Assumed common default period for unspecified indicators')."),
  warnings: z.array(z.string()).optional().describe("Any warnings, parameters the AI couldn't determine, or indicators mentioned but not supported by the current config fields (e.g., 'Could not determine specific take profit levels from the description.', 'RSI period mentioned but not a direct config field. User should configure this manually if their bot supports it.')."),
  summary: z.string().describe("A brief summary of the AI's understanding of the strategy and the parameters it suggested. This summary should also remind the user to carefully review and adjust parameters, especially risk management settings like stop-loss and take-profit multipliers, based on their capital and risk tolerance, as these are not directly suggested by the AI."),
});
export type StrategyConfigSuggesterOutput = z.infer<typeof StrategyConfigSuggesterOutputSchema>;


export async function suggestBotConfigParameters(input: StrategyConfigSuggesterInput): Promise<StrategyConfigSuggesterOutput> {
  return strategyConfigSuggesterFlow(input);
}

const systemPrompt = `You are an AI Trading Strategy Configuration Assistant.
The user will provide a natural language description of their trading strategy and their available capital.
Your goal is to extract relevant parameters from the strategy description and suggest values for a predefined set of bot configuration fields.

The bot configuration supports the following parameters that you can suggest values for:
- targetSymbols: array of strings (e.g., ["BTCUSDT", "ETHUSDT"]). Look for explicitly mentioned trading pairs.
- emaShortPeriod: number (e.g., for EMA 9, EMA 10, EMA 12). This is typically the fastest EMA in a multi-EMA strategy.
- emaMediumPeriod: number (e.g., EMA 20, EMA 21, EMA 26). This is the middle EMA or the slower EMA in a two-EMA strategy.
- emaLongPeriod: number (e.g., EMA 50, EMA 100, EMA 200). This is the slowest EMA in a three-EMA strategy.
- atrPeriod: number (for Average True Range period, e.g., 14).

From the user's strategy description:
1.  **Parse Strategy Details**:
    *   **Symbols**: Identify any explicitly mentioned trading symbols (e.g., "I want to trade Bitcoin and Ethereum against USDT"). If specific pairs like "BTCUSDT" are mentioned, use those. If "Bitcoin" is mentioned, suggest "BTCUSDT".
    *   **EMAs**: Look for mentions of Exponential Moving Averages (EMAs) and their periods.
        *   If one EMA period is mentioned (e.g., "use a 10-period EMA"), suggest it for 'emaShortPeriod'.
        *   If two EMA periods are mentioned (e.g., "when the 10 EMA crosses above the 20 EMA"), assign the smaller number to 'emaShortPeriod' and the larger number to 'emaMediumPeriod'.
        *   If three EMA periods are mentioned (e.g., "buy when 9 EMA is above 21 EMA, and 21 EMA is above 55 EMA"), assign them to 'emaShortPeriod', 'emaMediumPeriod', and 'emaLongPeriod' in increasing order of their numerical value.
        *   If generic terms like "fast EMA", "slow EMA" are used without numbers, try to infer common values or state in 'aiAssumptions' if you pick a default (e.g., "fast EMA" as 9, "slow EMA" as 21). If no numbers are given at all for EMAs, do not suggest EMA periods.
    *   **ATR**: Look for mentions of Average True Range (ATR) and its period (e.g., "ATR 14 for volatility"). Suggest this for 'atrPeriod'.
    *   **Other Indicators**: If other indicators like RSI, MACD, Bollinger Bands, etc., are mentioned, acknowledge them in your 'summary' and add a note to the 'warnings' array stating that while the indicator was mentioned, the current bot configuration fields do not directly support its parameters, and the user would need to configure this manually if their bot's underlying code supports it.

2.  **Populate Output**:
    *   Strictly adhere to the 'StrategyConfigSuggesterOutputSchema'.
    *   Populate the 'suggestions' object with the parameters you could confidently extract as numbers (for periods) or strings (for symbols). All periods must be positive integers.
    *   Use 'aiAssumptions' to list any assumptions made (e.g., "Assumed 'fast EMA' refers to the shortest period mentioned if multiple options were possible", "Assumed common default period like 14 for an unspecified ATR").
    *   Use 'warnings' for parameters mentioned by the user but not extractable, not fitting the schema (e.g., non-integer period), or for indicators not directly supported by the suggestion fields.
    *   Provide a concise 'summary' of your understanding. This summary MUST include:
        *   A brief restatement of the core strategy elements you identified.
        *   The parameters you are suggesting.
        *   A reminder that the user's provided capital of \`\${{{capital}}}\` should be considered for their own risk management and position sizing logic, which they must set themselves (e.g. stop-loss multipliers, take-profit multipliers, trade size). Explicitly state that you are NOT suggesting specific stop-loss or take-profit multipliers.

3.  **Important Considerations**:
    *   If a parameter is not clearly mentioned or inferable, do not include it in the 'suggestions' object. It's better to omit a suggestion than to guess wildly.
    *   Focus only on the parameters defined in the 'SuggestedBotConfigSchema' for the 'suggestions' field.
    *   If the user's description is too vague to extract any specific numerical parameters for EMAs or ATR, the 'suggestions' object might be empty or only contain 'targetSymbols'. This is acceptable. Your summary should reflect this.

User's strategy description: {{{strategyDescription}}}
User's capital: {{{capital}}}

Respond ONLY with a valid JSON object that conforms to the StrategyConfigSuggesterOutputSchema.
`;

const strategyConfigSuggesterFlow = ai.defineFlow(
  {
    name: 'strategyConfigSuggesterFlow',
    inputSchema: StrategyConfigSuggesterInputSchema,
    outputSchema: StrategyConfigSuggesterOutputSchema,
    prompt: systemPrompt, // Using direct prompt for this structure
    model: 'googleai/gemini-2.0-flash', // or another suitable model
  },
  async (input) => {
    // The 'prompt' field in defineFlow with system and user messages is newer syntax.
    // For this older structure using 'prompt' directly with handlebars, we make a direct call.
    // This flow definition is primarily for making it callable and defining schema.
    // The actual LLM call needs to be structured to pass the input to the prompt template.

    // Since the prompt is defined in the flow config, Genkit handles templating.
    // We just need to ensure the LLM call is made correctly if we were to customize logic here.
    // However, with 'prompt' in flow definition, Genkit does this:
    const { output } = await ai.generate({
        prompt: systemPrompt, // The prompt defined in the flow config which includes handlebars for input
        input: input, // Pass the actual input for handlebars templating
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
