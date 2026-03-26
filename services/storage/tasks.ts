/**
 * Tasks & Work Items domain -- API-backed CRUD.
 * Owner: STORY-016 (Phase 2 migration to server complete).
 */
import { OperationalTask, WorkItem } from "../../types";
import { api } from "../api";

export const getRawTasks = async (): Promise<OperationalTask[]> => {
  try {
    const data = await api.get("/tasks");
    const items: any[] = Array.isArray(data) ? data : data.tasks || [];
    return items.map((t: any) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assigned_to || t.assignedTo,
      dueDate: t.due_date || t.dueDate,
      links: t.links || [],
      createdAt: t.created_at || t.createdAt,
      createdBy: t.created_by || t.createdBy,
    }));
  } catch (e) {
    console.warn("[tasks] getRawTasks API error:", e);
    return [];
  }
};

export const saveTask = async (
  task: OperationalTask,
): Promise<OperationalTask> => {
  const body = {
    type: task.type,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigned_to: task.assignedTo,
    due_date: task.dueDate,
    links: task.links,
  };

  try {
    await api.patch(`/tasks/${task.id}`, body);
  } catch {
    await api.post("/tasks", { ...body, id: task.id });
  }
  return task;
};

export const getRawWorkItems = async (): Promise<WorkItem[]> => {
  try {
    const data = await api.get("/work-items");
    const items: any[] = Array.isArray(data)
      ? data
      : data.workItems || data.items || [];
    return items.map((wi: any) => ({
      id: wi.id,
      companyId: wi.company_id || wi.companyId,
      type: wi.type,
      label: wi.label,
      description: wi.description,
      priority: wi.priority,
      status: wi.status,
      entityType: wi.entity_type || wi.entityType,
      entityId: wi.entity_id || wi.entityId,
      createdAt: wi.created_at || wi.createdAt,
    }));
  } catch (e) {
    console.warn("[tasks] getRawWorkItems API error:", e);
    return [];
  }
};

export const getWorkItems = async (companyId?: string): Promise<WorkItem[]> => {
  const items = await getRawWorkItems();
  if (companyId) return items.filter((i) => i.companyId === companyId);
  return items;
};

export const saveWorkItem = async (item: WorkItem): Promise<WorkItem> => {
  const body = {
    type: item.type,
    label: item.label,
    description: item.description,
    priority: item.priority,
    status: item.status,
    entity_type: item.entityType,
    entity_id: item.entityId,
  };

  try {
    await api.patch(`/work-items/${item.id}`, body);
  } catch {
    await api.post("/work-items", { ...body, id: item.id });
  }
  return item;
};
