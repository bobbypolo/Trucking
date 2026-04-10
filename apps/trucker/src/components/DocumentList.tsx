/**
 * DocumentList — displays documents attached to a load.
 *
 * Fetches via listDocuments(loadId) on mount and re-fetches on screen
 * focus so new documents appear after camera capture flow returns.
 *
 * Tests R-P6-01: Calls listDocuments(loadId) on mount via useEffect and
 *   re-fetches on screen focus using useFocusEffect from expo-router.
 * Tests R-P6-02: Renders each document in a FlatList showing document_type,
 *   filename, and created_at.
 * Tests R-P6-04: Renders "No documents yet" Text when documents array
 *   has length 0.
 */

import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { listDocuments } from "../services/documents";

interface Document {
  id: string;
  document_type: string;
  filename: string;
  created_at: string;
  load_id: string | null;
}

interface DocumentListProps {
  loadId: string;
}

export function DocumentList({ loadId }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchDocuments() {
    try {
      setError(null);
      setLoading(true);
      const data = await listDocuments(loadId);
      setDocuments(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load documents";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, [loadId]);

  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [loadId]),
  );

  if (loading && documents.length === 0) {
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

  if (documents.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No documents yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={documents}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.documentRow}>
          <Text style={styles.documentType}>{item.document_type}</Text>
          <Text style={styles.filename}>{item.filename}</Text>
          <Text style={styles.createdAt}>{item.created_at}</Text>
        </View>
      )}
    />
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
  documentRow: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
  },
  documentType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  filename: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  createdAt: {
    fontSize: 13,
    color: "#6B7280",
  },
});
