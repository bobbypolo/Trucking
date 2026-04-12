const listeners: Set<(state: any) => void> = new Set();

const NetInfo = {
  addEventListener: (callback: (state: any) => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
  fetch: async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  }),
};

export type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
};

export default NetInfo;
