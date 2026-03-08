import React, { useState, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  Shield,
  Activity,
  Truck,
  User as UserIcon,
  Calendar,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { LoadData, DispatchEvent, User } from "../types";

interface AuditLogsProps {
  loads?: LoadData[];
  dispatchEvents?: DispatchEvent[];
  users?: User[];
  user?: User;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({
  loads,
  dispatchEvents,
  users,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "Status" | "Alert" | "System" | "Ops"
  >("all");

  const allEvents = useMemo(() => {
    const loadLogs = (loads || []).flatMap((load) =>
      (load.activityLog || []).map((log) => ({
        id: log.id,
        type: "Ops",
        category: log.type,
        message: log.message,
        timestamp: log.timestamp,
        user: log.user || "System",
        entity: `Load #${load.loadNumber}`,
      })),
    );

    const dispatchLogs = (dispatchEvents || []).map((event) => ({
      id: event.id,
      type: "Dispatch",
      category: event.eventType,
      message: event.message,
      timestamp: event.createdAt,
      user: (users || []).find((u) => u.id === event.dispatcherId)?.name || "Unknown",
      entity: `Load ID: ${event.loadId.substring(0, 8)}`,
    }));

    return [...loadLogs, ...dispatchLogs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [loads, dispatchEvents, users]);

  const filteredEvents = allEvents.filter((e) => {
    const matchesSearch =
      e.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "all" ||
      e.category === filterType ||
      e.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getIcon = (category: string) => {
    switch (category) {
      case "Status":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "Alert":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "StatusChange":
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">
            Audit Registry
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
            Immutable Transactional Governance Log
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="SEARCH REGISTRY..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all w-64"
            />
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {(["all", "Status", "Alert", "System", "Ops"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              filterType === f
                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "FULL STACK" : f}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
        <div className="overflow-y-auto p-6 space-y-4 no-scrollbar">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, idx) => (
              <div
                key={event.id + idx}
                className="group relative pl-8 pb-4 border-l border-slate-800 last:pb-0"
              >
                <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center group-hover:border-blue-500 transition-colors shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800 group-hover:bg-blue-500 transition-colors" />
                </div>

                <div className="bg-slate-900 border border-slate-800/50 rounded-2xl p-4 hover:bg-slate-800/40 transition-all hover:border-slate-700/50">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      {getIcon(event.category)}
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {event.category}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                        {event.entity}
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-300 leading-relaxed mb-3">
                    {event.message}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                      <UserIcon className="w-2.5 h-2.5 text-slate-500" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      ACTOR: {event.user}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">
                No Activity Detected
              </h3>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
                Adjust filters or search criteria.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
