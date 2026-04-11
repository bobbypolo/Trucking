import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { getQueueItems } from "../services/uploadQueue";

// # Tests R-P10-01
export default function QueueStatusBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCount() {
      const items = await getQueueItems();
      if (!mounted) return;
      const actionable = items.filter(
        (i) => i.status === "pending" || i.status === "failed",
      );
      setCount(actionable.length);
    }

    loadCount();

    const interval = setInterval(loadCount, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
