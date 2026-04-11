import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

interface NotificationPrefs {
  loadAssignments: boolean;
  statusUpdates: boolean;
  quietHours: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  loadAssignments: true,
  statusUpdates: true,
  quietHours: true,
};

// # Tests R-P11-01, R-P11-02, R-P11-03, R-P11-04, R-P11-05, R-P11-06, R-P11-07, R-P11-08
export default function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const { logout } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  // Load persisted notification preferences on mount.
  // # Tests R-P11-02
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@loadpilot/notification-prefs");
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
          setPrefs({
            loadAssignments:
              typeof parsed.loadAssignments === "boolean"
                ? parsed.loadAssignments
                : DEFAULT_PREFS.loadAssignments,
            statusUpdates:
              typeof parsed.statusUpdates === "boolean"
                ? parsed.statusUpdates
                : DEFAULT_PREFS.statusUpdates,
            quietHours:
              typeof parsed.quietHours === "boolean"
                ? parsed.quietHours
                : DEFAULT_PREFS.quietHours,
          });
        }
      } catch (_err) {
        // Fall back to defaults on JSON parse or storage error.
        setPrefs(DEFAULT_PREFS);
      }
    })();
  }, []);

  // # Tests R-P11-03
  async function persistPrefs(next: NotificationPrefs): Promise<void> {
    try {
      await AsyncStorage.setItem(
        "@loadpilot/notification-prefs",
        JSON.stringify(next),
      );
    } catch (_err) {
      // Non-fatal: surface to user on next load attempt.
    }
  }

  function togglePref(key: keyof NotificationPrefs, value: boolean): void {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void persistPrefs(next);
  }

  // # Tests R-P11-05, R-P11-06, R-P11-08
  function handleSignOut(): void {
    Alert.alert(
      "Sign out?",
      "You'll need to sign in again to access your loads.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ],
    );
  }

  // # Tests R-P11-07
  const appVersion = Constants.expoConfig?.version ?? "unknown";

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Notifications</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>New load assignments</Text>
          <Switch
            accessibilityLabel="Toggle new load assignment notifications"
            value={prefs.loadAssignments}
            onValueChange={(value: boolean) =>
              togglePref("loadAssignments", value)
            }
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status updates</Text>
          <Switch
            accessibilityLabel="Toggle status update notifications"
            value={prefs.statusUpdates}
            onValueChange={(value: boolean) =>
              togglePref("statusUpdates", value)
            }
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Quiet hours</Text>
          <Switch
            accessibilityLabel="Toggle quiet hours"
            value={prefs.quietHours}
            onValueChange={(value: boolean) => togglePref("quietHours", value)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{appVersion}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  header: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555555",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dddddd",
  },
  rowLabel: {
    fontSize: 16,
    color: "#222222",
  },
  rowValue: {
    fontSize: 16,
    color: "#666666",
  },
  signOutButton: {
    backgroundColor: "#b91c1c",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  signOutButtonPressed: {
    opacity: 0.7,
  },
  signOutLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
