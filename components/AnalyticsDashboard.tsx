import React, { useMemo } from 'react';
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
    Clock
} from 'lucide-react';
import { LoadData, User, Broker } from '../types';

interface Props {
    user: User;
    loads: LoadData[];
    brokers?: Broker[];
    onNavigate?: (tab: string, subTab?: string) => void;
}

export const AnalyticsDashboard: React.FC<Props> = ({ user, loads, brokers = [], onNavigate }) => {
    const historicalStats = useMemo(() => {
        // Mocking historical data trends for the last 30 days
        const totalRevenue = loads.reduce((s, l) => s + (l.carrierRate || 0), 0);
        const avgRPM = 2.45;
        const previousRPM = 2.32;
        const rpmTrend = ((avgRPM - previousRPM) / previousRPM) * 100;

        const fuelEfficiency = 6.2;
        const fuelTrend = -2.4;

        const detentionFreq = 0.14; // 14% of loads
        const detentionTrend = 1.2;

        return {
            totalRevenue,
            avgRPM,
            rpmTrend,
            fuelEfficiency,
            fuelTrend,
            detentionFreq,
            detentionTrend
        };
    }, [loads]);

    const brokerScorecards = [
        { name: 'Global Logistics', rpm: 2.85, daysToPay: 22, docDelay: '2%', margin: '18%' },
        { name: 'FastTrack Freight', rpm: 2.40, daysToPay: 35, docDelay: '8%', margin: '12%' },
        { name: 'Blue Sky Carriers', rpm: 3.10, daysToPay: 14, docDelay: '1%', margin: '24%' },
        { name: 'Midwest Brokerage', rpm: 2.15, daysToPay: 45, docDelay: '12%', margin: '8%' },
    ];

    const topLanes = [
        { lane: 'Chicago, IL → Detroit, MI', vol: 45, margin: '$840', rpm: '$3.45', health: 'excel' },
        { lane: 'Columbus, OH → Atlanta, GA', vol: 32, margin: '$620', rpm: '$2.20', health: 'good' },
        { lane: 'Indianapolis, IN → Dallas, TX', vol: 18, margin: '$1,100', rpm: '$1.85', health: 'risk' },
    ];

    return (
        <div className="p-8 space-y-8 bg-[#0a0f18] min-h-full">
            {/* ANALYTICS DASHBOARD (HISTORY / STRATEGY) */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-black text-white tracking-widest uppercase">Strategy & Analytics</h1>
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">Status: Trend Analysis & Profitability Intelligence</p>
                </div>
                <div className="flex gap-3">
                    <div className="px-4 py-2.5 bg-slate-900 border border-white/5 rounded-xl text-slate-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Last 30 Days
                    </div>
                </div>
            </div>

            {/* HIGH-LEVEL TRENDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Avg RPM', val: `$${historicalStats.avgRPM.toFixed(2)}`, trend: historicalStats.rpmTrend, icon: <DollarSign className="w-4 h-4" />, color: 'text-blue-500' },
                    { label: 'Fuel Avg (MPG)', val: historicalStats.fuelEfficiency, trend: historicalStats.fuelTrend, icon: <Fuel className="w-4 h-4" />, color: 'text-emerald-500' },
                    { label: 'Detention Freq', val: '14.2%', trend: historicalStats.detentionTrend, icon: <Clock className="w-4 h-4" />, color: 'text-orange-500' },
                    { label: 'Weight/Mile', val: '32.4k', trend: 0.8, icon: <Scale className="w-4 h-4" />, color: 'text-purple-500' }
                ].map((stat, i) => (
                    <div key={i} className="bg-[#1a2235] p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
                            <div className={`p-2 rounded-xl bg-slate-900 border border-white/5 ${stat.color}`}>{stat.icon}</div>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="text-3xl font-black text-white">{stat.val}</div>
                            <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${stat.trend > 0 ? (stat.label === 'Fuel Efficiency' ? 'text-emerald-500' : 'text-blue-500') : 'text-red-500'}`}>
                                {stat.trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(stat.trend)}%
                            </div>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${stat.color.replace('text', 'bg')}`} style={{ width: '70%' }} />
                        </div>
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
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Broker Scorecard</h3>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Payment & Yield Performance</p>
                            </div>
                        </div>
                        <button className="p-2 text-slate-600 hover:text-white transition-colors"><MoreVertical className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-5 px-4 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 pb-2">
                            <div className="col-span-2">Partner</div>
                            <div>RPM</div>
                            <div>D-Pay</div>
                            <div className="text-right">Margin</div>
                        </div>
                        {brokerScorecards.map((b, i) => (
                            <div key={i} className="grid grid-cols-5 px-4 py-3 bg-slate-950/40 border border-white/5 rounded-2xl items-center group hover:bg-slate-900 transition-all cursor-pointer">
                                <div className="col-span-2 text-xs font-bold text-white uppercase">{b.name}</div>
                                <div className="text-xs font-mono text-blue-400">${b.rpm.toFixed(2)}</div>
                                <div className="text-xs font-mono text-slate-500">{b.daysToPay}d</div>
                                <div className="text-xs font-mono text-right text-emerald-500 font-bold">{b.margin}</div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => onNavigate?.('network')}
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
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Lane Profitability</h3>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Top Lanes by Marginal Health</p>
                            </div>
                        </div>
                        <button className="p-2 text-slate-600 hover:text-white transition-colors"><MoreVertical className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-4">
                        {topLanes.map((l, i) => (
                            <div key={i} className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-slate-900 transition-all cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${l.health === 'excel' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : l.health === 'good' ? 'bg-blue-500' : 'bg-red-500'}`} />
                                    <div>
                                        <div className="text-xs font-bold text-white uppercase">{l.lane}</div>
                                        <div className="text-[9px] text-slate-600 font-black uppercase mt-1">{l.vol} Loads / Month</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-mono font-bold text-white leading-none">{l.margin} <span className="text-[8px] text-slate-600 ml-1">Avg Profit</span></div>
                                    <div className="text-[10px] font-mono text-blue-500 mt-1">{l.rpm} RPM</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => onNavigate?.('map')}
                        className="w-full mt-6 py-3 bg-slate-900/50 hover:bg-slate-900 text-slate-600 hover:text-purple-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
                    >
                        View Network Heatmap
                    </button>
                </div>
            </div>

            {/* BOTTOM SECTION: SEASONAL RATIO */}
            <div className="bg-slate-900/20 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <TrendingUp className="w-48 h-48 text-white" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.3em]">Market Intelligence</h4>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Rate Volatility Index: Stable</h3>
                        <p className="max-w-md text-[10px] text-slate-500 font-bold uppercase leading-relaxed">System has detected a 4.2% increase in Midwest reefer demand. Suggesting contract adjustment for 3 lane partners.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-950/50 border border-white/5 p-6 rounded-3xl text-center min-w-[140px]">
                            <div className="text-[8px] font-black text-slate-600 uppercase mb-2">Seasonal Ratio</div>
                            <div className="text-2xl font-black text-white">1.42</div>
                            <div className="text-[9px] font-black text-emerald-500 uppercase mt-1">Strong</div>
                        </div>
                        <button
                            onClick={() => onNavigate?.('analytics')}
                            className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 hover:scale-110 hover:bg-blue-500 transition-all font-black"
                        >
                            <Zap className="w-8 h-8 fill-white" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
