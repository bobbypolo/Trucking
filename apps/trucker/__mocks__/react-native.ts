import React from "react";

export const View = ({ children, style, testID, ...props }: any) =>
  React.createElement(
    "div",
    { "data-testid": testID, style, ...props },
    children,
  );

export const Text = ({ children, style, ...props }: any) =>
  React.createElement("span", { style, ...props }, children);

export const FlatList = ({
  data,
  renderItem,
  keyExtractor,
  refreshControl,
  ListEmptyComponent,
}: any) => {
  if (!data || data.length === 0) {
    return React.createElement(
      "div",
      { "data-testid": "flatlist-empty" },
      typeof ListEmptyComponent === "function"
        ? React.createElement(ListEmptyComponent)
        : ListEmptyComponent,
    );
  }
  return React.createElement(
    "div",
    { "data-testid": "flatlist" },
    refreshControl,
    data.map((item: any, index: number) =>
      React.createElement(
        "div",
        {
          key: keyExtractor ? keyExtractor(item, index) : index,
          "data-testid": `flatlist-item-${index}`,
        },
        renderItem({ item, index }),
      ),
    ),
  );
};

export const StyleSheet = {
  create: (styles: any) => styles,
};

export const ActivityIndicator = ({ size, ...props }: any) =>
  React.createElement(
    "div",
    { "data-testid": "activity-indicator", ...props },
    "Loading...",
  );

export const RefreshControl = ({ refreshing, onRefresh, ...props }: any) =>
  React.createElement("div", {
    "data-testid": "refresh-control",
    "data-refreshing": String(refreshing),
    onClick: onRefresh,
    ...props,
  });

export const Pressable = ({ children, onPress, ...props }: any) =>
  React.createElement("button", { onClick: onPress, ...props }, children);

export const TextInput = (props: any) =>
  React.createElement("input", { ...props });

export const ScrollView = ({ children, ...props }: any) =>
  React.createElement("div", props, children);

export const Modal = ({ children, visible, ...props }: any) =>
  visible
    ? React.createElement("div", { "data-testid": "modal", ...props }, children)
    : null;

export const Alert = { alert: () => {} };

export default {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  Alert,
};
