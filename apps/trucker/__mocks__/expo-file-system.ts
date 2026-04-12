const storage = new Map<string, string>();

export const documentDirectory = "file:///mock-documents/";

export async function getInfoAsync(
  uri: string,
): Promise<{ exists: boolean; isDirectory: boolean }> {
  return { exists: storage.has(uri), isDirectory: false };
}

export async function makeDirectoryAsync(
  _uri: string,
  _options?: { intermediates?: boolean },
): Promise<void> {}

export async function copyAsync(_options: {
  from: string;
  to: string;
}): Promise<void> {
  storage.set(_options.to, _options.from);
}

export async function deleteAsync(
  _uri: string,
  _options?: { idempotent?: boolean },
): Promise<void> {
  storage.delete(_uri);
}

export async function readAsStringAsync(
  _uri: string,
  _options?: { encoding?: string },
): Promise<string> {
  return "";
}

export default {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
  readAsStringAsync,
};
