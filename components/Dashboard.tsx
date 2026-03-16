import React, { useMemo, useState, useEffect } from "react";
import {
  Users,
  Truck,
  DollarSign,
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Clock,
  LayoutDashboard,
  Search,
  MousePointer2,
  FileText,
  Wrench,
  Shield,
  Zap,
  TrendingUp,
  Globe,
  AlertCircle,
} from "lucide-react";
import {
  LoadData,
  User,
  LOAD_STATUS,
  LoadStatus,
  Broker,
  Exception,
  ExceptionType,
  DashboardCard,
} from "../types";
import { getExceptions, getDashboardCards } from "../services/exceptionService";

interface Props {
  user: User;
  loads: LoadData[];
  brokers?: Broker[];
  onViewLoad: (load: LoadData) => void;
  onNavigate: (tab: string, subTab?: string) => void;
  users?: User[];
  onOpenIssues?: () => void;
}

export const Dashboard: React.FC<Props> = ({
  user,
  loads,
  brokers = [],
  onViewLoad,
  onNavigate,
  users = [],
  onOpenIssues,
}) => {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setError(null);
    setLoading(true);
    try {
      const [exs, cardDefs] = await Promise.all([
        getExceptions({ status_not_in: "RESOLVED,CLOSED" }),
        getDashboardCards(),
      ]);
      setExceptions(exs);
      setCards(cardDefs);
    } catch (err: unknown) {
      setError("Unable to load dashboard data. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const exceptionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    exceptions.forEach((ex) => {
      counts[ex.type] = (counts[ex.type] || 0) + 1;
    });
    return counts;
  }, [exceptions]);

  const stats = useMemo(() => {
    const grossRevenue = loads.reduce(
      (sum, l) => sum + (l.carrierRate || 0),
      0,
    );
    const operatorPay = loads.reduce((sum, l) => sum + (l.driverPay || 0), 0);
    const operatingMargin = grossRevenue - operatorPay;
    const activeLoads = loads.filter(
      (l) => l.status === LOAD_STATUS.Active,
    ).length;
    const openExceptions = exceptions.length;
    const slaBreaches = exceptions.filter((ex) => ex.severity === 4).length;
    const docHoldRevenue = exceptions
      .filter(
        (ex) => ex.type === "POD_MISSING" || ex.type === "DOC_PENDING_48H",
      )
      .reduce((sum, ex) => sum + (ex.financialImpactEst || 0), 0);

    const accruingDetention = exceptions
      .filter((ex) => ex.type === "DETENTION_ELIGIBLE")
      .reduce((sum, ex) => sum + (ex.financialImpactEst || 0), 0);

    return {
      grossRevenue,
      operatingMargin,
      activeLoads,
      openExceptions,
      slaBreaches,
      docHoldRevenue,
      accruingDetention,
    };
  }, [loads, exceptions]);

  const getIcon = (key?: string) => {
    switch (key) {
      case "clock":
        return <Clock className="w-5 h-5" />;
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "wrench":
        return <Wrench className="w-5 h-5" />;
      case "truck":
        return <Truck className="w-5 h-5" />;
      case "file":
        return <FileText className="w-5 h-5" />;
      case "paperclip":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "settings":
        return <Zap className="w-5 h-5 text-purple-500" />;
      case "inbox":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#0a0f18] min-h-full">
      {/* ERROR BANNER */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between bg-red-900/40 border border-red-500/40 text-red-300 px-6 py-4 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm font-bold">{error}</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            retry
          </button>
        </div>
      )}

      {/* OPERATIONS DASHBOARD (NOW / VOLUME MANAGEMENT) */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase">
            Operations Dashboard
          </h1>
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">
            Status: Volume Priority & Active Exceptions
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate("analytics")}
            className="px-6 py-2.5 bg-slate-900 border border-white/5 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Reports
          </button>
          <button
            onClick={() => onNavigate("operations-hub")}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2"
          >
            <Zap className="w-3.5 h-3.5 fill-white" /> Operations Center
          </button>
        </div>
      </div>

      {/* TOP ROW: BIG NUMBERS (The "What must be handled today?" view) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          onClick={() => onNavigate("exceptions", "all")}
          className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group cursor-pointer hover:border-blue-500/30 transition-all shadow-2xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Open Exceptions
            </div>
            <AlertCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
            {stats.openExceptions}
          </div>
          <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
            Active Work Items
          </div>
        </div>

        <div
          onClick={() => onNavigate("exceptions", "critical")}
          className="bg-red-500/5 p-6 rounded-[2rem] border border-red-500/20 group cursor-pointer hover:bg-red-500/10 transition-all shadow-2xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">
              SLA Breaches
            </div>
            <Clock className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
          <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
            {stats.slaBreaches}
          </div>
          <div className="text-[10px] text-red-700 font-bold uppercase mt-2">
            Critical Attention
          </div>
        </div>

        <div
          onClick={() => onNavigate("exceptions", "docs")}
          className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group cursor-pointer hover:border-emerald-500/30 transition-all shadow-2xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              $ On Hold (Docs)
            </div>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
            ${stats.docHoldRevenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
            Revenue at Risk
          </div>
        </div>

        <div
          onClick={() => onNavigate("exceptions", "delay-entry")}
          className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 group cursor-pointer hover:border-orange-500/30 transition-all shadow-2xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              $ Accruing (Detention)
            </div>
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform">
            ${stats.accruingDetention.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-600 font-bold uppercase mt-2">
            Estimated Layover/Stop
          </div>
        </div>
      </div>

      {/* AUTOMATION PRO (TIER 2) SPECIALIZED TILES */}
      {user.role === "owner_operator" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* MONEY TILE */}
          <div className="bg-[#0f172a] p-8 rounded-[2.5rem] border border-blue-500/20 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp className="w-24 h-24 text-blue-400" />
            </div>
            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <DollarSign className="w-3 h-3" /> Money & Performance
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  RPM (Avg)
                </div>
                <div className="text-2xl font-black text-white">$2.45</div>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Profit per Load
                </div>
                <div className="text-2xl font-black text-emerald-400">$840</div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                    Top Lane
                  </div>
                  <div className="text-[10px] font-black text-white uppercase tracking-tight">
                    CHI → ATL
                  </div>
                </div>
                <div>
                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                    Fuel Trend
                  </div>
                  <div className="text-[10px] font-black text-red-400 uppercase tracking-tight">
                    ↑ +4% WoW
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* IFTA TILE */}
          <div className="bg-[#0f172a] p-8 rounded-[2.5rem] border border-orange-500/20 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Globe className="w-24 h-24 text-orange-400" />
            </div>
            <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Zap className="w-3 h-3" /> IFTA Automation
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20">
                <div className="text-[10px] font-black text-orange-300 uppercase">
                  Current Quarter
                </div>
                <div className="text-xs font-black text-white px-2 py-1 bg-orange-600 rounded-md uppercase">
                  72% Done
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">
                    Missing Receipts
                  </div>
                  <div className="text-xs font-black text-red-500">14</div>
                </div>
                <div className="flex justify-between items-center px-1">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">
                    Unmapped Miles
                  </div>
                  <div className="text-xs font-black text-white">412 mi</div>
                </div>
              </div>
            </div>
          </div>

          {/* COMPLIANCE TILE */}
          <div className="bg-[#0f172a] p-8 rounded-[2.5rem] border border-purple-500/20 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Shield className="w-24 h-24 text-purple-400" />
            </div>
            <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" /> Compliance Health
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-black text-white uppercase">
                    Insurance Expiry
                  </div>
                  <div className="text-[8px] text-red-500 font-bold uppercase">
                    Expires in 12 days
                  </div>
                </div>
                <button className="text-[8px] font-black text-blue-400 uppercase hover:underline">
                  Update
                </button>
              </div>
              <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-black text-white uppercase">
                    Truck Registration
                  </div>
                  <div className="text-[8px] text-emerald-500 font-bold uppercase">
                    Valid until 2026-11-20
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION QUEUES (Middle Section) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Critical Status Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" /> Action Items
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {cards
              .filter((c) => c.cardCode !== "ALL_EXCEPTIONS")
              .map((card) => {
                const filter =
                  typeof card.filterJson === "string"
                    ? JSON.parse(card.filterJson)
                    : card.filterJson || {};
                const count = exceptions.filter(
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
                      onNavigate(
                        "exceptions",
                        card.cardCode?.toLowerCase().replace("_", "-"),
                      )
                    }
                    className="bg-slate-900/40 border border-white/5 p-6 rounded-[1.5rem] flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all group-hover:shadow-lg group-hover:shadow-blue-500/20">
                        {getIcon(card.iconKey)}
                      </div>
                      <div>
                        <div className="text-xs font-black text-white uppercase tracking-tight">
                          {card.displayName}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                          Deep Link Active
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white">
                        {count}
                      </div>
                      <div className="text-[8px] font-bold text-slate-600 uppercase">
                        Waitlist
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Exception Feed / Tray */}
        <div className="bg-[#0a0f1e] rounded-[2rem] border border-white/10 p-8 flex flex-col min-h-[400px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap className="w-32 h-32 text-blue-500" />
          </div>

          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                Active Issues
              </h3>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-0.5">
                High Severity Actions
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar relative z-10">
            {exceptions.slice(0, 6).map((ex) => (
              <div
                key={ex.id}
                onClick={() => onNavigate("exceptions", "all")}
                className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer border-l-4 border-l-red-500"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white uppercase">
                    {(ex.type || "EXC").replace("_", " ")}
                  </div>
                  <div className="text-[9px] text-slate-600 font-black uppercase">
                    Load #{ex.entityId} • {ex.ownerUserId || "Dispatch"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-black text-red-500 uppercase">
                    SLA: 14m
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ${(ex.financialImpactEst || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {exceptions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-10">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/20" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  All Exceptions Resolved
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate("exceptions")}
            className="w-full mt-8 py-4 bg-slate-900/50 hover:bg-slate-900 text-slate-500 hover:text-blue-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/5 transition-all relative z-10"
          >
            View Full Command Console
          </button>
        </div>
      </div>

      {/* BOTTOM ROW: QUICK INSIGHTS (Today's snapshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 bg-slate-900/20 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Fleet Overview
            </h4>
            <div className="flex items-center gap-4 mt-4">
              <div className="text-2xl font-black text-white">
                {stats.activeLoads}{" "}
                <span className="text-slate-600 text-[10px] font-bold">
                  In-Transit
                </span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-2xl font-black text-white">
                94%{" "}
                <span className="text-slate-600 text-[10px] font-bold">
                  SLA Health
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate("map")}
            className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-500 hover:bg-blue-600 hover:text-white transition-all"
          >
            <Globe className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-slate-900/20 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Top Risk Broker
          </div>
          <div className="mt-2">
            <div className="text-sm font-black text-red-500 uppercase">
              Broker Logistics Group
            </div>
            <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">
              4 Open Doc Exceptions
            </div>
          </div>
        </div>

        <div className="bg-slate-900/20 border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Accruing Detention
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500 font-mono">
            ${stats.accruingDetention.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">
            Today's Revenue Capture
          </div>
        </div>
      </div>
    </div>
  );
};
