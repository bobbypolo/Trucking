
import React, { useMemo, useState } from 'react';
import { LoadData, LOAD_STATUS, LoadStatus, Company, User } from '../types';
import { Download, FileDown, Search, ArrowRight, DollarSign, Layers, Calendar, MapPin, Building2, ChevronDown, ChevronUp, FileText, Printer, Filter, X, Lock, AlertTriangle, AlertCircle, ThermometerSnowflake, Mail, CheckCircle, Truck, User as UserIcon, Eye, AlertOctagon, Wrench, Ban, Clock, TrainFront, Headset, Users, Container, Construction, Undo2, Hash, Edit2, Map, Box, Phone } from 'lucide-react';
import { generateInvoicePDF, saveLoad } from '../services/storageService';
import { getCompany } from '../services/authService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ExportModal } from './ExportModal';
import { v4 as uuidv4 } from 'uuid';
import { LoadingSkeleton } from './ui/LoadingSkeleton';
import { ErrorState } from './ui/ErrorState';
import { EmptyState } from './ui/EmptyState';

interface Props {
    loads: LoadData[];
    onView: (load: LoadData) => void;
    onEdit: (load: LoadData) => void;
    onDelete: (id: string) => void;
    selectedDriverId?: string | null;
    onClearFilter?: () => void;
    canViewRates?: boolean;
    users?: User[];
    onOpenHub?: (tab: 'messaging', startCall?: boolean) => void;
    isLoading?: boolean;
    loadError?: string | null;
    onRetryLoad?: () => void;
}

export const LoadList: React.FC<Props> = ({ loads, onView, onEdit, onDelete, selectedDriverId, onClearFilter, canViewRates = true, users = [], onOpenHub, isLoading, loadError, onRetryLoad }) => {
    const currentUser = useCurrentUser();
    const [filter, setFilter] = useState('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const isDispatcher = currentUser?.role === 'dispatcher';
    const [viewScope, setViewScope] = useState<'my' | 'all'>(isDispatcher ? 'my' : 'all');

    const processedLoads = useMemo(() => {
        let result = [...loads];
        if (isDispatcher && viewScope === 'my') result = result.filter(l => l.dispatcherId === currentUser?.id);
        if (filter) {
            const term = filter.toLowerCase();
            result = result.filter(l =>
                l.loadNumber.toLowerCase().includes(term) ||
                (l.pickup?.city ?? "").toLowerCase().includes(term) ||
                l.containerNumber?.toLowerCase().includes(term) ||
                l.chassisNumber?.toLowerCase().includes(term)
            );
        }
        result.sort((a, b) => {
            let comparison = (a.pickupDate || '').localeCompare(b.pickupDate || '');
            return sortDirection === 'asc' ? comparison : -comparison;
        });
        return result;
    }, [loads, filter, sortDirection, viewScope, isDispatcher, currentUser]);

    const StatusBadge = ({ status }: { status: string }) => {
        const baseStyle = "text-[7px] px-2 py-0.5 rounded uppercase tracking-[0.2em] font-black border";
        const colors: Record<string, string> = {
            'draft': 'bg-slate-800 text-slate-500 border-slate-700',
            'planned': 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
            'dispatched': 'bg-blue-600/20 text-blue-400 border-blue-500/30',
            'in_transit': 'bg-amber-600/20 text-amber-400 border-amber-500/30',
            'arrived': 'bg-orange-600/20 text-orange-400 border-orange-500/30',
            'delivered': 'bg-green-600/20 text-green-400 border-green-500/30',
            'completed': 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
            'cancelled': 'bg-red-600/20 text-red-400 border-red-500/30',
        };
        return <span className={`${baseStyle} ${colors[status] || 'bg-slate-900 text-slate-400 border-slate-800'}`}>{status}</span>;
    };

    return (
        <div className="h-full flex flex-col bg-[#020617]">

            {/* HIGH DENSITY TOOLBAR */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-lg relative z-10">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-3 w-4 h-4 text-slate-600" />
                    <input
                        type="text"
                        placeholder="QUERY MANIFEST, CONTAINER, OR CHASSIS..."
                        aria-label="Search loads by manifest, container, or chassis"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-[10px] text-white font-black uppercase tracking-[0.2em] focus:border-blue-500 outline-none shadow-inner placeholder:text-slate-700"
                    />
                </div>
                <div className="flex gap-3">
                    {isDispatcher && (
                        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                            <button onClick={() => setViewScope('my')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewScope === 'my' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600 hover:text-slate-300'}`}>Assigned Deck</button>
                            <button onClick={() => setViewScope('all')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewScope === 'all' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600 hover:text-slate-300'}`}>Fleet Network</button>
                        </div>
                    )}
                    <button onClick={() => setSortDirection(s => s === 'asc' ? 'desc' : 'asc')} aria-label="Toggle sort direction" className="bg-slate-900 border border-slate-800 p-3 rounded-xl hover:bg-slate-800 transition-all text-slate-400">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-24">
                {isLoading && (
                    <LoadingSkeleton variant="list" count={5} />
                )}
                {!isLoading && loadError && (
                    <ErrorState message={loadError} onRetry={onRetryLoad ?? (() => {})} />
                )}
                {!isLoading && !loadError && processedLoads.map(load => (
                    <div
                        key={load.id}
                        className={`bg-slate-900 p-4 rounded-2xl border ${load.isActionRequired
                            ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)] animate-pulse-slow'
                            : 'border-slate-800/50'
                            } hover:border-blue-500/50 transition-all shadow-xl group cursor-pointer active:scale-[0.99]`}
                        onClick={() => onView(load)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center font-black ${load.isActionRequired ? 'text-yellow-500' : 'text-blue-500'} border border-slate-800 shadow-2xl group-hover:bg-blue-900/10 transition-all`}>
                                    {load.freightType === 'Intermodal' ? <Container className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-sm text-white tracking-widest uppercase">Manifest {load.loadNumber}</span>
                                        <StatusBadge status={load.status} />
                                        {load.isActionRequired && (
                                            <span className="bg-yellow-500/10 text-yellow-500 text-[7px] font-black px-1.5 py-0.5 rounded border border-yellow-500/30 uppercase tracking-[0.2em] flex items-center gap-1">
                                                <AlertTriangle className="w-2.5 h-2.5" /> Action Required
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                        <span className={load.isActionRequired ? 'text-yellow-500/70' : 'text-blue-500/70'}>{load.freightType}</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                                        <span className="flex items-center gap-1"><UserIcon className="w-2.5 h-2.5 text-slate-800" /> {users.find(u => u.id === load.driverId)?.name || 'UNASSIGNED'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-white font-mono tracking-tighter">
                                    {canViewRates ? `$${(load.carrierRate || 0).toLocaleString()}` : 'CONFIDENTIAL'}
                                </div>
                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em]">Gross Yield</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 group-hover:border-slate-700/50 transition-all relative overflow-hidden">
                            <div className="space-y-1.5 border-r border-slate-800 pr-4 relative z-10">
                                <div className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-1.5">Origin</div>
                                <div className="text-[11px] font-black text-slate-200 uppercase truncate tracking-wider">{load.pickup?.city ?? ""}, {load.pickup?.state ?? ""}</div>
                                <div className="text-[8px] font-bold text-slate-600 truncate uppercase mt-0.5">{load.pickup?.facilityName || 'LOGISTICS HUB'}</div>
                            </div>
                            <div className="space-y-1.5 pl-4 relative z-10">
                                <div className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-1.5">Destination</div>
                                <div className="text-[11px] font-black text-slate-200 uppercase truncate tracking-wider">{load.dropoff?.city ?? ""}, {load.dropoff?.state ?? ""}</div>
                                <div className="text-[8px] font-bold text-slate-600 truncate uppercase mt-0.5">{load.dropoff?.facilityName || 'TERMINAL DOCK'}</div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-between items-center px-1">
                            <div className="flex gap-3 items-center">
                                <div className="flex items-center gap-1.5 bg-slate-800/30 px-2 py-1 rounded border border-slate-800">
                                    <Calendar className="w-2.5 h-2.5 text-slate-600" />
                                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider font-mono">{load.pickupDate}</span>
                                </div>
                                {load.freightType === 'Intermodal' && (
                                    <div className="flex gap-2 text-[8px] font-black uppercase tracking-wider">
                                        <span className="text-slate-700">CTR <span className="text-slate-400 font-mono">{load.containerNumber || '---'}</span></span>
                                        <span className="text-slate-700">CHS <span className="text-slate-400 font-mono">{load.chassisNumber || '---'}</span></span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onOpenHub?.('messaging', true); }}
                                    className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                                >
                                    <Phone className="w-3 h-3 inline mr-1.5" /> Call
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onEdit(load); }} className="px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"><Edit2 className="w-3 h-3 inline mr-1.5" /> Modify</button>
                            </div>
                        </div>
                    </div>
                ))}
                {!isLoading && !loadError && processedLoads.length === 0 && (
                    <EmptyState
                        icon={<Layers className="w-12 h-12" />}
                        title="No loads to show"
                        description="No active manifests detected. Create a new load to get started."
                    />
                )}
            </div>
        </div>
    );
};
