import { z } from 'zod';
import { CATEGORIES, ENERGY, VALUE } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

export const startSchema = {
  body: z.object({
    source: z.enum(['calendar', 'recall']).default('recall'),
    windowDays: z.number().int().min(1).max(31).default(7),
    /**
     * Activities the user recalls, or events pulled from a calendar. The server
     * groups them; the client never decides the grouping.
     */
    activities: z.array(
      z.object({
        title: z.string().trim().min(1).max(200),
        durationMinutes: z.number().int().min(1).max(1440),
        startAt: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
        category: z.enum(CATEGORIES).optional(),
        externalId: z.string().max(200).optional(),
      }),
    ).min(1, 'Add at least one activity').max(300),
  }).strict(),
};

export const classifySchema = {
  params: z.object({ id: objectId, groupId: objectId }),
  body: z.object({
    energy: z.nativeEnum(ENERGY),
    value: z.nativeEnum(VALUE),
    category: z.enum(CATEGORIES).optional(),
  }).strict(),
};

export const skipSchema = { params: z.object({ id: objectId, groupId: objectId }) };
export const idSchema = { params: z.object({ id: objectId }) };
