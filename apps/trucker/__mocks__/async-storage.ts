const storage = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.delete(key);
  },
  clear: async () => {
    storage.clear();
  },
  getAllKeys: async () => [...storage.keys()],
  multiGet: async (keys: string[]) =>
    keys.map((k) => [k, storage.get(k) ?? null] as [string, string | null]),
  multiSet: async (pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => storage.set(k, v));
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach((k) => storage.delete(k));
  },
};

export default AsyncStorage;
