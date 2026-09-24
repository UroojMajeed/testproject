import { z } from 'zod';

const name = z.string().trim().min(1, 'Name the activity').max(120, 'That name is too long');

export const createActivitySchema = { body: z.object({ name }).strict() };
export const renameActivitySchema = {
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id') }),
  body: z.object({ name }).strict(),
};
export const activityIdSchema = {
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id') }),
};
