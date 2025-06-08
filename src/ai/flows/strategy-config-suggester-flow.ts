
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

const StrategyConfigSuggesterInputSchema = z.object({
  strategyDescription: z.string().min(10).describe('A combined string containing Pine Script (if provided) and its natural language explanation.'),
  capital: z.number().positive().describe('The total available trading capital (for AI context, not for direct trade size calculation by AI).'),
});
export type StrategyConfigSuggesterInput = z.infer<typeof StrategyConfigSuggesterInputSchema>;

const SuggestedBotConfigSchema = z.object({
  targetSymbols: z.array(z.string()).optional().describe('Suggested target symbols if mentioned (e.g., ["BTCUSDT", "ETHUSDT"]). Prioritize Pine Script `tickerid` or similar.'),
  emaShortPeriod: z.number().int().positive().optional().describe('Suggested period for a short-term EMA (e.g., from Pine `input.int(9, "Short EMA")`).'),
  emaMediumPeriod: z.number().int().positive().optional().describe('Suggested period for a medium-term EMA (e.g., from Pine `input.int(21, "Medium EMA")`).'),
  emaLongPeriod: z.number().int().positive().optional().describe('Suggested period for a long-term EMA (e.g., from Pine `input.int(55, "Long EMA")`).'),
  atrPeriod: z.number().int().positive().optional().describe('Suggested period for ATR (e.g., from Pine `input.int(14, "ATR Period")`).'),
}).describe("Suggested parameters for the bot configuration based on the user's Pine Script and strategy explanation. Only include fields if clearly inferable. Ensure periods are positive integers.");
export type SuggestedBotConfig = z.infer<typeof SuggestedBotConfigSchema>;


const StrategyConfigSuggesterOutputSchema = z.object({
  suggestions: SuggestedBotConfigSchema,
  aiAssumptions: z.string().optional().describe("Any assumptions the AI made (e.g., 'Assumed standard EMA usage for crossovers', 'Interpreted `input.int(X)` as a parameter')."),
  warnings: z.array(z.string()).optional().describe("Any warnings, parameters the AI couldn't determine, or indicators mentioned but not supported by the current config fields (e.g., 'Could not determine specific take profit levels from the description.', 'RSI mentioned; user needs to implement RSI logic in bot or use a bot supporting it.')."),
  summary: z.string().describe("A brief summary of the AI's understanding of the strategy and the parameters it suggested. This summary MUST remind the user to carefully review and MANUALLY SET critical risk management parameters like stop-loss and take-profit multipliers, as the AI does not suggest these from Pine Script or general explanations."),
});
export type StrategyConfigSuggesterOutput = z.infer<typeof StrategyConfigSuggesterOutputSchema>;


export async function suggestBotConfigParameters(input: StrategyConfigSuggesterInput): Promise<StrategyConfigSuggesterOutput> {
  return strategyConfigSuggesterFlow(input);
}

// This system prompt now emphasizes extracting parameters directly from Pine Script first.
const systemPrompt = `You are an AI Trading Strategy Configuration Assistant.
The user will provide their Pine Script code (if any), a natural language explanation of the strategy, and their available capital.
Your goal is to extract relevant parameters PRIMARILY from the Pine Script and SECONDARILY from the explanation to suggest values for a predefined set of bot configuration fields.

The bot configuration supports the following parameters that you can suggest values for:
- targetSymbols: array of strings (e.g., ["BTCUSDT", "ETHUSDT"]). In Pine Script, look for \`tickerid\`, \`syminfo.tickerid\`, \`input.symbol()\`, or how symbols are referenced (e.g., \`request.security("BTCUSDT", ...)\`). If the explanation mentions specific pairs, use those if Pine is unclear. If "Bitcoin" is mentioned and no specific pair, suggest "BTCUSDT".
- emaShortPeriod: number. Examine Pine Script for \`ta.ema()\` calls and their length arguments, especially if linked to \`input.int()\` (e.g., \`len = input.int(9, title="Short EMA")\`, then \`ta.ema(source, len)\`). Identify the shortest EMA period.
- emaMediumPeriod: number. Identify a medium-length EMA period from Pine Script similarly.
- emaLongPeriod: number. Identify the longest EMA period from Pine Script similarly.
- atrPeriod: number. Examine Pine Script for \`ta.atr()\` calls and their length arguments, especially if linked to \`input.int()\`.

Instructions:
1.  **Prioritize Pine Script for Parameters**:
    *   If Pine Script is provided, meticulously parse it for \`input.int()\`, \`input.symbol()\`, explicit numerical values in \`ta.ema(..., length_value)\` or \`ta.atr(length_value)\`, and symbol references. These are your primary source.
    *   Map distinct EMA periods found (up to three) to short, medium, and long based on their numerical values (smallest is short, largest is long).
2.  **Use Explanation for Clarification**: If Pine Script is missing, ambiguous, or uses variables without clear \`input\` definitions, use the natural language explanation to help infer parameter values. If both are provided, Pine Script takes precedence for parameter values.
3.  **Handle Unclear or Unsupported Parameters**:
    *   If an EMA or ATR period is mentioned generically (e.g., "a fast EMA") without a number in Pine Script or explanation, do NOT suggest a value for it. State this in 'warnings'.
    *   The AI should NOT suggest values for stop-loss multipliers or take-profit multipliers. These are risk management decisions the user must make.
    *   If other indicators (RSI, MACD, etc.) are found in Pine Script or mentioned in the explanation, acknowledge them in 'summary' and add to 'warnings' that the current bot config fields don't directly support them (meaning, the user would need a bot that can interpret those signals or implement custom logic).
4.  **Output**:
    *   Strictly adhere to 'StrategyConfigSuggesterOutputSchema'.
    *   Populate 'suggestions' only with parameters you confidently extracted (primarily from Pine Script if available). All periods MUST be positive integers.
    *   Use 'aiAssumptions' for any logical leaps (e.g., "Assumed 'EMA1' in comments refers to the 9-period EMA defined in inputs").
    *   The 'summary' MUST:
        *   State what parameters were extracted (and from where, e.g., "Extracted EMA period of 9 from Pine Script input.").
        *   Remind the user to review all AI suggestions carefully.
        *   Emphasize that they MUST MANUALLY SET crucial risk management parameters like stop-loss multipliers and take-profit multipliers in the bot configuration section of the Strategy Hub.
        *   Mention that the provided capital (\`\${{{capital}}}\`) is for their context, and they need to manage trade size/position sizing themselves within their bot's logic or exchange settings.
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
    model: 'googleai/gemini-2.0-flash', 
  },
  async (input) => {
    const { output } = await ai.generate({
        system: systemPrompt, 
        input: input, 
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
