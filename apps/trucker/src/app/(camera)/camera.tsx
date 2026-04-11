import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function CameraScreen() {
  const router = useRouter();
  const { loadId } = useLocalSearchParams<{ loadId: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          LoadPilot needs camera access to capture documents such as BOL, Rate
          Confirmations, and Proof of Delivery photos.
        </Text>
        <Pressable style={styles.grantButton} onPress={requestPermission}>
          <Text style={styles.grantButtonText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || isCapturing) {
      return;
    }
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo && photo.uri) {
        router.push({
          pathname: "/(camera)/preview",
          params: { photoUri: photo.uri, loadId: loadId || "" },
        });
      } else {
        Alert.alert("Capture Failed", "Please try again.");
      }
    } catch {
      Alert.alert("Capture Failed", "An error occurred. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <Pressable
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>
        </View>
      </CameraView>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    padding: 10,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 14,
    color: "#ccc",
    textAlign: "center",
    paddingHorizontal: 40,
    marginBottom: 24,
    lineHeight: 20,
  },
  grantButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  grantButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: "#999",
    fontSize: 14,
  },
});
