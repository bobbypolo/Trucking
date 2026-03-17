import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  details?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  details,
}) => {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 text-center space-y-5 px-6"
    >
      <div data-error-icon className="text-red-500" aria-hidden="true">
        <AlertCircle className="w-12 h-12" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">
          {message}
        </h3>
        {details && (
          <p
            data-details
            className="text-xs text-slate-500 font-mono bg-slate-900 rounded-xl px-4 py-3 text-left max-w-md"
          >
            {details}
          </p>
        )}
      </div>

      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/30"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  );
};
