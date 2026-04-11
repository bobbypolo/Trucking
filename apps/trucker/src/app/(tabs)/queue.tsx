import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  getQueueItems,
  retryQueueItem,
  processQueue,
} from "../../services/uploadQueue";
import type { QueueItem } from "../../types/queue";

// # Tests R-P10-02, R-P10-03
export default function QueueScreen() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const queueItems = await getQueueItems();
    setItems(queueItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
    const interval = setInterval(loadItems, 5000);
    return () => clearInterval(interval);
  }, [loadItems]);

  async function handleRetry(itemId: string) {
    setRetrying(itemId);
    await retryQueueItem(itemId);
    await loadItems();
    setRetrying(null);
  }

  async function handleProcessAll() {
    setLoading(true);
    await processQueue();
    await loadItems();
  }

  function extractFilename(filePath: string): string {
    const parts = filePath.split("/");
    return parts[parts.length - 1] || filePath;
  }

  function renderItem({ item }: { item: QueueItem }) {
    const filename = extractFilename(item.filePath);

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemInfo}>
          <Text style={styles.filename} numberOfLines={1}>
            {filename}
          </Text>
          <Text style={styles.docType}>{item.documentType}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                item.status === "pending" && styles.statusPending,
                item.status === "uploading" && styles.statusUploading,
                item.status === "completed" && styles.statusCompleted,
                item.status === "failed" && styles.statusFailed,
              ]}
            />
            <Text style={styles.statusText}>{item.status}</Text>
            <Text style={styles.retryCount}>
              Retries: {item.retryCount}
            </Text>
          </View>
        </View>

        {item.status === "failed" && (
          <Pressable
            style={styles.retryButton}
            onPress={() => handleRetry(item.id)}
            disabled={retrying === item.id}
          >
            {retrying === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.retryText}>Retry</Text>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Queue</Text>
        {items.some((i) => i.status === "pending") && (
          <Pressable style={styles.processButton} onPress={handleProcessAll}>
            <Text style={styles.processText}>Process All</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No items in queue</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
  },
  processButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  processText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  itemInfo: {
    flex: 1,
  },
  filename: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },
  docType: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: "#f59e0b",
  },
  statusUploading: {
    backgroundColor: "#2563eb",
  },
  statusCompleted: {
    backgroundColor: "#16a34a",
  },
  statusFailed: {
    backgroundColor: "#dc2626",
  },
  statusText: {
    fontSize: 13,
    color: "#444",
    textTransform: "capitalize",
  },
  retryCount: {
    fontSize: 12,
    color: "#888",
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});
