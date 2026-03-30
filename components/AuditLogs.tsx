import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "../services/config";
import {
  History,
  Search,
  Activity,
  User as UserIcon,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { User } from "../types";

interface AuditEntry {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  load_id: string;
  load_number?: string;
  actor_name?: string;
}

interface AuditLogsProps {
  /** Legacy props kept for backward compatibility — ignored when API is available */
  loads?: unknown[];
  dispatchEvents?: unknown[];
  users?: User[];
  user?: User;
}

const PAGE_SIZE = 50;

export const AuditLogs: React.FC<AuditLogsProps> = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const fetchAudit = useCallback(
    async (currentOffset: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        });
        if (filterType !== "all") {
          params.set("type", filterType);
        }

        const res = await fetch(`${API_URL}/audit?${params.toString()}`, {
          credentials: "include",
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          entries: AuditEntry[];
          total: number;
        };

        if (append) {
          setEntries((prev) => [...prev, ...(data.entries ?? [])]);
        } else {
          setEntries(data.entries ?? []);
        }
        setTotal(data.total ?? 0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterType],
  );

  // Reload from offset 0 whenever filter changes
  useEffect(() => {
    setOffset(0);
    fetchAudit(0, false);
  }, [fetchAudit]);

  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchAudit(nextOffset, true);
  };

  const handleRetry = () => {
    setOffset(0);
    fetchAudit(0, false);
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (e.message ?? "").toLowerCase().includes(term) ||
      (e.load_number ?? "").toLowerCase().includes(term) ||
      (e.actor_name ?? "").toLowerCase().includes(term) ||
      (e.event_type ?? "").toLowerCase().includes(term)
    );
  });

  const getIcon = (eventType: string) => {
    switch (eventType) {
      case "StatusChange":
        return <Activity className="w-4 h-4 text-blue-500" />;
      case "Alert":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "Status":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  const filterTypes = ["all", "StatusChange", "Assignment", "Alert", "System"];

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header — Load Activity Audit scope label */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">
            Load Activity Audit
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
            Dispatch &amp; Load State Audit — load and dispatch events only
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="SEARCH AUDIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all w-64"
            />
          </div>
          <button
            onClick={handleRetry}
            disabled={loading}
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {filterTypes.map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              filterType === f
                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "ALL EVENTS" : f}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-4 bg-red-900/20 border border-red-800/50 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs font-bold text-red-300 uppercase tracking-wide">
              Failed to load audit data: {error}
            </span>
          </div>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 bg-red-800/50 border border-red-700/50 rounded-lg text-[10px] font-black text-red-300 uppercase tracking-widest hover:bg-red-700/50 transition-all flex-shrink-0"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
        <div className="overflow-y-auto p-6 space-y-4 no-scrollbar">
          {loading && entries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
              </div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">
                Loading Audit Log
              </h3>
            </div>
          ) : filteredEntries.length > 0 ? (
            <>
              {filteredEntries.map((event, idx) => (
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
                        {getIcon(event.event_type)}
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {event.event_type}
                        </span>
                        {event.load_number && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                              {event.load_number}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                        {new Date(event.created_at).toLocaleString()}
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
                        ACTOR: {event.actor_name ?? "System"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Load more */}
              {entries.length < total && (
                <div className="pt-2 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {loadingMore
                      ? "LOADING..."
                      : `LOAD MORE (${total - entries.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">
                No Activity Detected
              </h3>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
                {error
                  ? "API error — use retry button above."
                  : "Adjust filters or search criteria."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
