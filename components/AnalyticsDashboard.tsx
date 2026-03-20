import React, { useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  PieChart,
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
import { LoadData, User, Broker } from "../types";
import { EmptyState } from "./EmptyState";

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
        name: b.name,
        rpm,
        loadCount: brokerLoads.length,
      };
    });
  }, [brokers, loads]);

  // Derive lane data from real loads
  const topLanes = useMemo(() => {
    const laneMap: Record<
      string,
      { vol: number; totalProfit: number; totalMiles: number }
    > = {};
    loads.forEach((l) => {
      const key = `${l.pickup?.city ?? ""}, ${l.pickup?.state ?? ""} \u2192 ${l.dropoff?.city ?? ""}, ${l.dropoff?.state ?? ""}`;
      if (!laneMap[key])
        laneMap[key] = { vol: 0, totalProfit: 0, totalMiles: 0 };
      laneMap[key].vol += 1;
      laneMap[key].totalProfit += (l.carrierRate || 0) - (l.driverPay || 0);
      laneMap[key].totalMiles += l.miles || 0;
    });
    return Object.entries(laneMap)
      .map(([lane, data]) => ({
        lane,
        vol: data.vol,
        avgProfit: data.vol > 0 ? data.totalProfit / data.vol : 0,
        rpm: data.totalMiles > 0 ? data.totalProfit / data.totalMiles : 0,
      }))
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 3);
  }, [loads]);

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
          <div className="px-4 py-2.5 bg-slate-900 border border-white/5 rounded-xl text-slate-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4" /> All Time
          </div>
        </div>
      </div>

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
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  Broker Scorecard
                </h3>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                  Payment &amp; Yield Performance
                </p>
              </div>
            </div>
            <button className="p-2 text-slate-600 hover:text-white transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {brokerScorecards.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 px-4 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 pb-2">
                <div className="col-span-2">Partner</div>
                <div>RPM</div>
              </div>
              {brokerScorecards.map((b, i) => (
                <div
                  key={i}
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
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  Lane Profitability
                </h3>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                  Top Lanes by Marginal Health
                </p>
              </div>
            </div>
            <button className="p-2 text-slate-600 hover:text-white transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {topLanes.length > 0 ? (
            <div className="space-y-4">
              {topLanes.map((l, i) => (
                <div
                  key={i}
                  className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <div className="text-xs font-bold text-white uppercase">
                        {l.lane}
                      </div>
                      <div className="text-[9px] text-slate-600 font-black uppercase mt-1">
                        {l.vol} Load{l.vol !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-white leading-none">
                      ${l.avgProfit.toFixed(0)}{" "}
                      <span className="text-[8px] text-slate-600 ml-1">
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
