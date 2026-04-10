import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getOcrResult } from "../../services/documents";

interface OcrField {
  field_name: string;
  extracted_value: string;
  confidence: number;
}

// # Tests R-P5-06
export default function OcrResultScreen() {
  const router = useRouter();
  const { documentId } = useLocalSearchParams<{ documentId: string }>();

  const [fields, setFields] = useState<OcrField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setError("No document ID provided");
      setLoading(false);
      return;
    }

    async function fetchOcrResult() {
      try {
        const result = await getOcrResult(documentId as string);
        setFields(result.fields || []);
      } catch (err: unknown) {
        const apiError = err as { message?: string };
        setError(apiError.message || "Failed to load OCR results");
      } finally {
        setLoading(false);
      }
    }

    fetchOcrResult();
  }, [documentId]);

  function renderField({ item }: { item: OcrField }) {
    return (
      <View style={styles.fieldCard}>
        <Text style={styles.fieldName}>{item.field_name}</Text>
        <Text style={styles.fieldValue}>{item.extracted_value}</Text>
        <Text style={styles.confidence}>
          Confidence: {Math.round(item.confidence * 100)}%
        </Text>
      </View>
    );
  }

  function handleDone() {
    router.dismissAll();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading OCR results...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OCR Results</Text>
      <Text style={styles.subtitle}>
        {fields.length} field{fields.length !== 1 ? "s" : ""} extracted
      </Text>

      <FlatList
        data={fields}
        keyExtractor={(item, index) => `${item.field_name}-${index}`}
        renderItem={renderField}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No fields extracted</Text>
        }
      />

      <Pressable style={styles.doneButton} onPress={handleDone}>
        <Text style={styles.doneButtonText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  fieldCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fieldName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111",
    marginBottom: 4,
  },
  confidence: {
    fontSize: 12,
    color: "#94a3b8",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 40,
  },
  doneButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    margin: 24,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
