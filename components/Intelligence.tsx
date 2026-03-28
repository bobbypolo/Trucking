import React, { useMemo, useState } from "react";
import { LoadData, Broker } from "../types";
// Added ChevronRight to fix missing import error
import {
  TrendingUp,
  MapPin,
  Building2,
  Search,
  ArrowRight,
  BarChart3,
  Navigation,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  Eye,
  Briefcase,
  DollarSign,
  Activity,
  Star,
  X,
  CheckCircle,
  Clock,
  AlertOctagon,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Globe,
  Target,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  loads: LoadData[];
  brokers: Broker[];
  onViewLoad?: (load: LoadData) => void;
}

export const Intelligence: React.FC<Props> = ({
  loads,
  brokers,
  onViewLoad,
}) => {
  const [activeTab, setActiveTab] = useState<
    "market" | "facilities" | "brokers"
  >("market");
  const [filter, setFilter] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "facility" | "broker";
    data: any;
  } | null>(null);

  const normalize = (str?: string) =>
    str
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "";

  // --- ANALYTICS PROCESSING LOGIC ---
  const facilityData = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        city: string;
        state: string;
        visits: number;
        loads: LoadData[];
        detentionCount: number;
        lateCount: number;
        brokers: Map<string, { count: number; totalRate: number }>;
      }
    >();
    const processFacility = (
      name: string | undefined,
      city: string,
      state: string,
      load: LoadData,
    ) => {
      if (!name) return;
      const key = normalize(name + city + state);
      if (!map.has(key))
        map.set(key, {
          name,
          city,
          state,
          visits: 0,
          loads: [],
          detentionCount: 0,
          lateCount: 0,
          brokers: new Map(),
        });
      const entry = map.get(key)!;
      entry.visits++;
      entry.loads.push(load);
      if (load.expenses?.some((e) => e.category === "Detention"))
        entry.detentionCount++;
      const bName =
        brokers.find((b) => b.id === load.brokerId)?.name || "Unknown";
      if (!entry.brokers.has(bName))
        entry.brokers.set(bName, { count: 0, totalRate: 0 });
      const bEntry = entry.brokers.get(bName)!;
      bEntry.count++;
      bEntry.totalRate += load.carrierRate;
    };
    loads.forEach((load) => {
      processFacility(
        load.pickup?.facilityName ?? "",
        load.pickup?.city ?? "",
        load.pickup?.state ?? "",
        load,
      );
      processFacility(
        load.dropoff?.facilityName ?? "",
        load.dropoff?.city ?? "",
        load.dropoff?.state ?? "",
        load,
      );
    });
    return Array.from(map.values())
      .map((f) => ({
        ...f,
        riskScore: (f.detentionCount / f.visits) * 100,
        onTimeScore: 100 - (f.lateCount / f.visits) * 100,
        brokerStats: Array.from(f.brokers.entries())
          .map(([bName, stats]) => ({
            name: bName,
            count: stats.count,
            avgRate: stats.totalRate / stats.count,
          }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.visits - a.visits);
  }, [loads, brokers]);

  const brokerAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        mcNumber: string;
        loadCount: number;
        totalSpend: number;
        loads: LoadData[];
        lanes: Map<string, number>;
        onTimeCount: number;
        cancelCount: number;
      }
    >();
    loads.forEach((load) => {
      if (!load.brokerId) return;
      if (!map.has(load.brokerId)) {
        const b = brokers.find((bk) => bk.id === load.brokerId);
        map.set(load.brokerId, {
          id: load.brokerId,
          name: b?.name || "Unknown",
          mcNumber: b?.mcNumber || "N/A",
          loadCount: 0,
          totalSpend: 0,
          loads: [],
          lanes: new Map(),
          onTimeCount: 0,
          cancelCount: 0,
        });
      }
      const entry = map.get(load.brokerId)!;
      entry.loadCount++;
      entry.totalSpend += load.carrierRate;
      entry.loads.push(load);
      if (load.status === "cancelled") entry.cancelCount++;
      if (load.status !== "cancelled") entry.onTimeCount++;
      const lane = `${load.pickup?.state ?? ""} -> ${load.dropoff?.state ?? ""}`;
      entry.lanes.set(lane, (entry.lanes.get(lane) || 0) + 1);
    });
    return Array.from(map.values())
      .map((b) => ({
        ...b,
        avgRate: b.totalSpend / b.loadCount,
        onTimeRate: b.loadCount > 0 ? (b.onTimeCount / b.loadCount) * 100 : 0,
        cancellationRate:
          b.loadCount > 0 ? (b.cancelCount / b.loadCount) * 100 : 0,
        topLanes: Array.from(b.lanes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => ({ name, count })),
      }))
      .sort((a, b) => b.loadCount - a.loadCount);
  }, [loads, brokers]);

  const marketTrends = useMemo(() => {
    const monthly: Record<string, { total: number; count: number }> = {};
    const seasonal: Record<
      string,
      { total: number; count: number; sortKey: string }
    > = {};
    const getSeason = (dateStr: string) => {
      const date = new Date(dateStr);
      const month = date.getMonth();
      const year = date.getFullYear();
      let seasonName =
        month === 11 || month <= 1
          ? "Winter"
          : month >= 2 && month <= 4
            ? "Spring"
            : month >= 5 && month <= 7
              ? "Summer"
              : "Fall";
      return { name: `${seasonName} ${year}`, key: `${year}-${seasonName}` };
    };
    loads.forEach((l) => {
      const date = l.pickupDate.substring(0, 7);
      if (!monthly[date]) monthly[date] = { total: 0, count: 0 };
      monthly[date].total += l.carrierRate;
      monthly[date].count++;
      const season = getSeason(l.pickupDate);
      if (!seasonal[season.name])
        seasonal[season.name] = { total: 0, count: 0, sortKey: season.key };
      seasonal[season.name].total += l.carrierRate;
      seasonal[season.name].count++;
    });
    return {
      monthlyData: Object.entries(monthly)
        .map(([date, d]) => ({ date, avg: d.total / d.count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      seasonalData: Object.entries(seasonal)
        .map(([name, d]) => ({ name, avg: d.total / d.count, key: d.sortKey }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }, [loads]);

  const getEntityAnalysis = (entity: any, type: "facility" | "broker") => {
    const suggestions: string[] = [];
    let cause = "Overall operations are running smoothly.";
    let status: "High" | "Medium" | "Low" = "High";
    if (type === "facility") {
      if (entity.detentionCount > 0 && entity.riskScore > 30) {
        cause =
          "Significant delays detected during loading stages. Wait times often exceed 2 hours.";
        status = "Low";
        suggestions.push("Negotiate detention free time.");
        suggestions.push("Avoid booking appointments during shift changes.");
      } else if (entity.onTimeScore < 90) {
        cause =
          "Drivers are frequently arriving late to this location due to congestion.";
        status = "Medium";
        suggestions.push("Allow more buffer for traffic.");
      } else {
        suggestions.push("Preferred facility: Priority dispatch location.");
      }
    } else {
      if (entity.cancellationRate > 20) {
        cause = "High cancellation rate indicates volatile load availability.";
        status = "Low";
        suggestions.push("Confirm load is 'Ready' before dispatch.");
        suggestions.push("Request TONU clauses.");
      } else if (entity.onTimeRate < 85) {
        cause = "Operational friction detected in appointment rescheduling.";
        status = "Medium";
        suggestions.push("Verify appointments directly with shipper.");
      } else {
        suggestions.push("High reliability partner.");
      }
    }
    return { cause, suggestions, status };
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 animate-fade-in text-slate-100 overflow-hidden relative">
      {/* STANDARD HEADER */}
      <div className="bg-slate-900 p-4 border-b border-slate-800 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg border-2 border-slate-800">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tighter uppercase leading-none">
                Business Insights
              </h2>
              <div className="flex gap-2 mt-1.5">
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                  Operational DNA
                </span>
                <span className="text-slate-500 text-[8px] font-black uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                  Market IQ Active
                </span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex space-x-6 overflow-x-auto scrollbar-hide">
          {[
            { id: "market", label: "Seasonal Trends", icon: TrendingUp },
            { id: "facilities", label: "Facility IQ", icon: Building2 },
            { id: "brokers", label: "Broker Perf", icon: Briefcase },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2 text-[9px] font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? "border-blue-500 text-blue-400" : "border-transparent text-slate-600 hover:text-slate-300"}`}
            >
              <tab.icon className="w-3 h-3" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 no-scrollbar pb-20">
        {activeTab === "market" && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Seasonal Rate Analysis
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketTrends.seasonalData}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "none",
                          borderRadius: "12px",
                        }}
                      />
                      <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Volume Momentum
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketTrends.monthlyData}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "none",
                          borderRadius: "12px",
                        }}
                      />
                      <Bar dataKey="avg" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === "facilities" || activeTab === "brokers") && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-600" />
              <input
                placeholder={
                  activeTab === "facilities"
                    ? "Filter Facilities..."
                    : "Filter Brokers..."
                }
                aria-label={
                  activeTab === "facilities"
                    ? "Filter facilities"
                    : "Filter brokers"
                }
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white font-black uppercase tracking-widest shadow-inner outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Fixed mixed entity mapping by casting to any[] and casting item to any inside the loop */}
              {(activeTab === "facilities"
                ? (facilityData as any[])
                : (brokerAnalytics as any[])
              )
                .filter((item: any) =>
                  item.name.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((item: any, i) => (
                  <div
                    key={i}
                    onClick={() =>
                      setSelectedEntity({ type: activeTab as any, data: item })
                    }
                    className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg hover:border-blue-500/50 transition-all group cursor-pointer flex flex-col justify-between h-56"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-black text-blue-500 border border-slate-700 shadow-md">
                          {activeTab === "facilities" ? (
                            <Building2 className="w-5 h-5" />
                          ) : (
                            <Briefcase className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-white text-xs uppercase tracking-tight truncate">
                            {item.name}
                          </h4>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                            {activeTab === "facilities"
                              ? `${item.city}, ${item.state}`
                              : `MC: ${item.mcNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-white font-mono tracking-tighter">
                          {activeTab === "facilities"
                            ? `${item.visits}`
                            : `$${item.avgRate.toFixed(0)}`}
                        </div>
                        <span className="text-[7px] text-slate-600 font-black uppercase tracking-widest">
                          {activeTab === "facilities" ? "Visits" : "Avg Rate"}
                        </span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
                      <div>
                        <span className="text-[7px] text-slate-600 font-black uppercase tracking-[0.2em] block mb-1">
                          Health Score
                        </span>
                        <div
                          className={`text-xs font-black uppercase tracking-widest ${
                            (
                              activeTab === "facilities"
                                ? item.riskScore < 20
                                : item.onTimeRate > 90
                            )
                              ? "text-green-500"
                              : "text-orange-500"
                          }`}
                        >
                          {activeTab === "facilities"
                            ? item.riskScore < 20
                              ? "Optimal"
                              : "Delayed"
                            : `${item.onTimeRate.toFixed(0)}% OTD`}
                        </div>
                      </div>
                      <button
                        aria-label="View details"
                        className="p-2 bg-slate-800 rounded-lg text-slate-600 group-hover:text-blue-500 transition-colors shadow-inner"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* MODAL ANALYSIS POPUP */}
        {selectedEntity && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-8 border-b border-slate-800 flex justify-between items-start bg-slate-800/30">
                <div className="flex items-center gap-6">
                  <div
                    className={`p-4 rounded-3xl ${selectedEntity.type === "facility" ? "bg-blue-600 shadow-blue-900/40" : "bg-purple-600 shadow-purple-900/40"} shadow-2xl`}
                  >
                    {selectedEntity.type === "facility" ? (
                      <Building2 className="w-8 h-8 text-white" />
                    ) : (
                      <Briefcase className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                      {selectedEntity.data.name}
                    </h2>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">
                      {selectedEntity.type === "facility"
                        ? `${selectedEntity.data.city}, ${selectedEntity.data.state}`
                        : `MC#: ${selectedEntity.data.mcNumber}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntity(null)}
                  aria-label="Close details"
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-500 transition-all shadow-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
                {(() => {
                  const { cause, suggestions, status } = getEntityAnalysis(
                    selectedEntity.data,
                    selectedEntity.type,
                  );
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 shadow-inner">
                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                          <Activity className="w-4 h-4 text-blue-400" />{" "}
                          Diagnosis
                        </h3>
                        <p className="text-slate-300 text-xs leading-relaxed font-medium mb-6">
                          {cause}
                        </p>
                        <div
                          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            status === "High"
                              ? "bg-green-900/20 text-green-400 border border-green-800"
                              : status === "Medium"
                                ? "bg-yellow-900/20 text-yellow-400 border border-yellow-800"
                                : "bg-red-900/20 text-red-400 border border-red-800"
                          }`}
                        >
                          Rating: {status} Quality
                        </div>
                      </div>
                      <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 shadow-inner">
                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                          <Target className="w-4 h-4 text-green-400" />{" "}
                          Prescriptions
                        </h3>
                        <div className="space-y-4">
                          {suggestions.map((s, i) => (
                            <div
                              key={i}
                              className="flex gap-4 text-[10px] text-slate-300 font-bold uppercase tracking-tight bg-slate-900 p-3 rounded-xl border border-slate-800"
                            >
                              <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />{" "}
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
