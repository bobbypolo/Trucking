import { Stack } from "expo-router";

export default function CameraLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="camera" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="upload" />
      <Stack.Screen name="ocr-result" />
    </Stack>
  );
}
