import React, { useState } from 'react';
import {
    Building2, Settings, ClipboardList, Map as MapIcon, Zap,
    Truck, Calendar, ShieldCheck, Users, Wallet, ChevronDown, ChevronRight, Globe
} from 'lucide-react';

interface NavSubItem {
    id: string;
    label: string;
    icon: any;
}

interface NavCategory {
    label: string;
    items: NavSubItem[];
}

interface Props {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    permissions: any;
    userRole: string;
}

export const SidebarTree: React.FC<Props> = ({ activeTab, setActiveTab, permissions, userRole }) => {
    const categories: NavCategory[] = [
        {
            label: 'Operations',
            items: [
                { id: 'operations-hub', label: 'Unified Operations', icon: Zap },
                { id: 'booking', label: 'Request / Intake', icon: ClipboardList },
                { id: 'loads', label: 'Dispatch Board', icon: Truck },
                { id: 'calendar', label: 'Schedule', icon: Calendar },
            ]
        },
        {
            label: 'Network',
            items: [
                { id: 'safety', label: 'Safety Hub', icon: ShieldCheck },
                { id: 'brokers', label: 'Partner Network', icon: Globe },
            ]
        },
        {
            label: 'Enterprise',
            items: [
                { id: 'finance', label: 'Financials', icon: Wallet },
                { id: 'company', label: 'Authority Profile', icon: Building2 },
                { id: 'profile', label: 'User Settings', icon: Settings },
            ]
        }
    ];

    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        'Operations': true,
        'Network': true,
        'Enterprise': true
    });

    const toggle = (label: string) => {
        setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <div className="space-y-6">
            {categories.map(cat => (
                <div key={cat.label} className="space-y-1">
                    <button
                        onClick={() => toggle(cat.label)}
                        className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-slate-300 transition-colors group"
                    >
                        {cat.label}
                        {expanded[cat.label] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>

                    {expanded[cat.label] && (
                        <div className="space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                            {cat.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === item.id
                                        ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`}
                                >
                                    <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-slate-500'}`} />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
