import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

type ConnectivityListener = (online: boolean) => void;

let isOnline = true;
const listeners: Set<ConnectivityListener> = new Set();

const unsubscribeNetInfo = NetInfo.addEventListener(
  (state: NetInfoState) => {
    const online = state.isConnected === true;
    if (online !== isOnline) {
      isOnline = online;
      for (const listener of listeners) {
        listener(isOnline);
      }
    }
  },
);

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
