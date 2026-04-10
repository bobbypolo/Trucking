/**
 * LoadCard component for the trucker mobile app.
 * Renders a pressable card showing load origin, destination, and status badge.
 */

import { Pressable, Text, View, StyleSheet } from "react-native";
import type { Load, LoadStatus } from "../types/load";
import { getOrigin, getDestination } from "../types/load";

const STATUS_COLORS: Record<LoadStatus, string> = {
  draft: "#9ca3af",
  planned: "#3b82f6",
  dispatched: "#8b5cf6",
  in_transit: "#f59e0b",
  arrived: "#10b981",
  delivered: "#059669",
  completed: "#047857",
  cancelled: "#ef4444",
};

interface LoadCardProps {
  load: Load;
  onPress: (id: string) => void;
}

export default function LoadCard({ load, onPress }: LoadCardProps) {
  const origin = getOrigin(load);
  const destination = getDestination(load);
  const badgeColor = STATUS_COLORS[load.status] || "#6b7280";

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(load.id)}
      accessibilityRole="button"
      accessibilityLabel={`Load from ${origin.city} to ${destination.city}`}
    >
      <View style={styles.routeRow}>
        <View style={styles.locationColumn}>
          <Text style={styles.locationLabel}>Origin</Text>
          <Text style={styles.locationText}>
            {origin.city}, {origin.state}
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.locationColumn}>
          <Text style={styles.locationLabel}>Destination</Text>
          <Text style={styles.locationText}>
            {destination.city}, {destination.state}
          </Text>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.statusText}>{load.status.replace(/_/g, " ")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  locationColumn: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  arrow: {
    fontSize: 20,
    color: "#9ca3af",
    marginHorizontal: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "capitalize",
  },
});
