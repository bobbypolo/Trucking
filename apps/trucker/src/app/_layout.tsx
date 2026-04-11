import { useEffect } from "react";
import { Slot, Redirect, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ConnectivityProvider } from "../contexts/ConnectivityContext";
import OfflineBanner from "../components/OfflineBanner";
import { registerBackgroundSync } from "../services/backgroundSync";

function RootLayoutNav() {
  const { isAuthenticated } = useAuth();
  const segments = useSegments();

  const inAuthGroup = segments[0] === "(auth)";

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}

// # Tests R-P9-05
export default function RootLayout() {
  useEffect(() => {
    registerBackgroundSync();
  }, []);

  return (
    <ConnectivityProvider>
      <AuthProvider>
        <OfflineBanner />
        <RootLayoutNav />
      </AuthProvider>
    </ConnectivityProvider>
  );
}
