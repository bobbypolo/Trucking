/**
 * Pay screen for the LoadPilot trucker app.
 *
 * Displays a scrollable list of driver settlements with status,
 * total amount, and pay period. Pressing a row navigates to detail.
 *
 * # Tests R-P8-02, R-P8-03, R-P8-04
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { fetchSettlements } from "../../services/settlements";
import type { Settlement } from "../../types/settlement";

export default function PayScreen() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadSettlements = useCallback(async () => {
    try {
      const data = await fetchSettlements();
      setSettlements(data);
    } catch {
      // Silently handle fetch errors; user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSettlements();
        if (!cancelled) {
          setSettlements(data);
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/settlement-detail",
                params: { settlementId: item.id },
              })
            }
            style={styles.item}
          >
            <View style={styles.row}>
              <Text style={styles.status}>{item.status}</Text>
              <Text style={styles.amount}>${item.net_pay.toFixed(2)}</Text>
            </View>
            <Text style={styles.period}>
              {item.period_start && item.period_end
                ? `${item.period_start} - ${item.period_end}`
                : item.settlement_date}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No settlements found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  status: { fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  amount: { fontSize: 16, fontWeight: "700" },
  period: { fontSize: 12, color: "#888" },
});
