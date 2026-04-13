import { useEffect, useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { fetchLoads } from "../../services/loads";
import { fetchStops } from "../../services/stops";
import { fetchDriverExceptions } from "../../services/issues";
import { fetchSettlements } from "../../services/settlements";
import { getQueueItems } from "../../services/uploadQueue";
import type { Load } from "../../types/load";
import type { Stop } from "../../types/stop";
import type { DriverException } from "../../types/issue";
import type { Settlement } from "../../types/settlement";
import type { QueueItem } from "../../types/queue";

const ACTIVE_STATUSES = ["dispatched", "in_transit", "arrived"] as const;

export default function HomeScreen() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [nextStop, setNextStop] = useState<Stop | null>(null);
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [latestSettlement, setLatestSettlement] = useState<Settlement | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedLoads, fetchedQueue, exceptions, settlements] =
        await Promise.all([
          fetchLoads(),
          getQueueItems(),
          fetchDriverExceptions(),
          fetchSettlements(),
        ]);

      setLoads(fetchedLoads);
      setQueueItems(fetchedQueue);

      // Find the next pending stop from the first active load
      const activeLoad = fetchedLoads.find((load) =>
        ACTIVE_STATUSES.includes(
          load.status as (typeof ACTIVE_STATUSES)[number],
        ),
      );

      if (activeLoad) {
        const stops = await fetchStops(activeLoad.id);
        const pendingStop = stops.find((s) => s.status === "pending");
        setNextStop(pendingStop || null);
      } else {
        setNextStop(null);
      }

      // Count open issues
      const openIssues = exceptions.filter((e) => e.status === "OPEN");
      setOpenIssueCount(openIssues.length);

      // Find latest settlement (first one, since API returns sorted by date desc)
      setLatestSettlement(settlements.length > 0 ? settlements[0] : null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeLoadCount = loads.filter((load) =>
    ACTIVE_STATUSES.includes(load.status as (typeof ACTIVE_STATUSES)[number]),
  ).length;

  const pendingUploadCount = queueItems.filter(
    (item) => item.status === "pending" || item.status === "uploading",
  ).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Loads</Text>
        <Text style={styles.cardCount}>{activeLoadCount}</Text>
        <Text style={styles.cardSubtitle}>
          dispatched, in transit, or arrived
        </Text>
      </View>

      {pendingUploadCount > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending Uploads</Text>
          <Text style={styles.cardCount}>{pendingUploadCount}</Text>
          <Text style={styles.cardSubtitle}>documents waiting to upload</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next Stop</Text>
        {nextStop ? (
          <>
            <Text style={styles.cardValue}>{nextStop.facility_name}</Text>
            <Text style={styles.cardSubtitle}>
              {nextStop.appointment_time || "No appointment time"}
            </Text>
          </>
        ) : (
          <Text style={styles.cardEmpty}>No active stops</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Open Issues</Text>
        <Text style={styles.cardCount}>{openIssueCount}</Text>
        {openIssueCount === 0 ? (
          <Text style={styles.cardEmpty}>No open issues</Text>
        ) : (
          <Text style={styles.cardSubtitle}>
            {openIssueCount === 1 ? "issue" : "issues"} requiring attention
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Latest Pay</Text>
        {latestSettlement ? (
          <>
            <Text style={styles.cardValue}>
              {formatCurrency(latestSettlement.net_pay)}
            </Text>
            <Text style={styles.cardSubtitle}>{latestSettlement.status}</Text>
          </>
        ) : (
          <Text style={styles.cardEmpty}>No settlements yet</Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1e293b",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  cardCount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  cardEmpty: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
