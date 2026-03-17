import React, { useState, useEffect, useMemo } from "react";
import {
  Exception,
  ExceptionType,
  ExceptionStatus,
  User,
  LoadData,
} from "../types";
import {
  getExceptions,
  getExceptionTypes,
  updateException,
} from "../services/exceptionService";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  MoreVertical,
  Search,
  ArrowRight,
  User as UserIcon,
  Shield,
  FileText,
  Wrench,
  Truck,
  LayoutGrid,
  List,
} from "lucide-react";

interface Props {
  currentUser: User;
  initialView?: string;
  onViewDetail?: (type: string, id: string) => void;
}

export const ExceptionConsole: React.FC<Props> = ({
  currentUser,
  initialView,
  onViewDetail,
}) => {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [types, setTypes] = useState<ExceptionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(initialView || "all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [exs, ts] = await Promise.all([getExceptions(), getExceptionTypes()]);
    setExceptions(exs);
    setTypes(ts);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setActiveFilter(initialView || "all");
  }, [initialView]);

  const filteredExceptions = useMemo(() => {
    let result = exceptions;

    if (activeFilter !== "all") {
      // Mapping for common dashboard groups
      if (activeFilter === "delay-entry")
        result = result.filter(
          (ex) =>
            types.find((t) => t.typeCode === ex.type)?.dashboardGroup ===
            "Delay Entry",
        );
      else if (activeFilter === "carrier-delay")
        result = result.filter(
          (ex) =>
            types.find((t) => t.typeCode === ex.type)?.dashboardGroup ===
            "Carrier Delay",
        );
      else if (activeFilter === "maintenance")
        result = result.filter(
          (ex) =>
            types.find((t) => t.typeCode === ex.type)?.dashboardGroup ===
            "Maintenance Entry",
        );
      else if (activeFilter === "docs" || activeFilter === "missing-docs")
        result = result.filter(
          (ex) =>
            types.find((t) => t.typeCode === ex.type)?.dashboardGroup ===
              "Document Entry" || ex.type === "MISSING_POD",
        );
      else if (activeFilter === "billing" || activeFilter === "not-billed")
        result = result.filter(
          (ex) => ex.type === "UNBILLED_LOAD" || ex.type === "INVOICE_OVERDUE",
        );
      else if (activeFilter === "margin" || activeFilter === "negative-margin")
        result = result.filter(
          (ex) =>
            ex.type === "NEGATIVE_MARGIN" ||
            (ex.financialImpactEst && ex.financialImpactEst < 0),
        );
      else if (activeFilter === "costs" || activeFilter === "unallocated")
        result = result.filter(
          (ex) =>
            ex.type === "UNALLOCATED_EXPENSE" || ex.type === "ORPHAN_FUEL",
        );
      else if (activeFilter === "disputes")
        result = result.filter(
          (ex) => ex.type === "DISPUTED_INVOICE" || ex.type === "SHORT_PAY",
        );
      else if (activeFilter === "holds")
        result = result.filter((ex) => ex.type === "SETTLEMENT_HOLD");
      else if (activeFilter === "predictive")
        result = result.filter((ex) => {
          const slaDate = ex.slaDueAt ? new Date(ex.slaDueAt) : null;
          const isOverdueSoon = slaDate
            ? slaDate.getTime() - Date.now() < 4 * 3600000
            : false; // 4 hours
          return isOverdueSoon || ex.severity === 4;
        });
      else if (activeFilter === "system")
        result = result.filter(
          (ex) =>
            types.find((t) => t.typeCode === ex.type)?.dashboardGroup ===
            "System Entry",
        );
      else if (activeFilter === "my-team")
        result = result.filter((ex) => ex.team === currentUser.role);
      else if (activeFilter === "open")
        result = result.filter(
          (ex) => ex.status !== "RESOLVED" && ex.status !== "CLOSED",
        );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ex) =>
          ex.id.toLowerCase().includes(q) ||
          ex.description?.toLowerCase().includes(q) ||
          ex.entityId?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [exceptions, activeFilter, searchQuery, types, currentUser]);

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 4:
        return "text-red-500 bg-red-500/10 border-red-500/20";
      case 3:
        return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case 2:
        return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-slate-500 bg-slate-500/10 border-slate-500/20";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "OPEN":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "APPROVAL_REQUIRED":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "WAITING_EXTERNAL":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const handleResolve = (id: string) => {
    setConfirmResolveId(id);
  };

  const doResolve = async () => {
    if (!confirmResolveId) return;
    const id = confirmResolveId;
    setConfirmResolveId(null);
    const success = await updateException(id, {
      status: "RESOLVED",
      actorName: currentUser.name,
    });
    if (success) loadData();
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f18]">
      <ConfirmDialog
        open={confirmResolveId !== null}
        title="Resolve Exception"
        message="Mark this exception as resolved?"
        confirmLabel="Resolve"
        onConfirm={doResolve}
        onCancel={() => setConfirmResolveId(null)}
      />
      {/* Header & Controls */}
      <div className="p-6 border-b border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
              Issue Tracker
            </h1>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">
              Issue Management & Deadline Tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900 rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === "all" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter("predictive")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeFilter === "predictive" ? "bg-purple-600/10 text-purple-400 border-purple-500/30" : "text-slate-500 border-transparent hover:text-white"}`}
                >
                  AI Risk Predictions
                </button>
              </div>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-white"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-900 border border-white/5 rounded-xl text-slate-300 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2"
            >
              <Clock className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="text"
              placeholder="Filter by Load #, Driver, or Asset..."
              className="w-full bg-[#020617] border border-white/5 rounded-xl pl-12 pr-6 py-3 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-mono"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "all", label: "All" },
              { id: "open", label: "Triage" },
              { id: "docs", label: "Missing Docs" },
              { id: "costs", label: "Unallocated" },
              { id: "billing", label: "Not Billed" },
              { id: "margin", label: "Negative Margin" },
              { id: "disputes", label: "Disputes" },
              { id: "holds", label: "Holds" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeFilter === f.id ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-900 border-white/5 text-slate-500 hover:border-slate-700 hover:text-slate-300"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 animate-pulse">
            <Clock className="w-10 h-10 mb-4 opacity-20" />
            <p className="text-xs font-black uppercase tracking-[0.3em]">
              Synching Command Center...
            </p>
          </div>
        ) : filteredExceptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
            <div className="p-6 bg-slate-900/50 rounded-full border border-white/5">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/20" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-white uppercase tracking-widest">
                No Active Exceptions
              </p>
              <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">
                All issues resolved within time limits
              </p>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-[#020617] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Exception Type
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Entity
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Owner / Team
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Time / SLA
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Impact
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredExceptions.map((ex) => (
                  <tr
                    key={ex.id}
                    className="group hover:bg-slate-900/40 transition-all cursor-pointer"
                  >
                    <td className="px-6 py-5">
                      <span
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${getSeverityColor(ex.severity)}`}
                      >
                        {ex.severity === 4
                          ? "Critical"
                          : ex.severity === 3
                            ? "High"
                            : ex.severity === 2
                              ? "Medium"
                              : "Low"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl border ${getStatusStyle(ex.status)}`}
                        >
                          {types.find((t) => t.typeCode === ex.type)
                            ?.dashboardGroup === "Maintenance Entry" ? (
                            <Wrench className="w-4 h-4" />
                          ) : types.find((t) => t.typeCode === ex.type)
                              ?.dashboardGroup === "Document Entry" ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white uppercase">
                            {types.find((t) => t.typeCode === ex.type)
                              ?.displayName || ex.type}
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                            {ex.workflowStep}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() =>
                          onViewDetail?.(
                            ex.entityType || "LOAD",
                            ex.entityId || "",
                          )
                        }
                        className="text-left group/link"
                      >
                        <div className="text-xs font-bold text-blue-400 group-hover/link:text-blue-300 transition-colors uppercase">
                          {ex.entityType} #{ex.entityId}
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold uppercase">
                          Full Details &rarr;
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-300 uppercase">
                            {ex.ownerUserId || "Unassigned"}
                          </div>
                          <div className="text-[9px] text-slate-600 font-black uppercase">
                            {ex.team || "PENDING"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div className="text-xs font-mono text-slate-300">
                          {new Date(ex.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <div className="text-[9px] font-black text-red-500 uppercase">
                            SLA: 24m Left
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-xs font-mono font-bold text-emerald-500">
                        {ex.financialImpactEst
                          ? `$${ex.financialImpactEst.toLocaleString()}`
                          : "$0.00"}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleResolve(ex.id)}
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 rounded-xl transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredExceptions.map((ex) => (
              <div
                key={ex.id}
                className="bg-[#020617] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4 hover:border-blue-500/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${getSeverityColor(ex.severity)}`}
                  >
                    {ex.severity === 4
                      ? "Critical"
                      : ex.severity === 3
                        ? "High"
                        : "Normal"}
                  </span>
                  <div className="text-[10px] font-mono text-slate-600">
                    ID: {ex.id.split("-")[0]}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${getStatusStyle(ex.status)}`}
                  >
                    {types.find((t) => t.typeCode === ex.type)
                      ?.dashboardGroup === "Maintenance Entry" ? (
                      <Wrench className="w-6 h-6" />
                    ) : types.find((t) => t.typeCode === ex.type)
                        ?.dashboardGroup === "Document Entry" ? (
                      <FileText className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight leading-none">
                      {types.find((t) => t.typeCode === ex.type)?.displayName ||
                        ex.type}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                      Ref: {ex.entityType} #{ex.entityId}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic line-clamp-2">
                    "{ex.description || "No description provided."}"
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5">
                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">
                      Impact
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-500">
                      ${(ex.financialImpactEst || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5">
                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">
                      Time Lapsed
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-300">
                      01:42:00
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">
                      AR
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {ex.ownerUserId || "Dispatch"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      onViewDetail?.(ex.entityType || "LOAD", ex.entityId || "")
                    }
                    className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase flex items-center gap-2 transition-all"
                  >
                    Execute Action <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="p-4 bg-slate-950 border-t border-white/5 flex items-center justify-between px-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {exceptions.filter((e) => e.severity === 4).length} Critical
              Exceptions
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {exceptions.filter((e) => e.severity === 3).length} High Priority
            </span>
          </div>
        </div>
        <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">
          Average Resolution: 1h 14m
        </div>
      </div>
    </div>
  );
};
