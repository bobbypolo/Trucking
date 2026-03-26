import React, { useEffect } from "react";

interface Props {
  message: string;
  type: "success" | "error" | "info" | "warning";
  onDismiss: () => void;
  duration?: number;
}

const typeStyles: Record<Props["type"], string> = {
  success:
    "bg-green-900/90 border-green-500/40 text-green-100 shadow-green-900/30",
  error: "bg-red-900/90 border-red-500/40 text-red-100 shadow-red-900/30",
  info: "bg-blue-900/90 border-blue-500/40 text-blue-100 shadow-blue-900/30",
  warning:
    "bg-amber-900/90 border-amber-500/40 text-amber-100 shadow-amber-900/30",
};

export const Toast: React.FC<Props> = ({
  message,
  type,
  onDismiss,
  duration = 3000,
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl border shadow-xl text-sm font-bold uppercase tracking-wide max-w-xs w-full text-center ${typeStyles[type]}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
};
