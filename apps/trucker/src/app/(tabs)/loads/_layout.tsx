/**
 * Loads Stack navigator layout.
 *
 * Tests R-P2-04: Defines a Stack navigator with 2 screens: index (list) and [id] (detail).
 */

import { Stack } from "expo-router";

export default function LoadsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "My Loads",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Load Details",
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}
