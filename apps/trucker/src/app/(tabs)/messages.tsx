/**
 * Messages screen for the LoadPilot trucker app.
 *
 * Displays a scrollable list of message threads with title and
 * last message preview, plus pull-to-refresh.
 *
 * # Tests R-P3-04
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { fetchThreads } from "../../services/messaging";
import type { Thread } from "../../types/message";

export default function MessagesScreen() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const data = await fetchThreads();
      setThreads(data);
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
        const data = await fetchThreads();
        if (!cancelled) {
          setThreads(data);
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
    loadThreads();
  }, [loadThreads]);

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
        data={threads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.preview}>{item.last_message ?? ""}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No messages</Text>
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
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  preview: { fontSize: 14, color: "#666" },
});
