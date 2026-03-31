import React, { useMemo } from "react";
import { Truck, CheckCircle2, Clock } from "lucide-react";
import { LoadData, LOAD_STATUS } from "../types";

interface Props {
  loads: LoadData[];
}

/** Compute progress percentage (0-100) from real pickup/dropoff dates */
function computeProgress(load: LoadData): number {
  const pickup = load.pickupDate ? new Date(load.pickupDate).getTime() : 0;
  const dropoff = load.dropoffDate ? new Date(load.dropoffDate).getTime() : 0;

  // Completed loads are 100%
  if (
    load.status === LOAD_STATUS.Delivered ||
    load.status === LOAD_STATUS.Completed
  )
    return 100;

  // No dates — show 0% for draft/planned
  if (!pickup || !dropoff || dropoff <= pickup) {
    if (
      load.status === LOAD_STATUS.In_Transit ||
      load.status === LOAD_STATUS.Dispatched
    )
      return 50;
    return 0;
  }

  const now = Date.now();
  if (now <= pickup) return 0;
  if (now >= dropoff) return 100;

  return Math.round(((now - pickup) / (dropoff - pickup)) * 100);
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export const LoadGantt: React.FC<Props> = ({ loads }) => {
  // Sort by pickup date (earliest first), then by status priority
  const sortedLoads = useMemo(
    () =>
      [...loads].sort((a, b) => {
        const order: Record<string, number> = {
          [LOAD_STATUS.In_Transit]: 1,
          [LOAD_STATUS.Dispatched]: 1,
          [LOAD_STATUS.Planned]: 2,
          [LOAD_STATUS.Draft]: 3,
        };
        const statusDiff = (order[a.status] || 4) - (order[b.status] || 4);
        if (statusDiff !== 0) return statusDiff;
        // Within same status, sort by pickup date
        const aDate = a.pickupDate
          ? new Date(a.pickupDate).getTime()
          : Infinity;
        const bDate = b.pickupDate
          ? new Date(b.pickupDate).getTime()
          : Infinity;
        return aDate - bDate;
      }),
    [loads],
  );

  const activeCount = loads.filter(
    (l) =>
      l.status === LOAD_STATUS.In_Transit ||
      l.status === LOAD_STATUS.Dispatched,
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl h-[400px]">
      {/* Header */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Operational Sequence
          </h3>
          <div className="flex gap-2">
            <span className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
              Active: {activeCount}
            </span>
            <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
              Total: {loads.length}
            </span>
          </div>
        </div>
        <div className="flex gap-8 text-[11px] font-black text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-800" /> Planned
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />{" "}
            In Transit
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-600" /> Delivered
          </div>
        </div>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar">
        <div className="min-w-[1000px]">
          {sortedLoads.length === 0 && (
            <div className="flex items-center justify-center h-40 text-slate-600 text-xs font-bold uppercase tracking-widest">
              No loads to display
            </div>
          )}
          {sortedLoads.map((load, idx) => {
            const progress = computeProgress(load);
            const isActive =
              load.status === LOAD_STATUS.In_Transit ||
              load.status === LOAD_STATUS.Dispatched;
            const isDelivered =
              load.status === LOAD_STATUS.Delivered ||
              load.status === LOAD_STATUS.Completed;
            const pickupComplete = progress > 0;
            const transitPct = Math.min(progress, 100);

            return (
              <div
                key={load.id}
                className={`flex items-center border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${idx % 2 === 0 ? "bg-slate-900/30" : ""}`}
              >
                {/* Load Label */}
                <div className="w-48 px-6 py-4 border-r border-slate-800/50 shrink-0">
                  <div className="text-[10px] font-black text-white group-hover:text-blue-400 transition-colors">
                    #{load.loadNumber}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1 truncate">
                    {load.commodity || load.freightType || "Unspecified"}
                  </div>
                  {load.pickupDate && (
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {formatDate(load.pickupDate)}
                    </div>
                  )}
                </div>

                {/* Timeline Bar — widths computed from real date progress */}
                <div className="flex-1 px-8 relative h-16 flex items-center">
                  <div className="absolute left-8 right-8 h-0.5 bg-slate-800 rounded-full" />

                  <div className="relative flex-1 flex items-center h-full">
                    <div className="w-full flex items-center gap-0">
                      {/* Pickup segment */}
                      <div
                        className={`h-1.5 rounded-l-full relative transition-all duration-700 ${pickupComplete ? "bg-blue-600" : "bg-slate-800"}`}
                        style={{
                          width: `${Math.max(pickupComplete ? 15 : 5, Math.min(transitPct * 0.3, 30))}%`,
                        }}
                      >
                        <div className="absolute -top-6 left-0 text-[10px] font-black text-slate-500 whitespace-nowrap">
                          PICKUP
                        </div>
                        {pickupComplete && (
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg z-10">
                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Transit segment — width reflects actual progress between pickup and dropoff */}
                      <div
                        className={`h-1.5 relative transition-all duration-1000 ${
                          isActive
                            ? "bg-gradient-to-r from-blue-600 to-blue-400 animate-pulse"
                            : isDelivered
                              ? "bg-blue-400"
                              : "bg-slate-800"
                        }`}
                        style={{
                          width: `${Math.max(isActive || isDelivered ? 20 : 5, transitPct * 0.5)}%`,
                        }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-500 whitespace-nowrap">
                          TRANSIT
                        </div>
                        {isActive && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 transform translate-x-1/2">
                            <div className="bg-blue-500 p-1.5 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                              <Truck className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Delivery segment */}
                      <div
                        className={`h-1.5 rounded-r-full relative transition-all duration-700 flex-1 ${isDelivered ? "bg-green-600" : "bg-slate-800"}`}
                      >
                        <div className="absolute -top-6 right-0 text-[10px] font-black text-slate-500 whitespace-nowrap text-right">
                          DELIVERY
                        </div>
                        {isDelivered && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg z-10">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Milestone Times from real load dates */}
                  <div className="absolute bottom-1 left-8 flex items-center gap-1 text-[10px] font-black text-slate-600">
                    <Clock className="w-2 h-2" /> {formatTime(load.pickupDate)}
                  </div>
                  <div className="absolute bottom-1 right-8 flex items-center gap-1 text-[10px] font-black text-slate-600">
                    ETA: {formatTime(load.dropoffDate)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-950 px-6 py-2 border-t border-slate-800 flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">
        <div>
          {sortedLoads.length > 0
            ? "SCROLL TO VIEW ALL ACTIVE MANIFESTS"
            : "NO LOADS SCHEDULED"}
        </div>
        <div className="flex gap-4">
          <span>{loads.length} LOADS TRACKED</span>
          {loads.length > 0 && <span className="text-blue-500">LIVE</span>}
        </div>
      </div>
    </div>
  );
};
