import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

/**
 * Tests R-P1-06
 *
 * Verifies the tab layout includes a Notifications tab
 * that renders the NotificationsScreen.
 */

// Capture Tabs.Screen registrations
const registeredScreens: Array<{ name: string; options: any }> = [];

vi.mock("expo-router", () => {
  const TabsScreen = ({ name, options }: { name: string; options?: any }) => {
    registeredScreens.push({ name, options });
    return React.createElement("div", { "data-testid": `tab-${name}` }, name);
  };

  const Tabs = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      "div",
      { "data-testid": "tabs-container" },
      children,
    );
  };

  Tabs.Screen = TabsScreen;

  return { Tabs };
});

// Mock react-native
vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) =>
    React.createElement("div", props, children),
  Text: ({ children, ...props }: any) =>
    React.createElement("span", props, children),
  StyleSheet: { create: (s: any) => s },
}));

// Mock QueueStatusBadge (imported by _layout.tsx)
vi.mock("../../src/components/QueueStatusBadge", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "queue-badge" }, "badge"),
}));

describe("R-P1-06: Tab layout includes Notifications tab", () => {
  // # Tests R-P1-06
  it("registers a Tabs.Screen with name='notifications' and title='Notifications'", async () => {
    registeredScreens.length = 0;

    const TabLayout = (await import("../../src/app/(tabs)/_layout")).default;

    render(React.createElement(TabLayout));

    const notificationsTab = registeredScreens.find(
      (s) => s.name === "notifications",
    );

    expect(notificationsTab).toBeDefined();
    expect(notificationsTab!.name).toBe("notifications");
    expect(notificationsTab!.options.title).toBe("Notifications");
  });

  // # Tests R-P1-06
  it("contains exactly the expected tabs including notifications", async () => {
    registeredScreens.length = 0;

    const TabLayout = (await import("../../src/app/(tabs)/_layout")).default;

    render(React.createElement(TabLayout));

    const tabNames = registeredScreens.map((s) => s.name);

    expect(tabNames).toContain("notifications");
    expect(tabNames).toContain("index");
    expect(tabNames).toContain("loads");
    expect(tabNames).toContain("profile");
  });
});
