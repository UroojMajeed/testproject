import { z } from 'zod';

/**
 * Income arrives in minor units as an integer, because money is never a float.
 * The client does the major-to-minor conversion at the edge, where it knows what
 * the person typed.
 */
export const setRateSchema = {
  body: z
    .object({
      annualIncomeMinor: z
        .number()
        .int('Amounts are whole minor units — pence, cents')
        .min(0, 'Income cannot be negative')
        // A hundred million major units. Past this it is a typo or a currency
        // mix-up, and either way the rate would be nonsense.
        .max(10_000_000_000, 'That figure looks like a mistake'),

      hoursPerWeek: z
        .number()
        .int('Whole hours')
        .min(1, 'At least one hour a week')
        .max(168, 'There are only 168 hours in a week'),

      weeksPerYear: z
        .number()
        .int('Whole weeks')
        .min(1, 'At least one week a year')
        .max(52, 'There are only 52 weeks in a year'),
    })
    .strict(),
};
