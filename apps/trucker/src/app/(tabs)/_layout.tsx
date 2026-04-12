import { Tabs } from "expo-router";
import QueueStatusBadge from "../../components/QueueStatusBadge";

// # Tests R-P10-05, R-P1-06, R-P8-07
export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen
        name="loads"
        options={{
          title: "Loads",
          headerShown: false,
        }}
      />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="pay" options={{ title: "Pay" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen
        name="queue"
        options={{
          title: "Queue",
          tabBarBadge: undefined,
          tabBarIcon: () => <QueueStatusBadge />,
        }}
      />
    </Tabs>
  );
}
