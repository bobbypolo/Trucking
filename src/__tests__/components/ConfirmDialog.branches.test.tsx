import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

describe("ConfirmDialog — branch coverage", () => {
  const defaultProps = {
    open: true,
    title: "Confirm Action",
    message: "Are you sure?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with title and message when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("has aria attributes", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-dialog-title");
  });

  it("uses default button labels", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("uses custom button labels", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, Delete"
        cancelLabel="Go Back"
      />,
    );
    expect(screen.getByText("Yes, Delete")).toBeInTheDocument();
    expect(screen.getByText("Go Back")).toBeInTheDocument();
  });

  it("applies danger styling when danger=true", () => {
    render(<ConfirmDialog {...defaultProps} danger={true} />);
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn.className).toContain("bg-red-600");
  });

  it("applies blue styling when danger=false (default)", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn.className).toContain("bg-blue-600");
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);
    await user.click(screen.getByText("Confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);
    await user.click(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);
    const backdrop = screen.getByRole("dialog").querySelector(".absolute");
    await user.click(backdrop!);
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape key", () => {
    render(<ConfirmDialog {...defaultProps} />);
    // useFocusTrap listens on the container element, not window
    const panel = screen
      .getByRole("dialog")
      .querySelector("div.relative") as HTMLElement;
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm on Enter key", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("removes keyboard listener on unmount", () => {
    const { unmount } = render(<ConfirmDialog {...defaultProps} />);
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    // Should not throw and callback should not be called after unmount
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  it("does not add keyboard listener when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });
});
