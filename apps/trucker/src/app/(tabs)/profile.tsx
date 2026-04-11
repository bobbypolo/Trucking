/**
 * Profile tab — STORY-010 Phase 10 (mobile Profile screen).
 *
 * Loads the current driver from the server on mount, renders loading /
 * error / success states, allows the driver to edit their phone number
 * and persist via `api.patch`, and exposes a Settings navigation entry.
 *
 * # Tests R-P10-01, R-P10-02, R-P10-03, R-P10-04, R-P10-05
 */

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import api from "../../services/api";
import type { DriverProfile } from "../../types/driver";

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const data = await api.get<DriverProfile>("/drivers/me");
        if (cancelled) {
          return;
        }
        setProfile(data);
        setPhoneDraft(data.phone ?? "");
        setError(null);
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load profile";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (saving) {
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.patch<DriverProfile>("/drivers/me", {
        phone: phoneDraft,
      });
      setProfile(updated);
      setPhoneDraft(updated.phone ?? "");
      setSaveMessage("Saved");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile";
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenSettings() {
    router.push("/settings");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      {loading && (
        <View style={styles.centeredRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingLabel}>Loading profile...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && profile && (
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.readOnly}>{profile.name}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.readOnly}>{profile.email}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.readOnly}>{profile.role}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={phoneDraft}
              onChangeText={setPhoneDraft}
              placeholder="Phone number"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          {saveMessage && <Text style={styles.saveMessage}>{saveMessage}</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || saving) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleOpenSettings}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  centeredRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  loadingLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666666",
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
  },
  form: {
    gap: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  readOnly: {
    fontSize: 16,
    color: "#111111",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111111",
  },
  saveMessage: {
    fontSize: 13,
    color: "#065f46",
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "500",
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
