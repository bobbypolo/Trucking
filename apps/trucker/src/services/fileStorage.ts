import * as FileSystem from "expo-file-system";

const DOCUMENTS_DIR = `${FileSystem.documentDirectory}uploads/`;

async function ensureDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
  }
}

// # Tests R-P8-02, R-P8-07
export async function saveFileLocally(uri: string): Promise<string> {
  await ensureDirectory();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const permanentPath = `${DOCUMENTS_DIR}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: permanentPath });
  return permanentPath;
}

// # Tests R-P8-02
export async function deleteLocalFile(path: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch (_err: unknown) {
    // deletion failure is non-critical — file may already be removed
  }
}
