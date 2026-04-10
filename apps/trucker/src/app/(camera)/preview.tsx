import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function PreviewScreen() {
  const router = useRouter();
  const { photoUri, loadId } = useLocalSearchParams<{
    photoUri: string;
    loadId: string;
  }>();

  function handleRetake() {
    router.back();
  }

  function handleUsePhoto() {
    router.push({
      pathname: "/(camera)/upload",
      params: { photoUri: photoUri || "", loadId: loadId || "" },
    });
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: photoUri }}
        style={styles.preview}
        resizeMode="contain"
      />
      <View style={styles.actions}>
        <Pressable style={styles.retakeButton} onPress={handleRetake}>
          <Text style={styles.retakeText}>Retake</Text>
        </Pressable>
        <Pressable style={styles.useButton} onPress={handleUsePhoto}>
          <Text style={styles.useText}>Use Photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  preview: {
    flex: 1,
    width: "100%",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: "#111",
  },
  retakeButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
  },
  retakeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  useButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  useText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
