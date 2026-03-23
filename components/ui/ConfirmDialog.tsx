import React, { useEffect, useRef } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onCancel);

  useEffect(() => {
    if (!open) return;
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [open, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="relative bg-[#0a0f1e] border border-white/10 rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-black text-white uppercase tracking-tight mb-3"
        >
          {title}
        </h2>
        <p className="text-sm text-slate-300 mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center flex items-center justify-center ${
              danger
                ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/30"
                : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/30"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
