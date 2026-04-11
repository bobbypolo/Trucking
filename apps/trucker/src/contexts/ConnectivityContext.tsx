import React, { createContext, useContext, useEffect, useState } from "react";
import { getIsOnline, subscribe } from "../services/connectivity";

interface ConnectivityContextType {
  isOnline: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(
  undefined,
);

export function ConnectivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState<boolean>(getIsOnline());

  useEffect(() => {
    const unsubscribe = subscribe((online: boolean) => {
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextType {
  const context = useContext(ConnectivityContext);
  if (context === undefined) {
    throw new Error(
      "useConnectivity must be used within a ConnectivityProvider",
    );
  }
  return context;
}
