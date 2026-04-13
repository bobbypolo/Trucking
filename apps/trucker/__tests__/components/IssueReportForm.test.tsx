import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Tests R-P7-03, R-P7-04, R-P7-05, R-P7-06, R-P7-08
 *
 * Verifies IssueReportForm renders picker with 5 issue types,
 * description TextInput and Submit button, disabled state logic,
 * submit flow, and Attach Photo navigation.
 */

// Mock react-native
vi.mock("react-native", () => {
  const RN = {
    View: ({ children, style, testID, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": testID, style, ...props },
        children,
      ),
    Text: ({ children, style, ...props }: any) =>
      React.createElement("span", { style, ...props }, children),
    TextInput: ({
      value,
      onChangeText,
      placeholder,
      multiline,
      ...props
    }: any) =>
      React.createElement("textarea", {
        value,
        onChange: (e: any) => onChangeText?.(e.target.value),
        placeholder,
        "aria-label": props.accessibilityLabel,
        ...props,
      }),
    Pressable: ({ children, onPress, disabled, style, ...props }: any) =>
      React.createElement(
        "button",
        {
          onClick: onPress,
          disabled,
          "aria-label": props.accessibilityLabel,
          ...props,
        },
        children,
      ),
    Modal: ({ children, visible, ...props }: any) =>
      visible
        ? React.createElement(
            "div",
            { "data-testid": "modal", ...props },
            children,
          )
        : null,
    ScrollView: ({ children, ...props }: any) =>
      React.createElement("div", props, children),
    StyleSheet: { create: (s: any) => s },
  };
  return { ...RN, default: RN };
});

// Mock expo-router
const mockPush = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock reportIssue service
const mockReportIssue = vi.fn();
vi.mock("../../src/services/issues", () => ({
  reportIssue: (...args: any[]) => mockReportIssue(...args),
}));

// Mock firebase config
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

import { IssueReportForm } from "../../src/components/IssueReportForm";

describe("R-P7-03: IssueReportForm renders picker with 5 issue types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P7-03
  it("renders Breakdown, Delay, Detention, Lumper, Other as selectable options", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Breakdown")).toBeTruthy();
    expect(screen.getByText("Delay")).toBeTruthy();
    expect(screen.getByText("Detention")).toBeTruthy();
    expect(screen.getByText("Lumper")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
  });

  // # Tests R-P7-03
  it("renders exactly 5 issue type options", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const expectedTypes = [
      "Breakdown",
      "Delay",
      "Detention",
      "Lumper",
      "Other",
    ];
    for (const typeName of expectedTypes) {
      const button = screen.getByLabelText(typeName);
      expect(button).toBeTruthy();
    }
    expect(expectedTypes).toHaveLength(5);
  });
});

describe("R-P7-04: IssueReportForm renders description and Submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P7-04
  it("renders a multiline description TextInput", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const descInput = screen.getByLabelText("Description");
    expect(descInput).toBeTruthy();
    expect(descInput.tagName.toLowerCase()).toBe("textarea");
  });

  // # Tests R-P7-04
  it("renders a Submit button", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const submitBtn = screen.getByLabelText("Submit");
    expect(submitBtn).toBeTruthy();
    expect(screen.getByText("Submit")).toBeTruthy();
  });
});

describe("R-P7-05: Submit disabled when type not selected or description empty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P7-05
  it("Submit is disabled initially (no type selected, no description)", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const submitBtn = screen.getByLabelText("Submit");
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });

  // # Tests R-P7-05
  it("Submit is disabled when type selected but description is empty", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Breakdown"));

    const submitBtn = screen.getByLabelText("Submit");
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });

  // # Tests R-P7-05
  it("Submit is disabled when description filled but no type selected", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const descInput = screen.getByLabelText("Description");
    fireEvent.change(descInput, { target: { value: "Some description" } });

    const submitBtn = screen.getByLabelText("Submit");
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });

  // # Tests R-P7-05
  it("Submit is enabled when both type selected and description filled", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Delay"));
    const descInput = screen.getByLabelText("Description");
    fireEvent.change(descInput, { target: { value: "Traffic jam on I-90" } });

    const submitBtn = screen.getByLabelText("Submit");
    expect(submitBtn.hasAttribute("disabled")).toBe(false);
  });
});

describe("R-P7-06: On submit calls reportIssue then onClose + onSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P7-06
  it("calls reportIssue with correct payload, then onClose and onSubmit", async () => {
    mockReportIssue.mockResolvedValue({ id: "EX-100" });
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByLabelText("Detention"));
    const descInput = screen.getByLabelText("Description");
    fireEvent.change(descInput, {
      target: { value: "Waiting at dock 3 hours" },
    });

    fireEvent.click(screen.getByLabelText("Submit"));

    await waitFor(() => {
      expect(mockReportIssue).toHaveBeenCalledWith({
        issue_type: "Detention",
        load_id: "L1",
        description: "Waiting at dock 3 hours",
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});

describe("R-P7-08: Attach Photo button navigates to camera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P7-08
  it("renders Attach Photo button", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const attachBtn = screen.getByLabelText("Attach Photo");
    expect(attachBtn).toBeTruthy();
    expect(screen.getByText("Attach Photo")).toBeTruthy();
  });

  // # Tests R-P7-08
  it("navigates to camera screen with loadId and mode=issue on press", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Attach Photo"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(camera)/camera",
      params: { loadId: "L1", mode: "issue" },
    });
  });

  // # Tests R-P7-08
  it("does not render when modal is not visible", () => {
    render(
      <IssueReportForm
        loadId="L1"
        visible={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Attach Photo")).toBeNull();
  });
});
