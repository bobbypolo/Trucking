import React from "react";

const TabsScreen = ({ name, options }: { name: string; options?: any }) => {
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

export { Tabs };

export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
});

export const useLocalSearchParams = () => ({});
export const useSegments = () => [];
export const Link = ({ children, ...props }: any) =>
  React.createElement("a", props, children);

export default { Tabs, useRouter, useLocalSearchParams, useSegments, Link };
