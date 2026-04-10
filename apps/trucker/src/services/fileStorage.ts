import * as FileSystem from "expo-file-system";

const QUEUE_DIR = `${FileSystem.documentDirectory}queue/`;

async function ensureQueueDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
}

export async function saveFileLocally(uri: string): Promise<string> {
  await ensureQueueDir();
  const filename = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destination = `${QUEUE_DIR}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function deleteLocalFile(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
