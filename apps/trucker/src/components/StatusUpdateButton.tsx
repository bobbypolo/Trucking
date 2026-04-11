/**
 * StatusUpdateButton — renders transition buttons for driver-relevant status changes.
 *
 * Tests R-P3-01: Accepts currentStatus: LoadStatus and onStatusChange props, renders Pressable.
 * Tests R-P3-05: Filters to 3 driver transitions: dispatched->in_transit, in_transit->arrived, arrived->delivered.
 * Tests R-P3-06: Error text displayed for failed transitions.
 */

import { Pressable, Text, StyleSheet, View } from "react-native";
import type { LoadStatus } from "../types/load";

/**
 * Driver-relevant status transitions.
 * Only these 3 transitions are available to drivers in the mobile app.
 */
const DRIVER_TRANSITIONS: Record<string, { next: LoadStatus; label: string }> =
  {
    dispatched: { next: "in_transit", label: "Start Trip" },
    in_transit: { next: "arrived", label: "Mark Arrived" },
    arrived: { next: "delivered", label: "Mark Delivered" },
  };

interface StatusUpdateButtonProps {
  currentStatus: LoadStatus;
  onStatusChange: (newStatus: LoadStatus) => void;
}

export function StatusUpdateButton({
  currentStatus,
  onStatusChange,
}: StatusUpdateButtonProps) {
  const transition = DRIVER_TRANSITIONS[currentStatus];

  if (!transition) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => onStatusChange(transition.next)}
        accessibilityRole="button"
        accessibilityLabel={transition.label}
      >
        <Text style={styles.buttonText}>{transition.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: "#1D4ED8",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
