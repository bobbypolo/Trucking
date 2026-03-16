import React from "react";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
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
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="text-slate-700" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
        {title}
      </h3>
      <p className="text-xs text-slate-600 font-bold uppercase tracking-widest max-w-xs">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
