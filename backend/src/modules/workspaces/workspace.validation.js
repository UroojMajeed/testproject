import { z } from 'zod';
import { INDUSTRIES } from '../../models/Workspace.js';
import { ROLE_VALUES } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const createWorkspaceSchema = {
  body: z
    .object({
      name: z.string().trim().min(1, 'Give your workspace a name').max(120),
      industry: z.enum(INDUSTRIES).default('other'),
      teamSize: z.string().max(32).optional(),
      timezone: z.string().max(64).default('UTC'),
      currency: z.string().length(3).toUpperCase().default('USD'),
    })
    .strict(),
};

export const workspaceIdSchema = { params: z.object({ id: objectId }) };

export const updateWorkspaceSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      industry: z.enum(INDUSTRIES).optional(),
      teamSize: z.string().max(32).optional(),
      timezone: z.string().max(64).optional(),
      currency: z.string().length(3).toUpperCase().optional(),
      workingHours: z
        .object({
          start: hhmm,
          end: hhmm,
          days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        })
        .optional(),
      weeklyBuybackGoalHours: z.number().min(0).max(168).optional(),
      currentWeeklyHours: z.number().min(0).max(168).optional(),
      targetWeeklyHours: z.number().min(0).max(168).optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, 'Nothing to update'),
};

export const buybackRateSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      annualCompensationMinor: z.number().int().min(0).max(1_000_000_00000),
      annualHours: z.number().int().min(1).max(8760),
      method: z.enum(['calculated', 'manual']).default('calculated'),
      amountMinor: z.number().int().min(0).optional(),
      overrideReason: z.string().max(500).optional(),
    })
    .strict()
    .refine((d) => d.method !== 'manual' || typeof d.amountMinor === 'number', {
      path: ['amountMinor'],
      message: 'A manual rate needs an amount',
    })
    .refine((d) => d.method !== 'manual' || Boolean(d.overrideReason?.trim()), {
      path: ['overrideReason'],
      message: 'Say why you are overriding the calculated rate',
    }),
};

export const onboardingSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      step: z.number().int().min(1).max(10).optional(),
      completed: z.boolean().optional(),
      skipped: z.array(z.string().max(40)).max(10).optional(),
    })
    .strict(),
};

export const inviteSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      role: z.enum(ROLE_VALUES.filter((r) => r !== 'owner')),
    })
    .strict(),
};
