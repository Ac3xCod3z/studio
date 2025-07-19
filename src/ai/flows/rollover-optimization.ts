// src/ai/flows/rollover-optimization.ts
'use server';

/**
 * @fileOverview A flow for providing AI-powered rollover preference recommendations.
 *
 * - getRolloverRecommendation - A function that provides a rollover recommendation based on user input.
 * - RolloverOptimizationInput - The input type for the getRolloverRecommendation function.
 * - RolloverOptimizationOutput - The return type for the getRolloverRecommendation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RolloverOptimizationInputSchema = z.object({
  incomeLevel: z
    .number()
    .describe('The users monthly income level.'),
  financialGoals: z
    .string()
    .describe(
      'The users financial goals, e.g., saving for a house, paying off debt.'
    ),
});
export type RolloverOptimizationInput = z.infer<
  typeof RolloverOptimizationInputSchema
>;

const RolloverOptimizationOutputSchema = z.object({
  recommendation: z
    .string()
    .describe(
      'The recommended rollover strategy (carryover vs. reset) and reasoning.'
    ),
});
export type RolloverOptimizationOutput = z.infer<
  typeof RolloverOptimizationOutputSchema
>;

export async function getRolloverRecommendation(
  input: RolloverOptimizationInput
): Promise<RolloverOptimizationOutput> {
  return rolloverOptimizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'rolloverOptimizationPrompt',
  input: {schema: RolloverOptimizationInputSchema},
  output: {schema: RolloverOptimizationOutputSchema},
  prompt: `You are a financial advisor providing advice on rollover preferences for a budgeting application.

  Based on the user's income level and financial goals, recommend an optimal rollover strategy (carryover vs. reset).
  Explain your reasoning for the recommendation.

  Income Level: {{incomeLevel}}
  Financial Goals: {{financialGoals}}`,
});

const rolloverOptimizationFlow = ai.defineFlow(
  {
    name: 'rolloverOptimizationFlow',
    inputSchema: RolloverOptimizationInputSchema,
    outputSchema: RolloverOptimizationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
