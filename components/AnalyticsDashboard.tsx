import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  DollarSign,
  Fuel,
  MapPin,
  Users,
  ChevronRight,
  Zap,
  Scale,
  Clock,
  Package,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { LoadData, User, Broker } from "../types";
import { EmptyState } from "./EmptyState";

const CHART_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

type QuarterKey = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTER_OPTIONS: QuarterKey[] = ["Q1", "Q2", "Q3", "Q4"];

/**
 * Map a month index (0-11) to its fiscal quarter.
 * Jan-Mar → Q1, Apr-Jun → Q2, Jul-Sep → Q3, Oct-Dec → Q4.
 */
function monthToQuarter(month: number): QuarterKey {
  if (month <= 2) return "Q1";
  if (month <= 5) return "Q2";
  if (month <= 8) return "Q3";
  return "Q4";
}

/**
 * Compute the fiscal quarter of a LoadData entry from its pickupDate.
 * Returns null when pickupDate is missing or unparseable.
 */
function loadQuarter(pickupDate?: string): QuarterKey | null {
  if (!pickupDate) return null;
  const d = new Date(pickupDate);
  if (Number.isNaN(d.getTime())) return null;
  return monthToQuarter(d.getMonth());
}

interface FinancialObjective {
  id: string;
  company_id: string;
  quarter: string;
  revenue_target: number;
  expense_budget: number;
  profit_target: number;
  notes: string | null;
}

interface Props {
  user: User;
  loads: LoadData[];
  brokers?: Broker[];
  onNavigate?: (tab: string, subTab?: string) => void;
}

export const AnalyticsDashboard: React.FC<Props> = ({
  user,
  loads,
  brokers = [],
  onNavigate,
}) => {
  // R-P10-04: quarter selector state (defaults to current quarter for nicer UX)
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterKey>(() =>
    monthToQuarter(new Date().getMonth()),
  );

  // R-P10-05 / R-P10-06: objectives fetched per selected quarter
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const quarterKey = `${currentYear}-${selectedQuarter}`;
  const [objectives, setObjectives] = useState<FinancialObjective[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/financial-objectives?quarter=${encodeURIComponent(quarterKey)}`,
        );
        if (!res.ok) {
          if (!cancelled) setObjectives([]);
          return;
        }
        const data = (await res.json()) as FinancialObjective[];
        if (!cancelled) setObjectives(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setObjectives([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [quarterKey]);

  // R-P10-04: only loads whose pickupDate falls in the selected quarter feed
  // the lane analytics. When no loads match, topLanes degrades gracefully.
  const filteredLoads = useMemo(
    () => loads.filter((l) => loadQuarter(l.pickupDate) === selectedQuarter),
    [loads, selectedQuarter],
  );

  const historicalStats = useMemo(() => {
    const totalRevenue = loads.reduce((s, l) => s + (l.carrierRate || 0), 0);
    const totalMiles = loads.reduce((s, l) => s + (l.miles || 0), 0);
    const avgRPM = totalMiles > 0 ? totalRevenue / totalMiles : 0;

    return {
      totalRevenue,
      avgRPM,
    };
  }, [loads]);

  // Derive broker scorecards from real broker data
  const brokerScorecards = useMemo(() => {
    if (!brokers || brokers.length === 0) return [];
    return brokers.map((b) => {
      const brokerLoads = loads.filter((l) => l.brokerId === b.id);
      const totalRate = brokerLoads.reduce(
        (s, l) => s + (l.carrierRate || 0),
        0,
      );
      const totalMiles = brokerLoads.reduce((s, l) => s + (l.miles || 0), 0);
      const rpm = totalMiles > 0 ? totalRate / totalMiles : 0;
      return {
        id: b.id,
        name: b.name,
        rpm: Math.round(rpm * 100) / 100,
        loadCount: brokerLoads.length,
      };
    });
  }, [brokers, loads]);

  // Derive lane data from real loads (filtered by selected quarter, R-P10-04)
  const topLanes = useMemo(() => {
    const laneMap: Record<
      string,
      {
        vol: number;
        totalProfit: number;
        totalMiles: number;
        totalRevenue: number;
      }
    > = {};
    filteredLoads.forEach((l) => {
      const key = `${l.pickup?.city ?? ""}, ${l.pickup?.state ?? ""} \u2192 ${l.dropoff?.city ?? ""}, ${l.dropoff?.state ?? ""}`;
      if (!laneMap[key])
        laneMap[key] = {
          vol: 0,
          totalProfit: 0,
          totalMiles: 0,
          totalRevenue: 0,
        };
      laneMap[key].vol += 1;
      laneMap[key].totalProfit += (l.carrierRate || 0) - (l.driverPay || 0);
      laneMap[key].totalMiles += l.miles || 0;
      laneMap[key].totalRevenue += l.carrierRate || 0;
    });
    return Object.entries(laneMap)
      .map(([lane, data]) => ({
        lane,
        vol: data.vol,
        avgProfit: data.vol > 0 ? data.totalProfit / data.vol : 0,
        rpm: data.totalMiles > 0 ? data.totalProfit / data.totalMiles : 0,
        revenue: data.totalRevenue,
      }))
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 5);
  }, [filteredLoads]);

  // R-P10-05: compute actual totals from the filtered (quarter-scoped) loads.
  const quarterActuals = useMemo(() => {
    const actualRevenue = filteredLoads.reduce(
      (s, l) => s + (l.carrierRate || 0),
      0,
    );
    const actualExpense = filteredLoads.reduce(
      (s, l) => s + (l.driverPay || 0),
      0,
    );
    return {
      revenue: actualRevenue,
      expense: actualExpense,
      profit: actualRevenue - actualExpense,
    };
  }, [filteredLoads]);

  const hasObjectives = objectives.length > 0;

  if (loads.length === 0) {
    return (
      <div className="p-8 space-y-8 bg-[#0a0f18] min-h-full">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">
              Strategy &amp; Analytics
            </h1>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">
              Status: Trend Analysis &amp; Profitability Intelligence
            </p>
          </div>
        </div>
        <EmptyState
          icon={<BarChart3 className="w-16 h-16" />}
          title="No completed loads yet"
          description="Analytics will appear once you have completed loads with mileage and rate data."
          action={
            onNavigate
              ? {
                  label: "Go to Load Board",
                  onClick: () => onNavigate("loads"),
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[#0a0f18] min-h-full">
      {/* ANALYTICS DASHBOARD (HISTORY / STRATEGY) */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase">
            Strategy &amp; Analytics
          </h1>
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">
            Status: Trend Analysis &amp; Profitability Intelligence
          </p>
        </div>
        <div className="flex gap-3">
          <label htmlFor="analytics-quarter-selector" className="sr-only">
            Quarter
          </label>
          <div className="px-4 py-2.5 bg-slate-900 border border-white/5 rounded-xl text-slate-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <select
              id="analytics-quarter-selector"
              data-testid="quarter-selector"
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value as QuarterKey)}
              className="bg-transparent text-slate-300 text-xs font-bold uppercase tracking-widest outline-none"
            >
              {QUARTER_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* QUARTERLY OBJECTIVES (R-P10-05 / R-P10-06) */}
      {hasObjectives ? (
        <div
          data-testid="actual-vs-target"
          className="bg-[#0a0f1e] rounded-[2rem] border border-white/5 p-8 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">
                Actual vs Target
              </h2>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                {quarterKey} Progress
              </p>
            </div>
          </div>
          {(() => {
            const obj = objectives[0];
            const rows: Array<{
              key: string;
              label: string;
              actual: number;
              target: number;
            }> = [
              {
                key: "revenue",
                label: "Revenue",
                actual: quarterActuals.revenue,
                target: obj.revenue_target,
              },
              {
                key: "expense",
                label: "Expense",
                actual: quarterActuals.expense,
                target: obj.expense_budget,
              },
              {
                key: "profit",
                label: "Profit",
                actual: quarterActuals.profit,
                target: obj.profit_target,
              },
            ];
            return (
              <div className="space-y-4">
                {rows.map((r) => {
                  const pct =
                    r.target > 0
                      ? Math.min(100, Math.round((r.actual / r.target) * 100))
                      : 0;
                  return (
                    <div key={r.key}>
                      <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        <span>{r.label}</span>
                        <span className="font-mono text-blue-400">
                          ${r.actual.toLocaleString()} / $
                          {r.target.toLocaleString()}
                        </span>
                      </div>
                      <div
                        data-testid={`progress-bar-${r.key}`}
                        className="w-full h-2 bg-slate-900 rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
        <div
          data-testid="set-quarterly-targets"
          className="bg-[#0a0f1e] rounded-[2rem] border border-white/5 p-8 shadow-2xl flex items-center justify-between"
        >
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">
              Set quarterly targets
            </h2>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
              No revenue / expense / profit targets for {quarterKey}. Add
              objectives to track Actual vs Target.
            </p>
          </div>
        </div>
      )}

      {/* HIGH-LEVEL TRENDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            label: "Avg RPM",
            val: `$${historicalStats.avgRPM.toFixed(2)}`,
            icon: <DollarSign className="w-4 h-4" />,
            color: "text-blue-500",
          },
          {
            label: "Total Revenue",
            val: `$${historicalStats.totalRevenue.toLocaleString()}`,
            icon: <TrendingUp className="w-4 h-4" />,
            color: "text-emerald-500",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {stat.label}
              </div>
              <div
                className={`p-2 rounded-xl bg-slate-900 border border-white/5 ${stat.color}`}
              >
                {stat.icon}
              </div>
            </div>
            <div className="text-3xl font-black text-white">{stat.val}</div>
          </div>
        ))}
      </div>

      {/* PERFORMANCE GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Broker Scorecard */}
        <div className="bg-[#0a0f1e] rounded-[2rem] border border-white/5 p-8 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Broker Scorecard
                </h2>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                  Payment &amp; Yield Performance
                </p>
              </div>
            </div>
            <button
              aria-label="Broker scorecard options"
              className="p-2 text-slate-600 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {brokerScorecards.length > 0 ? (
            <div className="space-y-4">
              {/* Broker RPM BarChart */}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brokerScorecards}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "0.75rem",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="rpm" name="RPM" radius={[6, 6, 0, 0]}>
                      {brokerScorecards.map((_, idx) => (
                        <Cell
                          key={`broker-cell-${idx}`}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Broker list with drill-down */}
              <div className="grid grid-cols-3 px-4 text-[11px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 pb-2">
                <div className="col-span-2">Partner</div>
                <div>RPM</div>
              </div>
              {brokerScorecards.map((b, i) => (
                <div
                  key={i}
                  onClick={() => onNavigate?.("loads", `broker:${b.id}`)}
                  className="grid grid-cols-3 px-4 py-3 bg-slate-950/40 border border-white/5 rounded-2xl items-center group hover:bg-slate-900 transition-all cursor-pointer"
                >
                  <div className="col-span-2 text-xs font-bold text-white uppercase">
                    {b.name}
                  </div>
                  <div className="text-xs font-mono text-blue-400">
                    ${b.rpm.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title="No broker data"
              description="Add brokers and assign loads to see scorecard data."
            />
          )}
          <button
            onClick={() => onNavigate?.("network")}
            className="w-full mt-6 py-3 bg-slate-900/50 hover:bg-slate-900 text-slate-600 hover:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
          >
            Full Partner Analysis
          </button>
        </div>

        {/* Lane Profitability Heatmap (Table) */}
        <div className="bg-[#0a0f1e] rounded-[2rem] border border-white/5 p-8 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                <MapPin className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Lane Profitability
                </h2>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                  Top Lanes by Marginal Health
                </p>
              </div>
            </div>
            <button
              aria-label="Lane profitability options"
              className="p-2 text-slate-600 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {topLanes.length > 0 ? (
            <div className="space-y-4">
              {/* Lane Revenue PieChart */}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topLanes}
                      dataKey="revenue"
                      nameKey="lane"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={false}
                    >
                      {topLanes.map((_, idx) => (
                        <Cell
                          key={`lane-cell-${idx}`}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "0.75rem",
                        color: "#fff",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Lane list with drill-down */}
              {topLanes.map((l, i) => (
                <div
                  key={i}
                  onClick={() => onNavigate?.("loads", `lane:${l.lane}`)}
                  className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <div>
                      <div className="text-xs font-bold text-white uppercase">
                        {l.lane}
                      </div>
                      <div className="text-[11px] text-slate-600 font-black uppercase mt-1">
                        {l.vol} Load{l.vol !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white leading-none">
                      ${l.avgProfit.toFixed(0)}{" "}
                      <span className="text-[10px] text-slate-600 ml-1">
                        Avg Profit
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-blue-500 mt-1">
                      ${l.rpm.toFixed(2)} RPM
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<MapPin className="w-10 h-10" />}
              title="No lane data"
              description="Lane profitability will appear once loads include mileage."
            />
          )}
          <button
            onClick={() => onNavigate?.("map")}
            className="w-full mt-6 py-3 bg-slate-900/50 hover:bg-slate-900 text-slate-600 hover:text-purple-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
          >
            View Network Heatmap
          </button>
        </div>
      </div>
    </div>
  );
};
