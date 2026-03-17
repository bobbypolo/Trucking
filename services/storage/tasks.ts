/**
 * Tasks & Work Items domain — localStorage CRUD.
 * Owner: STORY-016 (Phase 2 migration to server).
 */
import { OperationalTask, WorkItem } from "../../types";
import { getTenantKey } from "./core";

export const STORAGE_KEY_TASKS = (): string => getTenantKey("tasks_v1");
export const STORAGE_KEY_WORK_ITEMS = (): string =>
  getTenantKey("work_items_v1");

export const getRawTasks = (): OperationalTask[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_TASKS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveTask = async (task: OperationalTask) => {
  const tasks = getRawTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.unshift(task);
  localStorage.setItem(STORAGE_KEY_TASKS(), JSON.stringify(tasks));
  return task;
};

export const getRawWorkItems = (): WorkItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_WORK_ITEMS());
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getWorkItems = async (companyId?: string): Promise<WorkItem[]> => {
  const items = getRawWorkItems();
  if (companyId) return items.filter((i) => i.companyId === companyId);
  return items;
};

export const saveWorkItem = async (item: WorkItem) => {
  const items = getRawWorkItems();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  localStorage.setItem(STORAGE_KEY_WORK_ITEMS(), JSON.stringify(items));
  return item;
};
