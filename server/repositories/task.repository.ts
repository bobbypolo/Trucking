import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";
import { buildSafeUpdate } from "../lib/safe-update";

const TASK_UPDATABLE_COLUMNS = [
  "type",
  "title",
  "description",
  "status",
  "priority",
  "assignee_id",
  "assigned_to",
  "due_date",
  "links",
] as const;

const WORK_ITEM_UPDATABLE_COLUMNS = [
  "type",
  "label",
  "description",
  "priority",
  "status",
  "sla_deadline",
  "assignee_id",
  "entity_type",
  "entity_id",
] as const;

export const taskRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM operational_tasks WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as RowDataPacket[];
  },

  async findById(id: string, companyId: string) {
    const [rows] = await pool.query(
      "SELECT * FROM operational_tasks WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return (rows as RowDataPacket[])[0] || null;
  },

  async create(data: Record<string, unknown>, companyId: string, userId: string) {
    const id = (data.id as string | undefined) || uuidv4();
    await pool.query(
      `INSERT INTO operational_tasks (id, company_id, type, title, description, status,
        priority, assignee_id, assigned_to, due_date, links,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.title,
        data.description,
        data.status || "OPEN",
        data.priority || "MEDIUM",
        data.assignee_id,
        data.assigned_to,
        data.due_date,
        data.links ? JSON.stringify(data.links) : null,
        userId,
        userId,
      ],
    );
    return taskRepository.findById(id, companyId);
  },

  async update(
    id: string,
    data: Record<string, unknown>,
    companyId: string,
    userId: string,
  ) {
    // Pre-serialize JSON fields before passing to buildSafeUpdate
    const safeCopy = { ...data };
    if (safeCopy.links !== undefined)
      safeCopy.links = JSON.stringify(safeCopy.links);

    const result = buildSafeUpdate(
      safeCopy,
      TASK_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return taskRepository.findById(id, companyId);

    await pool.query(
      `UPDATE operational_tasks SET ${result.setClause} WHERE id = ? AND company_id = ?`,
      [...result.values, id, companyId],
    );
    return taskRepository.findById(id, companyId);
  },

  async archive(id: string, companyId: string, userId: string) {
    await pool.query(
      "UPDATE operational_tasks SET archived_at = NOW(), updated_by = ? WHERE id = ? AND company_id = ?",
      [userId, id, companyId],
    );
  },
};

export const workItemRepository = {
  async findByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      "SELECT * FROM work_items WHERE company_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [companyId, limit, offset],
    );
    return rows as RowDataPacket[];
  },

  async findById(id: string, companyId: string) {
    const [rows] = await pool.query(
      "SELECT * FROM work_items WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
    return (rows as RowDataPacket[])[0] || null;
  },

  async create(data: Record<string, unknown>, companyId: string, userId: string) {
    const id = (data.id as string | undefined) || uuidv4();
    await pool.query(
      `INSERT INTO work_items (id, company_id, type, label, description, priority,
        status, sla_deadline, assignee_id, entity_type, entity_id,
        created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.type,
        data.label,
        data.description,
        data.priority,
        data.status,
        data.sla_deadline,
        data.assignee_id,
        data.entity_type,
        data.entity_id,
        userId,
        userId,
      ],
    );
    return workItemRepository.findById(id, companyId);
  },

  async update(
    id: string,
    data: Record<string, unknown>,
    companyId: string,
    userId: string,
  ) {
    const result = buildSafeUpdate(
      data,
      WORK_ITEM_UPDATABLE_COLUMNS,
      ["updated_by = ?"],
      [userId],
    );
    if (!result) return workItemRepository.findById(id, companyId);

    await pool.query(
      `UPDATE work_items SET ${result.setClause} WHERE id = ? AND company_id = ?`,
      [...result.values, id, companyId],
    );
    return workItemRepository.findById(id, companyId);
  },

  async archive(id: string, companyId: string, userId: string) {
    await pool.query(
      "UPDATE work_items SET archived_at = NOW(), updated_by = ? WHERE id = ? AND company_id = ?",
      [userId, id, companyId],
    );
  },
};
