import React, { useState, useEffect, useCallback, Suspense } from "react";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";
import {
  DollarSign,
  Truck,
  CheckCircle,
  Clock,
  ArrowUpRight,
  FileText,
  Users,
} from "lucide-react";
import { getSettlements } from "../services/financialService";
import { DriverSettlement, LoadData, User } from "../types";

const Settlements = React.lazy(() =>
  import("./Settlements").then((m) => ({ default: m.Settlements })),
);

interface Props {
  loads: LoadData[];
  users: User[];
  currentUser: User;
  onNavigate?: (tab: string, subTab?: string) => void;
}

const DriverPayPortal: React.FC<Props> = ({
  loads,
  users,
  currentUser,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "SETTLEMENTS" | "LOADS"
  >("OVERVIEW");
  const [settlements, setSettlements] = useState<DriverSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const sets = await getSettlements(undefined, signal);
      if (signal?.aborted) return;
      setSettlements(Array.isArray(sets) ? sets : []);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (signal?.aborted) return;
      setLoadError("Failed to load driver pay data. Please try again.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Driver-relevant loads (completed/delivered)
  const driverLoads = loads.filter(
    (l) => l.status === "delivered" || l.status === "completed",
  );

  const totalEarnings = settlements.reduce(
    (sum, s) => sum + (Number(s.netPay) || Number(s.totalEarnings) || 0),
    0,
  );
  const pendingSettlements = settlements.filter(
    (s) => s.status === "Draft" || s.status === "Calculated",
  ).length;
  const paidSettlements = settlements.filter(
    (s) => s.status === "Paid" || s.status === "Approved",
  ).length;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading driver pay data"
        className="h-full flex flex-col bg-[#020617] text-slate-100 p-10"
      >
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col bg-[#020617] text-slate-100">
        <ErrorState message={loadError} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100">
      {/* HEADER */}
      <div className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/5 px-10 py-8 shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-500" />
            Driver Pay
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 ml-1">
            Settlements • Earnings • Payout Status
          </p>
        </div>
        <div className="flex bg-slate-950 border border-white/5 rounded-2xl p-1 shadow-2xl">
          {[
            { id: "OVERVIEW", icon: DollarSign, label: "Overview" },
            { id: "SETTLEMENTS", icon: Users, label: "Settlements" },
            { id: "LOADS", icon: Truck, label: "Completed Loads" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-10">
        {activeTab === "OVERVIEW" && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-6">
              {[
                {
                  label: "Total Earnings",
                  val: formatCurrency(totalEarnings),
                  sub: `${settlements.length} Settlements`,
                  icon: DollarSign,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/5",
                },
                {
                  label: "Pending Settlements",
                  val: String(pendingSettlements),
                  sub: "Awaiting Approval",
                  icon: Clock,
                  color: "text-orange-500",
                  bg: "bg-orange-500/5",
                },
                {
                  label: "Paid Settlements",
                  val: String(paidSettlements),
                  sub: "Processed",
                  icon: CheckCircle,
                  color: "text-blue-500",
                  bg: "bg-blue-500/5",
                },
                {
                  label: "Completed Loads",
                  val: String(driverLoads.length),
                  sub: "Delivered & Settled",
                  icon: Truck,
                  color: "text-purple-500",
                  bg: "bg-purple-500/5",
                },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className={`p-8 rounded-[2.5rem] border border-white/5 ${kpi.bg} backdrop-blur-sm shadow-xl`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {kpi.label}
                    </span>
                  </div>
                  <div
                    className={`text-4xl font-black tracking-tighter ${kpi.color}`}
                  >
                    {kpi.val}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase mt-3">
                    {kpi.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Settlements */}
            <div>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                  Recent Settlements
                </h2>
                <button
                  onClick={() => setActiveTab("SETTLEMENTS")}
                  className="text-[10px] font-black text-blue-500 uppercase hover:underline"
                >
                  View All
                </button>
              </div>
              {settlements.length === 0 ? (
                <EmptyState
                  title="No Settlements Yet"
                  description="Settlements will appear here once loads are completed and processed."
                />
              ) : (
                <div className="bg-[#0a0f1e]/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-black/20 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Settlement
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Period
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Gross
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Deductions
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Net Pay
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {settlements.slice(0, 10).map((s, i) => (
                        <tr
                          key={s.id || i}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="text-xs font-black text-white uppercase">
                              {`STL-${s.id?.slice(0, 6) || String(i + 1).padStart(4, "0")}`}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[10px] text-slate-400">
                            {s.periodStart || "—"} — {s.periodEnd || "—"}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-white">
                            {formatCurrency(Number(s.totalEarnings) || 0)}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-red-400">
                            {formatCurrency(Number(s.totalDeductions) || 0)}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-emerald-500">
                            {formatCurrency(
                              Number(s.netPay) || Number(s.totalEarnings) || 0,
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                                s.status === "Paid" || s.status === "Approved"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-orange-500/10 text-orange-500"
                              }`}
                            >
                              {s.status || "Draft"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Completed Loads */}
            <div>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                  Recent Completed Loads
                </h2>
                <button
                  onClick={() => setActiveTab("LOADS")}
                  className="text-[10px] font-black text-blue-500 uppercase hover:underline"
                >
                  View All
                </button>
              </div>
              {driverLoads.length === 0 ? (
                <EmptyState
                  title="No Completed Loads"
                  description="Completed loads will appear here as you finish deliveries."
                />
              ) : (
                <div className="bg-[#0a0f1e]/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-black/20 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Load
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Route
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Driver Pay
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {driverLoads.slice(0, 8).map((load, i) => (
                        <tr
                          key={load.id || i}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-4 text-xs font-black text-white uppercase">
                            {load.loadNumber ||
                              load.id?.slice(0, 8) ||
                              `LD-${i}`}
                          </td>
                          <td className="px-6 py-4 text-[10px] text-slate-400">
                            {load.pickup?.city || "—"},{" "}
                            {load.pickup?.state || ""} →{" "}
                            {load.dropoff?.city || "—"},{" "}
                            {load.dropoff?.state || ""}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-emerald-500">
                            {formatCurrency(Number(load.driverPay) || 0)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500">
                              {load.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "SETTLEMENTS" && (
          <Suspense fallback={<LoadingSkeleton variant="table" count={5} />}>
            <Settlements loads={loads} users={users} />
          </Suspense>
        )}

        {activeTab === "LOADS" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              All Completed Loads
            </h2>
            {driverLoads.length === 0 ? (
              <EmptyState
                title="No Completed Loads"
                description="Completed loads will appear here as you finish deliveries."
              />
            ) : (
              <div className="bg-[#0a0f1e]/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-black/20 border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                        Load
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                        Route
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                        Pickup Date
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                        Equipment
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                        Driver Pay
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {driverLoads.map((load, i) => (
                      <tr
                        key={load.id || i}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4 text-xs font-black text-white uppercase">
                          {load.loadNumber || load.id?.slice(0, 8) || `LD-${i}`}
                        </td>
                        <td className="px-6 py-4 text-[10px] text-slate-400">
                          {load.pickup?.city || "—"}, {load.pickup?.state || ""}{" "}
                          → {load.dropoff?.city || "—"},{" "}
                          {load.dropoff?.state || ""}
                        </td>
                        <td className="px-6 py-4 text-[10px] text-slate-400">
                          {load.pickupDate || "—"}
                        </td>
                        <td className="px-6 py-4 text-[10px] text-slate-400 uppercase">
                          {load.freightType || "—"}
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-black text-emerald-500">
                          {formatCurrency(Number(load.driverPay) || 0)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500">
                            {load.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverPayPortal;
