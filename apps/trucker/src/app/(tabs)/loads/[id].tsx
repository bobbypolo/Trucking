/**
 * Load Detail Screen — displays full details for a single load.
 *
 * Tests R-P2-01: Calls fetchLoadById(id) on mount via useEffect.
 * Tests R-P2-02: Renders origin, destination, pickup_date, and delivery date.
 * Tests R-P2-03: Renders status badge with color-coded background per LoadStatus.
 */

import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchLoadById } from "../../../services/loads";
import { getOrigin, getDestination } from "../../../types/load";
import type { Load, LoadStatus } from "../../../types/load";

const STATUS_COLORS: Record<LoadStatus, string> = {
  pending: "#9CA3AF",
  assigned: "#3B82F6",
  dispatched: "#8B5CF6",
  in_transit: "#F59E0B",
  at_pickup: "#10B981",
  at_dropoff: "#06B6D4",
  delivered: "#22C55E",
  completed: "#6B7280",
};

function getDeliveryDate(load: Load): string {
  const dropoffs = load.legs.filter((leg) => leg.type === "Dropoff");
  if (dropoffs.length === 0) {
    return "Not scheduled";
  }
  return dropoffs[dropoffs.length - 1].date;
}

export default function LoadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [load, setLoad] = useState<Load | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadDetail() {
      try {
        setError(null);
        setLoading(true);
        const data = await fetchLoadById(id);
        if (!cancelled) {
          setLoad(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load details";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading load details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!load) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Load not found</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const origin = getOrigin(load);
  const destination = getDestination(load);
  const deliveryDate = getDeliveryDate(load);
  const statusColor = STATUS_COLORS[load.status] || "#9CA3AF";

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.loadId}>Load #{load.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{load.status}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Origin</Text>
        <Text style={styles.sectionValue}>{origin}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Destination</Text>
        <Text style={styles.sectionValue}>{destination}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Pickup Date</Text>
        <Text style={styles.sectionValue}>{load.pickup_date}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Delivery Date</Text>
        <Text style={styles.sectionValue}>{deliveryDate}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
    marginBottom: 12,
  },
  loadId: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  section: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 17,
    fontWeight: "500",
    color: "#111827",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
