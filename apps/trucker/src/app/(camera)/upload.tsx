import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { uploadDocument, triggerOcr } from "../../services/documents";

const DOCUMENT_TYPES = [
  "BOL",
  "Rate Confirmation",
  "POD",
  "Fuel Receipt",
  "Scale Ticket",
] as const;

// # Tests R-P5-03, R-P5-04, R-P5-05, R-P5-07, R-P5-09
export default function UploadScreen() {
  const router = useRouter();
  const { photoUri, loadId } = useLocalSearchParams<{
    photoUri: string;
    loadId: string;
  }>();

  const [selectedType, setSelectedType] = useState<string>(DOCUMENT_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!photoUri || !loadId) {
      setError("Missing photo or load information");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadDocument({
        uri: photoUri,
        loadId: loadId,
        documentType: selectedType,
      });

      const documentId = result.id;

      try {
        await triggerOcr(documentId);
      } catch (_ocrError: unknown) {
        // OCR trigger failure is non-fatal; server auto-fires OCR for eligible types
      }

      router.push({
        pathname: "/(camera)/ocr-result",
        params: { documentId },
      });
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 413) {
        setError("File too large");
      } else {
        setError(
          apiError.message || "Upload failed. Please check your connection.",
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function handleRetry() {
    setError(null);
    handleUpload();
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Upload Document</Text>
        <Text style={styles.subtitle}>Select document type</Text>

        <View style={styles.typeList}>
          {DOCUMENT_TYPES.map((docType) => (
            <Pressable
              key={docType}
              style={[
                styles.typeButton,
                selectedType === docType && styles.typeButtonSelected,
              ]}
              onPress={() => setSelectedType(docType)}
            >
              <Text
                style={[
                  styles.typeText,
                  selectedType === docType && styles.typeTextSelected,
                ]}
              >
                {docType}
              </Text>
            </Pressable>
          ))}
        </View>

        {error !== null && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {uploading ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : (
          <Pressable
            style={styles.uploadButton}
            onPress={handleUpload}
            disabled={uploading}
          >
            <Text style={styles.uploadButtonText}>Upload</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  typeList: {
    gap: 10,
    marginBottom: 24,
  },
  typeButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  typeButtonSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  typeText: {
    fontSize: 16,
    color: "#333",
  },
  typeTextSelected: {
    color: "#2563eb",
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    backgroundColor: "#dc2626",
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
