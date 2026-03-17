import React from "react";

interface LoadingSkeletonProps {
  variant: "card" | "table" | "list";
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant,
  count = 3,
}) => {
  if (variant === "card") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading content"
        className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            data-skeleton-item
            className="bg-slate-800/60 rounded-[2rem] p-6 border border-white/5 space-y-4"
          >
            <div className="h-3 bg-slate-700 rounded-full w-1/2" />
            <div className="h-8 bg-slate-700 rounded-xl w-3/4" />
            <div className="h-2 bg-slate-700/60 rounded-full w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading table"
        className="animate-pulse space-y-2"
      >
        {/* Header row */}
        <div
          data-skeleton-item
          className="flex gap-4 px-4 py-3 bg-slate-800/40 rounded-xl"
        >
          <div className="h-3 bg-slate-600 rounded-full w-1/4" />
          <div className="h-3 bg-slate-600 rounded-full w-1/4" />
          <div className="h-3 bg-slate-600 rounded-full w-1/4" />
          <div className="h-3 bg-slate-600 rounded-full w-1/4" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            data-skeleton-item
            className="flex gap-4 px-4 py-3 bg-slate-800/20 rounded-xl border border-white/5"
          >
            <div className="h-3 bg-slate-700 rounded-full w-1/4" />
            <div className="h-3 bg-slate-700/60 rounded-full w-1/4" />
            <div className="h-3 bg-slate-700 rounded-full w-1/4" />
            <div className="h-3 bg-slate-700/60 rounded-full w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  // list variant
  return (
    <div
      aria-busy="true"
      aria-label="Loading list"
      className="animate-pulse space-y-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-skeleton-item
          className="flex items-center gap-4 px-4 py-3 bg-slate-800/40 rounded-2xl border border-white/5"
        >
          <div className="w-8 h-8 bg-slate-700 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-700 rounded-full w-3/4" />
            <div className="h-2 bg-slate-700/60 rounded-full w-1/2" />
          </div>
          <div className="h-3 bg-slate-700 rounded-full w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
};
