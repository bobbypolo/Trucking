import { Text, View, StyleSheet } from "react-native";

export default function LoadsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Loads</Text>
      <Text style={styles.subtitle}>No loads assigned yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
  },
});
