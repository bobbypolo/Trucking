import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueueItem } from "../types/queue";
import { uploadDocument } from "./documents";
import { deleteLocalFile } from "./fileStorage";

const QUEUE_KEY = "@loadpilot/upload-queue";
const MAX_RETRIES = 5;

export async function getQueueItems(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as QueueItem[];
}

async function saveQueueItems(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function addToQueue(params: {
  filePath: string;
  loadId: string;
  documentType: string;
}): Promise<QueueItem> {
  const items = await getQueueItems();
  const item: QueueItem = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    filePath: params.filePath,
    loadId: params.loadId,
    documentType: params.documentType,
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  await saveQueueItems(items);
  return item;
}

export async function retryQueueItem(itemId: string): Promise<void> {
  const items = await getQueueItems();
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  items[idx].status = "pending";
  await saveQueueItems(items);
  await processQueueItem(items[idx]);
}

async function processQueueItem(item: QueueItem): Promise<void> {
  const items = await getQueueItems();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx === -1) return;

  items[idx].status = "uploading";
  await saveQueueItems(items);

  try {
    await uploadDocument({
      uri: item.filePath,
      loadId: item.loadId,
      documentType: item.documentType,
    });
    items[idx].status = "completed";
    await deleteLocalFile(item.filePath);
  } catch (_err: unknown) {
    items[idx].retryCount += 1;
    if (items[idx].retryCount >= MAX_RETRIES) {
      items[idx].status = "failed";
    } else {
      items[idx].status = "pending";
    }
  }
  await saveQueueItems(items);
}

export async function processQueue(): Promise<void> {
  const items = await getQueueItems();
  const pending = items.filter((i) => i.status === "pending");
  for (const item of pending) {
    const delay = Math.pow(2, item.retryCount) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    await processQueueItem(item);
  }
}
