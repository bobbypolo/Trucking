import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createTaskSchema,
  updateTaskSchema,
  createWorkItemSchema,
  updateWorkItemSchema,
} from "../schemas/task";
import {
  taskRepository,
  workItemRepository,
} from "../repositories/task.repository";

const router = Router();

// ── Tasks ──────────────────────────────────────────────────────────

// GET /api/tasks — list tasks for tenant
router.get(
  "/api/tasks",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const tasks = await taskRepository.findByCompany(companyId, page, limit);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/tasks — create task
router.post(
  "/api/tasks",
  requireAuth,
  requireTenant,
  validateBody(createTaskSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const task = await taskRepository.create(req.body, companyId, userId);
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/tasks/:id — update task
router.patch(
  "/api/tasks/:id",
  requireAuth,
  requireTenant,
  validateBody(updateTaskSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await taskRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      const updated = await taskRepository.update(
        req.params.id,
        req.body,
        userId,
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

// ── Work Items ─────────────────────────────────────────────────────

// GET /api/work-items — list work items for tenant
router.get(
  "/api/work-items",
  requireAuth,
  requireTenant,
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const items = await workItemRepository.findByCompany(
        companyId,
        page,
        limit,
      );
      res.json(items);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/work-items — create work item
router.post(
  "/api/work-items",
  requireAuth,
  requireTenant,
  validateBody(createWorkItemSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const item = await workItemRepository.create(req.body, companyId, userId);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/work-items/:id — update work item
router.patch(
  "/api/work-items/:id",
  requireAuth,
  requireTenant,
  validateBody(updateWorkItemSchema),
  async (req: Request, res, next) => {
    const companyId = req.user!.tenantId;
    const userId = req.user!.uid;
    try {
      const existing = await workItemRepository.findById(req.params.id);
      if (!existing || existing.company_id !== companyId) {
        res.status(404).json({ error: "Work item not found" });
        return;
      }
      const updated = await workItemRepository.update(
        req.params.id,
        req.body,
        userId,
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
