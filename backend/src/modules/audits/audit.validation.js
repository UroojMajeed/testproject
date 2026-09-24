import { z } from 'zod';
import { ENERGY_MIN, ENERGY_MAX } from '../../models/AuditWeek.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD');

/**
 * An entry names an activity either by id or by a name typed inline on the form.
 * One or the other, never both and never neither — ambiguity here would mean
 * silently creating a duplicate activity beside the one that was picked.
 */
const entrySchema = z
  .object({
    activityId: objectId.optional(),
    activityName: z.string().trim().min(1, 'Name the activity').max(120).optional(),

    // Whole minutes, and capped at a week: a number above that is a typo, and
    // accepting it would put a nonsense figure at the top of the dashboard.
    estimatedMinutes: z
      .number()
      .int('Durations are whole minutes')
      .min(0)
      .max(168 * 60, 'That is more than there is in a week'),

    energy: z
      .number()
      .int()
      .min(ENERGY_MIN, 'Energy runs from -2 to 2')
      .max(ENERGY_MAX, 'Energy runs from -2 to 2'),

    note: z.string().trim().max(280).optional().nullable(),
  })
  .strict()
  .refine((entry) => Boolean(entry.activityId) !== Boolean(entry.activityName), {
    message: 'Give either an existing activity or a new name, not both',
    path: ['activityId'],
  });

export const saveWeekSchema = {
  params: z.object({ weekStarting: isoDate }),
  body: z
    .object({
      // A dozen activities is the intended shape. Fifty is somebody pasting a
      // calendar export, which is a different feature.
      entries: z.array(entrySchema).max(50, 'That is more activities than this is meant for'),
      isTypical: z.boolean().optional(),
      status: z.enum(['draft', 'complete']).optional(),
    })
    .strict(),
};

export const weekParamSchema = { params: z.object({ weekStarting: isoDate }) };
