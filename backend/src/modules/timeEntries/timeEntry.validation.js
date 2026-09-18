import { z } from 'zod';
import { CATEGORIES, ENERGY, VALUE, ENTRY_SOURCE, PRECISION } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');
const isoDate = z.string().datetime({ offset: true }).or(z.string().date());

export const listSchema = {
  query: z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    taskId: objectId.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  }).passthrough(),
};

export const createSchema = {
  body: z.object({
    title: z.string().trim().min(1, 'What did you work on?').max(200),
    notes: z.string().max(2000).optional(),
    date: isoDate,
    startAt: isoDate.nullish(),
    endAt: isoDate.nullish(),
    durationMinutes: z.number().int().min(1, 'A minute is the smallest entry').max(1440),
    category: z.enum(CATEGORIES).default('other'),
    energy: z.nativeEnum(ENERGY).default(ENERGY.NEUTRAL),
    value: z.nativeEnum(VALUE).default(VALUE.MEDIUM),
    source: z.enum(ENTRY_SOURCE).default('manual'),
    precision: z.enum(PRECISION).default('timed'),
    taskId: objectId.nullish(),
  }).strict(),
};

export const updateSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.string().max(2000).nullish(),
    durationMinutes: z.number().int().min(1).max(1440).optional(),
    category: z.enum(CATEGORIES).optional(),
    energy: z.nativeEnum(ENERGY).optional(),
    value: z.nativeEnum(VALUE).optional(),
    date: isoDate.optional(),
  }).strict().refine((d) => Object.keys(d).length > 0, 'Nothing to update'),
};

export const idSchema = { params: z.object({ id: objectId }) };

export const summarySchema = {
  query: z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    scope: z.enum(['me', 'workspace']).default('me'),
  }).passthrough(),
};
