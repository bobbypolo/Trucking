/**
 * Loads screen - displays FlatList of driver's assigned loads
 * with pull-to-refresh, loading indicator, and error handling.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Load } from "../../types/load";
import { fetchLoads } from "../../services/loads";
import LoadCard from "../../components/LoadCard";

export default function LoadsScreen() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchLoads();
      setLoads(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    loadData();
  }, [loadData]);

  const handleLoadPress = useCallback((id: string) => {
    // Phase 2 will add navigation to LoadDetail
    void id;
  }, []);

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
        <Pressable style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loads.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>My Loads</Text>
        <Text style={styles.subtitle}>No loads assigned yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LoadCard load={item} onPress={handleLoadPress} />
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 8,
  },
});
