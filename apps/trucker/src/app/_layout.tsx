import { useEffect } from "react";
import { Slot, Redirect, useSegments, useRouter } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ConnectivityProvider } from "../contexts/ConnectivityContext";
import OfflineBanner from "../components/OfflineBanner";
import { registerBackgroundSync } from "../services/backgroundSync";
import { attachNotificationResponseHandler } from "../services/pushNotifications";

function RootLayoutNav() {
  const { isAuthenticated } = useAuth();
  const segments = useSegments();

  const inAuthGroup = segments[0] === "(auth)";

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}

// # Tests R-P9-05, R-P8-01, R-P8-02, R-P8-03
export default function RootLayout() {
  const router = useRouter();

  // # Tests R-P8-03
  useEffect(() => {
    const subscription = attachNotificationResponseHandler(router);
    return () => {
      subscription.remove();
    };
  }, [router]);

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
