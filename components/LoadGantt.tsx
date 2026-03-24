import React from "react";
import { Truck, CheckCircle2, Circle, Clock } from "lucide-react";
import { LoadData, LOAD_STATUS, LoadStatus } from "../types";

interface Props {
  loads: LoadData[];
}

export const LoadGantt: React.FC<Props> = ({ loads }) => {
  // Sort by status and ID
  const sortedLoads = [...loads].sort((a, b) => {
    const order: Record<string, number> = {
      [LOAD_STATUS.In_Transit]: 1,
      [LOAD_STATUS.Planned]: 2,
      [LOAD_STATUS.Draft]: 3,
    };
    return (
      (order[a.status as keyof typeof order] || 4) -
      (order[b.status as keyof typeof order] || 4)
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl h-[400px]">
      {/* Header */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Operational Sequence
          </h3>
          <div className="flex gap-2">
            <span className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
              Active:{" "}
              {loads.filter((l) => l.status === LOAD_STATUS.Active).length}
            </span>
            <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
              Total: {loads.length}
            </span>
          </div>
        </div>
        <div className="flex gap-8 text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-800" /> Planned
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />{" "}
            Execution
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-600" /> Completed
          </div>
        </div>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar">
        <div className="min-w-[1000px]">
          {sortedLoads.map((load, idx) => (
            <div
              key={load.id}
              className={`flex items-center border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${idx % 2 === 0 ? "bg-slate-900/30" : ""}`}
            >
              {/* Load Label (Sticky-like left column) */}
              <div className="w-48 px-6 py-4 border-r border-slate-800/50 shrink-0">
                <div className="text-[10px] font-black text-white group-hover:text-blue-400 transition-colors">
                  #{load.loadNumber}
                </div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-1 truncate">
                  {load.commodity || "General Freight"}
                </div>
              </div>

              {/* Timeline Bar Container */}
              <div className="flex-1 px-8 relative h-16 flex items-center">
                {/* Track Line */}
                <div className="absolute left-8 right-8 h-0.5 bg-slate-800 rounded-full" />

                {/* Progress Bar */}
                <div className="relative flex-1 flex items-center h-full">
                  {/* Map each leg or stage */}
                  {/* For simulation, we'll create segmented bars based on status */}
                  <div className="w-full flex items-center gap-0">
                    <div
                      className={`h-1.5 rounded-l-full relative transition-all duration-700 ${load.status === LOAD_STATUS.Active || load.status === LOAD_STATUS.Delivered ? "bg-blue-600 w-1/3" : "bg-slate-800 w-1/12"}`}
                    >
                      <div className="absolute -top-6 left-0 text-[7px] font-black text-slate-500 whitespace-nowrap">
                        PICKUP
                      </div>
                      {(load.status === LOAD_STATUS.Active ||
                        load.status === LOAD_STATUS.Delivered) && (
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg z-10">
                          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    <div
                      className={`h-1.5 relative transition-all duration-1000 ${load.status === LOAD_STATUS.Active ? "bg-gradient-to-r from-blue-600 to-blue-400 w-1/2 animate-pulse" : load.status === LOAD_STATUS.Delivered ? "bg-blue-400 w-1/2" : "bg-slate-800 w-1/12"}`}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-slate-500 whitespace-nowrap">
                        TRANSIT
                      </div>
                      {load.status === LOAD_STATUS.Active && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 transform translate-x-1/2">
                          <div className="bg-blue-500 p-1.5 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                            <Truck className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`h-1.5 rounded-r-full relative transition-all duration-700 ${load.status === LOAD_STATUS.Delivered ? "bg-green-600 flex-1" : "bg-slate-800 flex-1"}`}
                    >
                      <div className="absolute -top-6 right-0 text-[7px] font-black text-slate-500 whitespace-nowrap text-right">
                        DELIVERY
                      </div>
                      {load.status === LOAD_STATUS.Delivered && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg z-10">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Milestone Times */}
                <div className="absolute bottom-1 left-8 flex items-center gap-1 text-[7px] font-black text-slate-600">
                  <Clock className="w-2 h-2" />{" "}
                  {load.pickupDate
                    ? new Date(load.pickupDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </div>
                <div className="absolute bottom-1 right-8 flex items-center gap-1 text-[7px] font-black text-slate-600">
                  ETA:{" "}
                  {load.dropoffDate
                    ? new Date(load.dropoffDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Pagination hint */}
      <div className="bg-slate-950 px-6 py-2 border-t border-slate-800 flex justify-between items-center text-[8px] font-black text-slate-500 uppercase tracking-widest shrink-0">
        <div>SCROLL TO VIEW ALL ACTIVE MANIFESTS</div>
        <div className="flex gap-4">
          <span>{loads.length} LOADS TRACKED</span>
          <span
            className={loads.length > 0 ? "text-blue-500" : "text-slate-600"}
          >
            {loads.length > 0 ? "REAL-TIME SYNC ACTIVE" : "NO ACTIVE LOADS"}
          </span>
        </div>
      </div>
    </div>
  );
};
