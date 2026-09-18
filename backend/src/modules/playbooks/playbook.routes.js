import { Router } from 'express';
import { z } from 'zod';
import * as service from './playbook.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { ROLES, FREQUENCY, CATEGORIES } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const idParam = { params: z.object({ id: objectId }) };

const stepInput = z.object({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(5000).default(''),
  assignedRole: z.string().max(80).nullish(),
  estimatedMinutes: z.number().int().min(0).max(1440).default(0),
  requiredInput: z.string().max(500).nullish(),
  expectedOutput: z.string().max(500).nullish(),
  approvalRequired: z.boolean().default(false),
});

const playbookBody = z.object({
  name: z.string().trim().min(1, 'Give the playbook a name').max(200),
  description: z.string().max(2000).nullish(),
  purpose: z.string().max(1000).nullish(),
  trigger: z.string().max(500).nullish(),
  ownerId: objectId.nullish(),
  frequency: z.enum(FREQUENCY).default('weekly'),
  category: z.enum(CATEGORIES).default('other'),
  requiredTools: z.array(z.string().max(80)).max(20).default([]),
  steps: z.array(stepInput).max(60).default([]),
  qualityChecklist: z.array(z.object({
    item: z.string().max(200),
    required: z.boolean().default(true),
  })).max(20).default([]),
});

export const playbookRouter = Router();
playbookRouter.use(requireAuth, tenantScope);

playbookRouter.get(
  '/',
  validate({ query: z.object({ status: z.enum(['draft', 'published', 'archived', 'all']).default('all') }).passthrough() }),
  asyncHandler(async (req, res) => ok(res, { playbooks: await service.listPlaybooks(req.workspaceId, req.query) })),
);

playbookRouter.post('/', validate({ body: playbookBody.strict() }),
  asyncHandler(async (req, res) =>
    created(res, { playbook: await service.createPlaybook(req.workspaceId, req.user._id, req.body) })));

playbookRouter.post(
  '/draft-from-task',
  validate({ body: z.object({ taskId: objectId }).strict() }),
  asyncHandler(async (req, res) =>
    created(res, { playbook: await service.draftFromTask(req.workspaceId, req.user._id, req.body.taskId) })),
);

playbookRouter.get('/:id', validate(idParam),
  asyncHandler(async (req, res) => ok(res, { playbook: await service.getPlaybook(req.workspaceId, req.params.id) })));

playbookRouter.patch('/:id', validate({ ...idParam, body: playbookBody.partial().strict() }),
  asyncHandler(async (req, res) =>
    ok(res, { playbook: await service.updatePlaybook(req.workspaceId, req.params.id, req.body) })));

playbookRouter.post('/:id/publish', requireRole(ROLES.MANAGER), validate(idParam),
  asyncHandler(async (req, res) =>
    ok(res, { playbook: await service.publishPlaybook(req.workspaceId, req.user._id, req.params.id) })));

playbookRouter.get('/:id/runs', validate(idParam),
  asyncHandler(async (req, res) => ok(res, { runs: await service.listRuns(req.workspaceId, req.params.id) })));

playbookRouter.post('/:id/runs', validate(idParam),
  asyncHandler(async (req, res) =>
    created(res, { run: await service.startRun(req.workspaceId, req.user._id, req.params.id) })));

playbookRouter.patch(
  '/runs/:id',
  validate({
    ...idParam,
    body: z.object({
      stepResults: z.array(z.object({
        stepId: objectId,
        done: z.boolean().optional(),
        notes: z.string().max(1000).nullish(),
      })).max(60).optional(),
      interventionCount: z.number().int().min(0).max(100).optional(),
    }).strict(),
  }),
  asyncHandler(async (req, res) => ok(res, { run: await service.updateRun(req.workspaceId, req.params.id, req.body) })),
);

playbookRouter.post(
  '/runs/:id/complete',
  validate({
    ...idParam,
    body: z.object({
      qualityScore: z.number().int().min(1).max(5).optional(),
      reviewNotes: z.string().max(1000).optional(),
    }).strict(),
  }),
  asyncHandler(async (req, res) => ok(res, { run: await service.completeRun(req.workspaceId, req.params.id, req.body) })),
);
