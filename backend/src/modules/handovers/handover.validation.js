import { z } from 'zod';
import { STEP_KEYS } from './handover.steps.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');

export const startHandoverSchema = {
  body: z.object({ activityId: objectId }).strict(),
};

export const handoverIdSchema = {
  params: z.object({ id: objectId }),
};

export const setStepSchema = {
  params: z.object({ id: objectId, key: z.enum(STEP_KEYS) }),
  body: z.object({ done: z.boolean() }).strict(),
};

export const updateHandoverSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    assignee: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
    .strict()
    // An empty patch is almost always a client bug, and answering 200 to it hides
    // the bug behind a success.
    .refine((v) => Object.keys(v).length > 0, 'Nothing to change'),
};
