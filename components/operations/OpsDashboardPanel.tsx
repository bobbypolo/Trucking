import React, { useMemo } from "react";
import {
  Truck,
  Globe,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Clock,
  DollarSign,
  Activity,
  AlertTriangle,
  Shield,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Exception, DashboardCard, LoadData, LOAD_STATUS } from "../../types";
import { LoadingSkeleton } from "../ui/LoadingSkeleton";
import { ErrorState } from "../ui/ErrorState";

interface OpsDashboardPanelProps {
  opsLoading: boolean;
  opsError: string | null;
  loadOpsDashboardData: () => void;
  loads: LoadData[];
  opsCards: DashboardCard[];
  opsExceptions: Exception[];
  onNavigate?: (tab: string, context?: string) => void;
}

export const OpsDashboardPanel: React.FC<OpsDashboardPanelProps> = ({
  opsLoading,
  opsError,
  loadOpsDashboardData,
  loads,
  opsCards,
  opsExceptions,
  onNavigate,
}) => {
  const loadsCount = loads.length;

  const opsStats = useMemo(() => {
    const grossRevenue = loads.reduce(
      (sum, l) => sum + (l.carrierRate || 0),
      0,
    );
    const operatorPay = loads.reduce((sum, l) => sum + (l.driverPay || 0), 0);
    const operatingMargin = grossRevenue - operatorPay;
    const activeLoads = loads.filter(
      (l) => l.status === LOAD_STATUS.Active,
    ).length;
    const inTransitLoads = loads.filter(
      (l) => l.status === "in_transit",
    ).length;
    const deliveredToday = loads.filter((l) => {
      if (l.status !== LOAD_STATUS.Delivered) return false;
      const today = new Date().toISOString().split("T")[0];
      return l.dropoffDate === today;
    }).length;
    const openExceptions = opsExceptions.length;
    const criticalExceptions = opsExceptions.filter(
      (ex) => ex.severity === 4,
    ).length;
    const slaBreaches = opsExceptions.filter((ex) => ex.severity === 4).length;
    const docHoldRevenue = opsExceptions
      .filter(
        (ex) => ex.type === "POD_MISSING" || ex.type === "DOC_PENDING_48H",
      )
      .reduce((sum, ex) => sum + (ex.financialImpactEst || 0), 0);

    const accruingDetention = opsExceptions
      .filter((ex) => ex.type === "DETENTION_ELIGIBLE")
      .reduce((sum, ex) => sum + (ex.financialImpactEst || 0), 0);

    const totalMiles = loads.reduce((sum, l) => sum + (l.miles || 0), 0);
    const avgRPM = totalMiles > 0 ? grossRevenue / totalMiles : 0;

    const slaHealth =
      loads.length > 0
        ? Math.round(((loads.length - slaBreaches) / loads.length) * 100)
        : 100;

    return {
      grossRevenue,
      operatingMargin,
      activeLoads,
      inTransitLoads,
      deliveredToday,
      openExceptions,
      criticalExceptions,
      slaBreaches,
      docHoldRevenue,
      accruingDetention,
      avgRPM,
      slaHealth,
    };
  }, [loads, opsExceptions]);

  const opsRpmByDay = useMemo(() => {
    if (loads.length === 0) return [];
    const now = new Date();
    const days: { date: string; rpm: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayLoads = loads.filter((l) => l.pickupDate === key);
      const totalRevenue = dayLoads.reduce(
        (s, l) => s + (l.carrierRate || 0),
        0,
      );
      const totalMiles = dayLoads.reduce((s, l) => s + (l.miles || 0), 0);
      const rpm = totalMiles > 0 ? totalRevenue / totalMiles : 0;
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      days.push({ date: label, rpm: parseFloat(rpm.toFixed(2)) });
    }
    return days;
  }, [loads]);

  const opsExceptionsByDay = useMemo(() => {
    if (opsExceptions.length === 0) return [];
    const now = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const count = opsExceptions.filter((ex) => {
        const exDate = ex.createdAt ? ex.createdAt.split("T")[0] : "";
        return exDate === key;
      }).length;
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      days.push({ date: label, count });
    }
    return days;
  }, [opsExceptions]);

  const opsRevenueCostByWeek = useMemo(() => {
    if (loads.length === 0) return [];
    const now = new Date();
    const weeks: { week: string; revenue: number; cost: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      const startKey = weekStart.toISOString().split("T")[0];
      const endKey = weekEnd.toISOString().split("T")[0];
      const weekLoads = loads.filter(
        (l) => l.pickupDate >= startKey && l.pickupDate <= endKey,
      );
      const revenue = weekLoads.reduce((s, l) => s + (l.carrierRate || 0), 0);
      const cost = weekLoads.reduce((s, l) => s + (l.driverPay || 0), 0);
      const label = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      weeks.push({ week: label, revenue, cost });
    }
    return weeks;
  }, [loads]);
  return (
    <div
      className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8 bg-[#0a0f18]"
      data-testid="operations-dashboard"
    >
      {opsLoading && <LoadingSkeleton variant="card" count={4} />}

      {!opsLoading && opsError && (
        <ErrorState message={opsError} onRetry={loadOpsDashboardData} />
      )}

      {!opsLoading && !opsError && (
        <>
          {/* HEADER */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                Operations Dashboard
              </h1>
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">
                Real-Time Operational Summary
              </p>
            </div>
          </div>

          {/* TOP ROW: LOAD SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div
              className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group hover:border-blue-500/30 transition-all shadow-2xl"
              data-testid="ops-kpi-active-loads"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Active Loads
                </div>
                <Truck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-4xl font-black text-white">
                {opsStats.activeLoads}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {opsStats.activeLoads === 0
                  ? "No active loads"
                  : "Currently Active"}
              </div>
            </div>

            <div className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group hover:border-emerald-500/30 transition-all shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  In Transit
                </div>
                <Globe className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-4xl font-black text-white">
                {opsStats.inTransitLoads}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {opsStats.inTransitLoads === 0
                  ? "No loads in transit"
                  : "On the Road"}
              </div>
            </div>

            <div className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group hover:border-indigo-500/30 transition-all shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Delivered Today
                </div>
                <CheckCircle className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-4xl font-black text-white">
                {opsStats.deliveredToday}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {opsStats.deliveredToday === 0
                  ? "No deliveries today"
                  : "Completed Today"}
              </div>
            </div>

            <div className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group hover:border-orange-500/30 transition-all shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Avg RPM
                </div>
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-4xl font-black text-white">
                ${opsStats.avgRPM.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {loadsCount === 0
                  ? "No load data available"
                  : "Revenue per Mile"}
              </div>
            </div>
          </div>

          {/* ISSUES & EXCEPTIONS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div
              onClick={() => onNavigate?.("exceptions", "all")}
              className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group cursor-pointer hover:border-blue-500/30 transition-all shadow-2xl"
              data-testid="ops-kpi-open-exceptions"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Open Exceptions
                </div>
                <AlertCircle className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
                {opsStats.openExceptions}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {opsStats.openExceptions === 0
                  ? "No open exceptions"
                  : "Active Work Items"}
              </div>
            </div>

            <div
              onClick={() => onNavigate?.("exceptions", "critical")}
              className="bg-red-500/5 p-6 rounded-[2rem] border border-red-500/20 group cursor-pointer hover:bg-red-500/10 transition-all shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                  SLA Breaches
                </div>
                <Clock className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
                {opsStats.slaBreaches}
              </div>
              <div className="text-[10px] text-red-700 font-bold uppercase mt-2">
                {opsStats.slaBreaches === 0
                  ? "No SLA breaches"
                  : "Critical Attention"}
              </div>
            </div>

            <div
              onClick={() => onNavigate?.("exceptions", "docs")}
              className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group cursor-pointer hover:border-emerald-500/30 transition-all shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  $ On Hold (Docs)
                </div>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
                ${opsStats.docHoldRevenue.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {opsStats.docHoldRevenue === 0
                  ? "No revenue on hold"
                  : "Revenue at Risk"}
              </div>
            </div>

            <div
              onClick={() => onNavigate?.("exceptions", "delay-entry")}
              className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group cursor-pointer hover:border-orange-500/30 transition-all shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  $ Accruing (Detention)
                </div>
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
                ${opsStats.accruingDetention.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
                {opsStats.accruingDetention === 0
                  ? "No accruing detention"
                  : "Estimated Layover/Stop"}
              </div>
            </div>
          </div>

          {/* FINANCIAL SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0f172a] p-6 rounded-[2rem] border border-blue-500/20 shadow-2xl">
              <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <DollarSign className="w-3 h-3" /> Revenue Summary
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Gross Revenue
                  </div>
                  <div className="text-xl font-black text-white">
                    {loadsCount > 0
                      ? `$${opsStats.grossRevenue.toLocaleString()}`
                      : "No data available"}
                  </div>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Operating Margin
                  </div>
                  <div className="text-xl font-black text-emerald-400">
                    {loadsCount > 0
                      ? `$${opsStats.operatingMargin.toLocaleString()}`
                      : "No data available"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0f172a] p-6 rounded-[2rem] border border-emerald-500/20 shadow-2xl">
              <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Shield className="w-3 h-3" /> SLA Health
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    On-Time Rate
                  </div>
                  <div className="text-xl font-black text-white">
                    {loadsCount > 0
                      ? `${opsStats.slaHealth}%`
                      : "No data available"}
                  </div>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Active Loads
                  </div>
                  <div className="text-xl font-black text-white">
                    {opsStats.activeLoads > 0
                      ? `${opsStats.activeLoads} In Progress`
                      : "No active loads"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0f172a] p-6 rounded-[2rem] border border-purple-500/20 shadow-2xl">
              <h2 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Activity className="w-3 h-3" /> Tracking Status
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase">
                      Vehicle Tracking
                    </div>
                    <div className="text-[10px] text-slate-600 font-bold uppercase">
                      Not configured — enable GPS/ELD integration
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase">
                      Last Sync
                    </div>
                    <div className="text-[10px] text-slate-600 font-bold uppercase">
                      No telemetry data available
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* RPM by Day BarChart */}
            <div className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 shadow-2xl">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> RPM by Day
              </h3>
              {opsRpmByDay.length > 0 ? (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={opsRpmByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 9 }}
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                      <Tooltip />
                      <Bar dataKey="rpm" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs font-bold uppercase">
                  No load data for this period
                </div>
              )}
            </div>

            {/* Exception Trend LineChart */}
            <div className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 shadow-2xl">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Exception
                Trend
              </h3>
              {opsExceptionsByDay.length > 0 ? (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={opsExceptionsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 9 }}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 9 }}
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ fill: "#ef4444" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs font-bold uppercase">
                  No exception data for this period
                </div>
              )}
            </div>

            {/* Revenue vs Cost BarChart */}
            <div className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 shadow-2xl">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Revenue
                vs Cost
              </h3>
              {opsRevenueCostByWeek.length > 0 ? (
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={opsRevenueCostByWeek}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="week"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar
                        dataKey="revenue"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="cost"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs font-bold uppercase">
                  No load data for this period
                </div>
              )}
            </div>
          </div>

          {/* ACTION QUEUES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Action Items Grid */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" /> Action Items
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {opsCards
                  .filter((c) => c.cardCode !== "ALL_EXCEPTIONS")
                  .map((card) => {
                    const filter =
                      typeof card.filterJson === "string"
                        ? JSON.parse(card.filterJson)
                        : card.filterJson || {};
                    const count = opsExceptions.filter(
                      (ex) =>
                        (filter.type_in
                          ? filter.type_in.includes(ex.type)
                          : true) &&
                        (filter.status_not_in
                          ? !filter.status_not_in.includes(ex.status)
                          : true),
                    ).length;

                    return (
                      <div
                        key={card.cardCode}
                        onClick={() =>
                          onNavigate?.(
                            "exceptions",
                            card.cardCode?.toLowerCase().replace("_", "-"),
                          )
                        }
                        className="bg-slate-900/40 border border-white/5 p-6 rounded-[1.5rem] flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all group-hover:shadow-lg group-hover:shadow-blue-500/20">
                            <Activity className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-white uppercase tracking-tight">
                              {card.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-bold uppercase mt-1">
                              Click to View
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-white">
                            {count}
                          </div>
                          <div className="text-[10px] font-bold text-slate-600 uppercase">
                            Items
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {opsCards.filter((c) => c.cardCode !== "ALL_EXCEPTIONS")
                  .length === 0 && (
                  <div className="col-span-2 text-center py-8 text-slate-500 text-xs font-bold uppercase">
                    No action item categories configured
                  </div>
                )}
              </div>
            </div>

            {/* Active Issues Feed */}
            <div className="bg-[#0a0f1e] rounded-[2rem] border border-white/10 p-8 flex flex-col min-h-[400px] shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">
                    Active Issues
                  </h2>
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-0.5">
                    High Severity Actions
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar relative z-10">
                {opsExceptions.slice(0, 6).map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => onNavigate?.("exceptions", "all")}
                    className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer border-l-4 border-l-red-500"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white uppercase">
                        {(ex.type || "EXC").replace("_", " ")}
                      </div>
                      <div className="text-[11px] text-slate-600 font-black uppercase">
                        Load #{ex.entityId} {"\u2022"}{" "}
                        {ex.ownerUserId || "Dispatch"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-black text-red-500 uppercase">
                        Sev {ex.severity || "\u2014"}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ${(ex.financialImpactEst || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {opsExceptions.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-10">
                    <CheckCircle className="w-10 h-10 text-emerald-500/20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      No Open Exceptions
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => onNavigate?.("exceptions")}
                className="w-full mt-8 py-4 bg-slate-900/50 hover:bg-slate-900 text-slate-500 hover:text-blue-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/5 transition-all relative z-10"
              >
                View All Exceptions
              </button>
            </div>
          </div>

          {/* BOTTOM ROW: QUICK INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 bg-slate-900/20 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Fleet Overview
                </h2>
                <div className="flex items-center gap-4 mt-4">
                  <div className="text-2xl font-black text-white">
                    {opsStats.inTransitLoads}{" "}
                    <span className="text-slate-600 text-[10px] font-bold">
                      In-Transit
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-2xl font-black text-white">
                    {loadsCount > 0 ? `${opsStats.slaHealth}%` : "N/A"}{" "}
                    <span className="text-slate-600 text-[10px] font-bold">
                      SLA Health
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.("map")}
                className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-500 hover:bg-blue-600 hover:text-white transition-all"
              >
                <Globe className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-slate-900/20 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                Open Doc Exceptions
              </div>
              <div className="mt-2">
                <div className="text-sm font-black text-red-500 uppercase">
                  {
                    opsExceptions.filter(
                      (ex) =>
                        ex.type === "POD_MISSING" ||
                        ex.type === "DOC_PENDING_48H",
                    ).length
                  }{" "}
                  Pending
                </div>
                <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">
                  {opsExceptions.filter(
                    (ex) =>
                      ex.type === "POD_MISSING" ||
                      ex.type === "DOC_PENDING_48H",
                  ).length === 0
                    ? "No documents on hold"
                    : "Revenue on hold"}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/20 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                Accruing Detention
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-500 font-mono">
                ${opsStats.accruingDetention.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">
                {opsStats.accruingDetention === 0
                  ? "No accruing detention"
                  : "Today's Revenue Capture"}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
