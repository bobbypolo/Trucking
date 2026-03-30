import React from "react";

interface ActionGroupAction {
  label: string;
  action: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

interface ActionGroupProps {
  label: string;
  color: string;
  actions: ActionGroupAction[];
  icon?: React.ComponentType<{ className?: string }>;
  isHighObstruction?: boolean;
}

export const ActionGroup: React.FC<ActionGroupProps> = ({
  label,
  color,
  actions,
  icon: Icon,
  isHighObstruction,
}) => (
  <div
    className={`px-2 rounded-2xl border border-white/5 flex items-center gap-1 bg-white/[0.03] backdrop-blur-md transition-all ${isHighObstruction ? "py-0.5" : "py-1.5"}`}
  >
    <div
      className={`px-2.5 py-1.5 rounded-xl bg-${color}-500/10 text-${color}-400 text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 border border-${color}-500/10 ${isHighObstruction ? "scale-90 origin-left" : ""}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </div>
    <div className="flex gap-0.5">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.action}
          className={`hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all group flex items-center gap-2 ${isHighObstruction ? "p-1" : "p-1.5"}`}
          title={a.label}
        >
          <a.icon
            className={`${isHighObstruction ? "w-3 h-3" : "w-4 h-4"} opacity-70 group-hover:opacity-100 group-hover:text-blue-400`}
          />
          <span className="text-[10px] font-black uppercase hidden group-hover:inline-block whitespace-nowrap tracking-wide">
            {a.label}
          </span>
        </button>
      ))}
    </div>
  </div>
);
