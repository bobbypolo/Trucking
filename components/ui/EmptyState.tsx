import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center py-20 text-center space-y-5 px-6"
    >
      <div className="text-slate-600" aria-hidden="true">
        {icon || <Inbox className="w-12 h-12" />}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-slate-600 max-w-sm">{description}</p>
        )}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/30"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
