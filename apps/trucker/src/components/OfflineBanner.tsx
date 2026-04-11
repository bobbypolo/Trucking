import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useConnectivity } from "../contexts/ConnectivityContext";

export default function OfflineBanner() {
  const { isOnline } = useConnectivity();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>You are offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#d32f2f",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
