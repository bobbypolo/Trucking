import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueueItem } from "../types/queue";
import { uploadDocument } from "./documents";
import { deleteLocalFile } from "./fileStorage";

const QUEUE_KEY = "uploadQueue";
const MAX_RETRIES = 5;

async function loadQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) {
    return [];
  }
  return JSON.parse(raw) as QueueItem[];
}

async function saveQueue(items: QueueItem[]): Promise<void> {
  // # Tests R-P8-06
  await AsyncStorage.setItem("uploadQueue", JSON.stringify(items));
}

// # Tests R-P8-03
export async function addToQueue(
  item: Omit<QueueItem, "id" | "status" | "retryCount" | "createdAt">,
): Promise<QueueItem> {
  const items = await loadQueue();
  const newItem: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: item.filePath,
    loadId: item.loadId,
    documentType: item.documentType,
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  await saveQueue(items);
  return newItem;
}

// # Tests R-P8-03, R-P8-04, R-P8-08
export async function processQueue(): Promise<void> {
  const items = await loadQueue();
  let changed = false;

  for (const item of items) {
    // # Tests R-P8-08
    if (item.retryCount >= MAX_RETRIES) {
      if (item.status !== "failed") {
        item.status = "failed";
        changed = true;
      }
      continue;
    }

    if (item.status !== "pending" && item.status !== "failed") {
      continue;
    }

    item.status = "uploading";
    changed = true;
    await saveQueue(items);

    try {
      await uploadDocument({
        uri: item.filePath,
        loadId: item.loadId,
        documentType: item.documentType,
      });
      item.status = "completed";
      await deleteLocalFile(item.filePath);
    } catch (_err: unknown) {
      item.retryCount += 1;
      // # Tests R-P8-04
      const delay = Math.pow(2, item.retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (item.retryCount >= MAX_RETRIES) {
        item.status = "failed";
      } else {
        item.status = "failed";
      }
    }

    changed = true;
  }

  if (changed) {
    await saveQueue(items);
  }
}

// # Tests R-P8-03
export async function getQueueItems(): Promise<QueueItem[]> {
  return loadQueue();
}
