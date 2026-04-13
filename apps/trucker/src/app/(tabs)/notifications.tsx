/**
 * Notifications screen for the LoadPilot trucker app.
 *
 * Displays a scrollable list of notification items with pull-to-refresh.
 *
 * # Tests R-P1-04, R-P1-05
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { fetchNotifications } from "../../services/notifications";
import type { NotificationItem } from "../../types/notification";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      // Silently handle fetch errors; user can pull-to-refresh to retry
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchNotifications();
        if (!cancelled) {
          setNotifications(data);
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.timestamp}>{item.sent_at}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No notifications</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  message: { fontSize: 16, marginBottom: 4 },
  timestamp: { fontSize: 12, color: "#888" },
});
