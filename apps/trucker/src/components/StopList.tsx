/**
 * StopList — displays ordered stops for a load with action buttons.
 *
 * Renders stops in sequence_order showing facility_name, city, state,
 * and appointment_time. Each stop has a status-dependent action button
 * (Arrive, Depart, Complete) and a color-coded status badge.
 *
 * Tests R-P5-03, R-P5-04, R-P5-05, R-P5-06, R-P5-08
 */

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { fetchStops, updateStopStatus } from "../services/stops";
import type { Stop, StopStatus } from "../types/stop";

interface StopListProps {
  loadId: string;
}

const STATUS_BADGE_COLORS: Record<StopStatus, string> = {
  pending: "#9CA3AF",
  arrived: "#3B82F6",
  departed: "#F59E0B",
  completed: "#22C55E",
};

const STATUS_LABELS: Record<StopStatus, string> = {
  pending: "Pending",
  arrived: "Arrived",
  departed: "Departed",
  completed: "Completed",
};

function getActionLabel(status: StopStatus): string | null {
  switch (status) {
    case "pending":
      return "Arrive";
    case "arrived":
      return "Depart";
    case "departed":
      return "Complete";
    default:
      return null;
  }
}

function getNextStatus(
  current: StopStatus,
): { status: StopStatus; extraFields: Record<string, string> } | null {
  switch (current) {
    case "pending":
      return {
        status: "arrived",
        extraFields: { arrived_at: new Date().toISOString() },
      };
    case "arrived":
      return {
        status: "departed",
        extraFields: { departed_at: new Date().toISOString() },
      };
    case "departed":
      return { status: "completed", extraFields: {} };
    default:
      return null;
  }
}

function formatAppointment(time: string | null): string {
  if (!time) {
    return "No appointment";
  }
  return time;
}

export function StopList({ loadId }: StopListProps) {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStops = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchStops(loadId);
      setStops(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load stops";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loadId]);

  useEffect(() => {
    loadStops();
  }, [loadStops]);

  const handleAction = async (stop: Stop) => {
    const next = getNextStatus(stop.status);
    if (!next) return;

    const update = { status: next.status, ...next.extraFields };

    try {
      const updated = await updateStopStatus(loadId, stop.id, update);
      setStops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      // Prompt document capture after completing Pickup or Dropoff
      if (
        next.status === "completed" &&
        (stop.type === "Pickup" || stop.type === "Dropoff")
      ) {
        Alert.alert(
          "Capture Document",
          `Would you like to capture a document for this ${stop.type.toLowerCase()}?`,
          [
            { text: "Skip", style: "cancel" },
            {
              text: "Capture",
              onPress: () =>
                router.push({
                  pathname: "/(camera)/camera",
                  params: { loadId },
                }),
            },
          ],
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update stop";
      setError(message);
    }
  };

  if (loading && stops.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (stops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No stops found</Text>
      </View>
    );
  }

  return (
    <View>
      {stops.map((stop) => {
        const actionLabel = getActionLabel(stop.status);
        const badgeColor = STATUS_BADGE_COLORS[stop.status] || "#9CA3AF";

        return (
          <View key={stop.id} style={styles.stopCard}>
            <View style={styles.stopHeader}>
              <Text style={styles.facilityName}>{stop.facility_name}</Text>
              <View
                style={[styles.statusBadge, { backgroundColor: badgeColor }]}
              >
                <Text style={styles.statusText}>
                  {STATUS_LABELS[stop.status]}
                </Text>
              </View>
            </View>

            <Text style={styles.location}>
              {stop.city}, {stop.state}
            </Text>

            <Text style={styles.appointment}>
              {formatAppointment(stop.appointment_time)}
            </Text>

            {actionLabel ? (
              <Pressable
                style={styles.actionButton}
                onPress={() => handleAction(stop)}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
              >
                <Text style={styles.actionButtonText}>{actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 24,
    alignItems: "center",
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    textAlign: "center",
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
  },
  stopCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
  },
  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  location: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  appointment: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 10,
  },
  actionButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
