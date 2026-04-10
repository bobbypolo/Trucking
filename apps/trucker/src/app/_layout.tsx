import { Slot, Redirect, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ConnectivityProvider } from "../contexts/ConnectivityContext";
import OfflineBanner from "../components/OfflineBanner";

function RootLayoutNav() {
  const { isAuthenticated } = useAuth();
  const segments = useSegments();

  const inAuthGroup = segments[0] === "(auth)";

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ConnectivityProvider>
      <AuthProvider>
        <OfflineBanner />
        <RootLayoutNav />
      </AuthProvider>
    </ConnectivityProvider>
  );
}
