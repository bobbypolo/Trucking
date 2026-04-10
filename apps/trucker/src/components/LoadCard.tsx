/**
 * LoadCard — Pressable card displaying load summary with navigation.
 *
 * Tests R-P2-05: Calls router.push("/loads/${load.id}") on press.
 */

import { Pressable, Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Load, LoadStatus } from "../types/load";
import { getOrigin, getDestination } from "../types/load";

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

interface LoadCardProps {
  load: Load;
}

export default function LoadCard({ load }: LoadCardProps) {
  const router = useRouter();

  const origin = getOrigin(load);
  const destination = getDestination(load);
  const statusColor = STATUS_COLORS[load.status] || "#9CA3AF";

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/loads/${load.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Load from ${origin} to ${destination}`}
    >
      <View style={styles.header}>
        <Text style={styles.loadId}>#{load.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{load.status}</Text>
        </View>
      </View>

      <View style={styles.route}>
        <Text style={styles.label}>Origin</Text>
        <Text style={styles.location}>{origin}</Text>
      </View>

      <View style={styles.route}>
        <Text style={styles.label}>Destination</Text>
        <Text style={styles.location}>{destination}</Text>
      </View>

      <Text style={styles.date}>Pickup: {load.pickup_date}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  loadId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  route: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  location: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  date: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
});
