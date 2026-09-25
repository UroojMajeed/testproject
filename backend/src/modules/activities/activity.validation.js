import { z } from 'zod';
import { ACTIVITY_VALUES } from '../../models/Activity.js';

const name = z.string().trim().min(1, 'Name the activity').max(120, 'That name is too long');

export const createActivitySchema = { body: z.object({ name }).strict() };
export const renameActivitySchema = {
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id') }),
  body: z.object({ name }).strict(),
};
export const activityIdSchema = {
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id') }),
};

export const setValueSchema = {
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id') }),
  body: z
    .object({
      // The three answers, and nothing else. An unrecognised value would end up
      // deciding a quadrant, and the quadrant decides whether somebody hires.
      value: z.enum(ACTIVITY_VALUES, {
        errorMap: () => ({ message: 'Choose what happens if you stopped for a month' }),
      }),
    })
    .strict(),
};
