import React, { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  placeholder?: string;
  multiline?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export const InputDialog: React.FC<Props> = ({
  open,
  title,
  message,
  placeholder = "",
  multiline = false,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = () => {
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="input-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative bg-[#0a0f1e] border border-white/10 rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <h2
          id="input-dialog-title"
          className="text-lg font-black text-white uppercase tracking-tight mb-3"
        >
          {title}
        </h2>
        <p className="text-sm text-slate-300 mb-4 leading-relaxed">{message}</p>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 resize-none mb-6"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 mb-6"
          />
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-800 hover:bg-slate-700 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
