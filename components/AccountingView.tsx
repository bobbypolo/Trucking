import React, { useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  Building2,
  FileText,
  ChevronRight,
  BarChart3,
  CreditCard,
} from "lucide-react";
import { LoadData, User } from "../types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface AccountingViewProps {
  loads: LoadData[];
  users: User[];
  onNavigate: (tab: string) => void;
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  loads,
  users,
  onNavigate,
}) => {
  const stats = useMemo(() => {
    const totalRevenue = loads.reduce(
      (sum, l) => sum + (Number(l.carrierRate) || 0),
      0,
    );
    const totalDriverPay = loads.reduce(
      (sum, l) => sum + (Number(l.driverPay) || 0),
      0,
    );
    const netMargin = totalRevenue - totalDriverPay;
    const marginPercent =
      totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

    const pendingLoads = loads.filter(
      (l) => l.status !== "completed" && l.status !== "cancelled",
    ).length;
    const completedRevenue = loads
      .filter((l) => l.status === "delivered" || l.status === "completed")
      .reduce((sum, l) => sum + (Number(l.carrierRate) || 0), 0);

    return {
      totalRevenue,
      totalDriverPay,
      netMargin,
      marginPercent,
      pendingLoads,
      completedRevenue,
    };
  }, [loads]);

  const chartData = useMemo(() => {
    // Compute trend data based on loads
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split("T")[0];
      const dayLoads = loads.filter((l) => l.pickupDate === dateStr);
      return {
        name: date.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: dayLoads.reduce(
          (sum, l) => sum + (Number(l.carrierRate) || 0),
          0,
        ),
        profit: dayLoads.reduce(
          (sum, l) => sum + (Number(l.carrierRate) - Number(l.driverPay) || 0),
          0,
        ),
      };
    });
    return last7Days;
  }, [loads]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none mb-2">
            Accounting Terminal
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
              Fleet Financial Operations
            </span>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-black text-emerald-500 tracking-widest border border-emerald-500/20">
              <Activity className="w-2.5 h-2.5" /> LIVE
            </div>
          </div>
        </div>
        <button
          onClick={() => onNavigate("finance")}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-xl"
        >
          Detailed Settlements{" "}
          <ChevronRight className="w-3 h-3 text-blue-500" />
        </button>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "GROSS REVENUE",
            value: stats.totalRevenue,
            icon: TrendingUp,
            color: "blue",
            sub: `${stats.pendingLoads} Loads Pending`,
          },
          {
            label: "OPERATIONAL COST",
            value: stats.totalDriverPay,
            icon: DollarSign,
            color: "orange",
            sub: "Driver Pay & Fuel",
          },
          {
            label: "NET OVERRIDE",
            value: stats.netMargin,
            icon: TrendingUp,
            color: "emerald",
            sub: `${stats.marginPercent.toFixed(1)}% Avg Margin`,
          },
          {
            label: "ACCOUNTS RECEIVABLE",
            value: stats.completedRevenue,
            icon: CreditCard,
            color: "purple",
            sub: "Completed / Invoiced",
          },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-slate-900 border border-slate-800/50 rounded-3xl p-6 relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg hover:shadow-blue-500/5"
          >
            <div
              className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity`}
            >
              <card.icon className={`w-16 h-16 text-${card.color}-500`} />
            </div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
              {card.label}
            </h4>
            <div className="text-2xl font-black text-white mb-2">
              {formatCurrency(card.value)}
            </div>
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                Performance Intelligence
              </h3>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                7-Day Revenue & Profit Logic
              </p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#1e293b"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: "bold", fill: "#64748b" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: "bold", fill: "#64748b" }}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                  }}
                  itemStyle={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 text-center">
            Cash Flow Projection
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center space-y-8">
            <div className="relative">
              <svg className="w-48 h-48 transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-800"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={502}
                  strokeDashoffset={502 * (1 - stats.marginPercent / 100)}
                  className="text-blue-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-white">
                  {stats.marginPercent.toFixed(0)}%
                </span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Net Yield
                </span>
              </div>
            </div>
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Scaling Growth
                  </span>
                </div>
                <span className="text-[10px] font-black text-emerald-500">
                  +12%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Efficiency
                  </span>
                </div>
                <span className="text-[10px] font-black text-emerald-500">
                  98.4%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
