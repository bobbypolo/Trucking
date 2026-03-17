import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InputDialog } from "../../../components/ui/InputDialog";

describe("InputDialog", () => {
  const defaultProps = {
    open: true,
    title: "Test Title",
    message: "Test message",
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <InputDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with title and message when open", () => {
    render(<InputDialog {...defaultProps} />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("renders with aria attributes", () => {
    render(<InputDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "input-dialog-title");
  });

  it("renders text input by default (not multiline)", () => {
    render(<InputDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("");
    expect(input.tagName).toBe("INPUT");
  });

  it("renders textarea when multiline is true", () => {
    render(<InputDialog {...defaultProps} multiline={true} placeholder="Enter notes" />);
    const textarea = screen.getByPlaceholderText("Enter notes");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("uses custom labels", () => {
    render(
      <InputDialog
        {...defaultProps}
        submitLabel="Save"
        cancelLabel="Dismiss"
      />,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("calls onCancel when backdrop is clicked", () => {
    render(<InputDialog {...defaultProps} />);
    // Backdrop is the first child div with onClick
    const backdrop = screen.getByRole("dialog").querySelector(".absolute");
    fireEvent.click(backdrop!);
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(<InputDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape key", () => {
    render(<InputDialog {...defaultProps} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("submit button is disabled when input is empty", () => {
    render(<InputDialog {...defaultProps} />);
    const submitBtn = screen.getByText("Submit");
    expect(submitBtn).toBeDisabled();
  });

  it("submit button is enabled when input has text", () => {
    render(<InputDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "some text" } });
    expect(screen.getByText("Submit")).not.toBeDisabled();
  });

  it("calls onSubmit with trimmed value when submit is clicked", () => {
    render(<InputDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  hello world  " } });
    fireEvent.click(screen.getByText("Submit"));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("hello world");
  });

  it("does not call onSubmit when value is only whitespace", () => {
    render(<InputDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("Submit"));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit on Enter key in input mode", () => {
    render(<InputDialog {...defaultProps} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("test");
  });

  it("resets value when dialog opens", () => {
    const { rerender } = render(
      <InputDialog {...defaultProps} open={false} />,
    );
    rerender(<InputDialog {...defaultProps} open={true} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("renders custom placeholder", () => {
    render(
      <InputDialog {...defaultProps} placeholder="Enter load number..." />,
    );
    expect(
      screen.getByPlaceholderText("Enter load number..."),
    ).toBeInTheDocument();
  });
});
