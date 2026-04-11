import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { processQueue } from "./uploadQueue";

type ConnectivityListener = (online: boolean) => void;

let isOnline = true;
const listeners: Set<ConnectivityListener> = new Set();

// # Tests R-P9-04
const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
  const online = state.isConnected === true;
  if (online !== isOnline) {
    const wasOffline = !isOnline;
    isOnline = online;
    // # Tests R-P9-04
    if (wasOffline && isOnline) {
      processQueue().catch(() => {
        // processQueue errors are handled internally
      });
    }
    for (const listener of listeners) {
      listener(isOnline);
    }
  }
});

export function getIsOnline(): boolean {
  return isOnline;
}

export function subscribe(listener: ConnectivityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function cleanup(): void {
  unsubscribeNetInfo();
  listeners.clear();
}

export { isOnline };
