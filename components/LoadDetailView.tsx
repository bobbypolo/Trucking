
import React, { useState, useEffect, useMemo } from 'react';
import { LoadData, LoadStatus, User, Broker, LoadLeg } from '../types';
import {
    Truck, X, Headset, ShieldCheck, Map, Clock, FileText, Download,
    DollarSign, User as UserIcon, Building2, Layers, Plus, Maximize2,
    Calendar, AlertTriangle, Lock, Unlock, Share2, ClipboardList, Package,
    ArrowRight, CheckCircle2, MoreHorizontal, History, Zap, ShieldAlert,
    ChevronDown, Hash, MapPin, Navigation, Trash2, Activity
} from 'lucide-react';
import { getVaultDocs, createARInvoice } from '../services/financialService';
import { saveLoad } from '../services/storageService';
import { getCurrentUser } from '../services/authService';
import { v4 as uuidv4 } from 'uuid';

interface Props {
    load: LoadData;
    onClose: () => void;
    onEdit: (load: LoadData) => void;
    canViewRates?: boolean;
    users?: User[];
    brokers?: Broker[];
    onOpenHub?: (tab: 'messaging' | 'safety' | 'command' | 'directory', showCallForm?: boolean) => void;
}

export const LoadDetailView: React.FC<Props> = ({ load, onClose, onEdit, canViewRates = true, users = [], brokers = [], onOpenHub }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [vaultDocs, setVaultDocs] = useState<any[]>([]);
    const [showUtilities, setShowUtilities] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(true);
        loadVault();
    }, []);

    const loadVault = async () => {
        try {
            const docs = await getVaultDocs({ loadId: load.id });
            setVaultDocs(docs);
        } catch (e) { console.error(e); }
    };

    const driver = users.find(u => u.id === load.driverId);
    const dispatcher = users.find(u => u.id === load.dispatcherId);
    const broker = brokers.find(b => b.id === load.brokerId);
    const currentUser = getCurrentUser();

    const profit = (load.carrierRate || 0) - (load.driverPay || 0);
    const marginPercentage = load.carrierRate ? (profit / load.carrierRate) * 100 : 0;

    const handleGenerateInvoice = async () => {
        setIsGenerating(true);
        try {
            await createARInvoice({
                id: uuidv4(),
                tenantId: currentUser?.companyId || 'DEFAULT',
                customerId: load.brokerId,
                loadId: load.id,
                invoiceNumber: `INV-${load.loadNumber}`,
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'Draft',
                totalAmount: load.carrierRate || 0,
                lines: [
                    { id: uuidv4(), invoiceId: '', description: 'Primary Linehaul', quantity: 1, unitPrice: load.carrierRate || 0, totalAmount: load.carrierRate || 0 }
                ]
            });
            alert('Invoice Generated and posted to GL');
        } catch (error) {
            console.error(error);
            alert('Failed to generate invoice');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCloseLoad = async () => {
        const hasPOD = vaultDocs.some(d => d.type === 'POD' || d.type === 'Bill of Lading');
        if (!hasPOD) {
            if (!confirm('WARNING: No Proof of Delivery (POD) found in Vault. Close anyway?')) return;
        }

        setIsClosing(true);
        try {
            const updatedLoad = { ...load, status: 'delivered' as LoadStatus, isLocked: true, financialStatus: 'Unbilled' as const };
            await saveLoad(updatedLoad, currentUser!);
            alert('Load Closed and Locked for Settlement');
            onClose();
        } catch (e) {
            alert('Failed to close load');
        } finally {
            setIsClosing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-[#050810]/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
            <div className={`w-full max-w-[1400px] h-[90vh] bg-[#0a0f18] border border-slate-800 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                {/* Top Status Bar (Matches EditLoadForm) */}
                <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                        <button onClick={onClose} className="hover:text-white transition-colors flex items-center gap-1">
                            <ChevronDown className="w-4 h-4 rotate-90" /> Back
                        </button>
                        <div className="h-4 w-px bg-slate-800" />
                        <span className="text-white uppercase tracking-widest font-black italic">Manifest Workspace: {load.loadNumber}</span>
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${load.status === 'delivered' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            'bg-blue-600/10 text-blue-400 border-blue-500/20'
                            }`}>
                            {load.status}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setShowUtilities(!showUtilities)}
                                className="px-5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all text-white"
                            >
                                Utilities <ChevronDown className="w-3 h-3" />
                            </button>
                            {showUtilities && (
                                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                    {['Print BOL', 'Carrier Rates', 'Load Stops', 'Documents', 'Show Route', 'Audit Logs'].map(util => (
                                        <button key={util} className="w-full text-left px-4 py-2.5 hover:bg-blue-600 rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors text-slate-300 hover:text-white">
                                            {util}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button className="flex items-center gap-2 px-5 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">
                            <AlertTriangle className="w-4 h-4" /> Tag for Action
                        </button>
                        <button className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${load.isLocked ? 'bg-red-900/20 border-red-500/30 text-red-500' : 'bg-green-900/20 border-green-500/30 text-green-500'}`}>
                            {load.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {load.isLocked ? 'Locked' : 'Unlocked'}
                        </button>
                    </div>
                </div>

                {/* Main Workspace Area (High Density) */}
                <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar scroll-smooth">

                    {/* Core Matrix Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Column 1: Reference Matrix */}
                        <div className="space-y-6 bg-slate-900/20 p-8 rounded-3xl border border-slate-800/50">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                <Hash className="w-4 h-4 text-blue-500" /> Reference Matrix
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Pro No</label>
                                    <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-white font-mono uppercase shadow-inner">
                                        {load.loadNumber}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Special</label>
                                    <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-white uppercase shadow-inner">
                                        STANDARD
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Commodity</label>
                                <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-white uppercase shadow-inner truncate">
                                    {load.commodity || '---'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Equipment</label>
                                <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-blue-400 uppercase font-black shadow-inner">
                                    {load.freightType?.toUpperCase() || 'DRY VAN 53\''}
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Relationships */}
                        <div className="space-y-6 bg-slate-900/20 p-8 rounded-3xl border border-slate-800/50">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-purple-500" /> Relationships
                            </h3>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Customer / Broker</label>
                                <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-white uppercase shadow-inner truncate font-black">
                                    {broker?.name || '---'}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Dispatcher</label>
                                    <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-white uppercase shadow-inner truncate">
                                        {dispatcher?.name || '-- UNASSIGNED --'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Salesman</label>
                                    <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-3 text-sm text-slate-500 uppercase shadow-inner">
                                        ENTER SALES REP
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Dispatch Notes (Internal)</label>
                                <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-4 text-xs text-slate-400 italic shadow-inner h-16 overflow-y-auto no-scrollbar">
                                    {load.dispatchNotes || 'No internal strategic notes identified.'}
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Settlement Deepening */}
                        <div className="space-y-6 bg-slate-900/20 p-8 rounded-3xl border border-slate-800/50">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                <DollarSign className="w-4 h-4 text-green-500" /> Settlement Deepening
                            </h3>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Gross Pay (Revenue)</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</div>
                                    <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xl font-black text-white font-mono shadow-inner">
                                        {load.carrierRate?.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Carrier Pay (Exp)</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-bold">$</div>
                                    <div className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xl font-black text-slate-400 font-mono shadow-inner">
                                        {load.driverPay?.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#0a0f18] border border-slate-800 rounded-2xl p-4 shadow-inner">
                                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Profit Margin</div>
                                    <div className={`text-lg font-black mt-1 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>${profit.toLocaleString()}</div>
                                </div>
                                <div className="bg-[#0a0f18] border border-slate-800 rounded-2xl p-4 shadow-inner text-right">
                                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Margin %</div>
                                    <div className={`text-lg font-black mt-1 ${marginPercentage >= 15 ? 'text-blue-500' : 'text-slate-400'}`}>{marginPercentage.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Asset Sub-Header Row */}
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex items-center justify-between gap-8 overflow-x-auto no-scrollbar shadow-2xl">
                        <div className="space-y-1 shrink-0">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Truck #</label>
                            <div className="min-w-[80px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-black text-white uppercase">{load.truckNumber || 'UNIT-'}</div>
                        </div>
                        <div className="space-y-1 shrink-0">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Trailer #</label>
                            <div className="min-w-[80px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-black text-white uppercase">{load.trailerNumber || 'TRL-'}</div>
                        </div>
                        <div className="space-y-1 shrink-0">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Chassis</label>
                            <div className="min-w-[100px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-black text-slate-700 uppercase">---</div>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[200px]">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Assigned Driver</label>
                            <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-black text-white uppercase truncate flex items-center gap-3">
                                <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                                {driver?.name || '-- UNASSIGNED --'}
                            </div>
                        </div>
                        <div className="space-y-1 shrink-0">
                            <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Contact Cell</label>
                            <button onClick={() => onOpenHub?.('messaging', true)} className="flex items-center gap-3 text-blue-400 hover:text-blue-300 transition-colors uppercase font-black text-[10px] tracking-widest bg-blue-600/5 px-4 py-2 rounded-xl border border-blue-500/10 active:scale-95 shadow-lg">
                                <Headset className="w-4 h-4" /> Log Call
                            </button>
                        </div>
                    </div>

                    {/* Stop Matrix Section (Live Data Connect) */}
                    <div className="space-y-5">
                        <div className="flex justify-between items-center px-2">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                <Navigation className="w-4 h-4 text-blue-500" /> Stop Matrix (Sequential)
                            </h3>
                            <div className="flex gap-4">
                                <button className="px-5 py-2 bg-slate-800 border border-slate-700 text-[9px] font-black uppercase tracking-widest rounded-xl text-slate-400 hover:text-white transition-all">+ Add Pickup</button>
                                <button className="px-5 py-2 bg-blue-600 text-[9px] font-black uppercase tracking-widest rounded-xl text-white shadow-lg shadow-blue-900/40 active:scale-95 transition-all">+ Add Drop</button>
                            </div>
                        </div>

                        <div className="bg-[#0a0f18] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/80 border-b border-slate-800">
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-600 uppercase tracking-widest">Type</th>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-600 uppercase tracking-widest">Facility / Address</th>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-600 uppercase tracking-widest">City / ST / Zip</th>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-600 uppercase tracking-widest">Seal #</th>
                                        <th className="px-6 py-5 text-center text-[9px] font-black text-slate-600 uppercase tracking-widest">Pallets</th>
                                        <th className="px-6 py-5 text-center text-[9px] font-black text-slate-600 uppercase tracking-widest">Weight</th>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-600 uppercase tracking-widest">Date/Time</th>
                                        <th className="px-4 py-1"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {(load.legs || [
                                        { id: '1', type: 'Pickup', location: load.pickup, date: load.pickupDate, appointmentTime: '08:00', pallets: 12, weight: 24000, sealNumber: 'S-77281', requirements: 'Lumper required; Driver must check in at South Gate.', stats: 'Avg Turn: 45m | On-Time: 98%' },
                                        { id: '2', type: 'Dropoff', location: load.dropoff, date: load.dropoffDate, appointmentTime: '16:00', pallets: 12, weight: 24000, sealNumber: 'S-77281', requirements: 'Scheduled appt only; PPE required.', stats: 'Avg Turn: 90m | High Congestion' }
                                    ]).map((leg: any, idx) => (
                                        <tr key={leg.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/[0.03] last:border-0">
                                            <td className="px-6 py-8 align-top">
                                                <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-inner border inline-block ${leg.type === 'Pickup' ? 'bg-green-600/10 text-green-500 border-green-500/10' : 'bg-blue-600/10 text-blue-500 border-blue-500/10'}`}>
                                                    {leg.type}
                                                </div>
                                            </td>
                                            <td className="px-6 py-8 align-top space-y-3">
                                                <div>
                                                    <div className="text-[13px] font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors mb-1">{leg.location?.facilityName || 'LOGISTICS NODE'}</div>
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{leg.location?.address || 'Address Restricted'}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="px-2 py-1 bg-black/40 border border-white/5 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Activity className="w-3 h-3 text-blue-500" /> {leg.stats || 'No historical data'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-8 align-top">
                                                <div className="space-y-1">
                                                    <div className="text-xs font-black text-slate-300 font-mono uppercase">
                                                        {leg.location ? `${leg.location.city}, ${leg.location.state}` : '---'}
                                                    </div>
                                                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{leg.location?.zip || '---'}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-8 align-top">
                                                <div className="bg-slate-950/50 border border-slate-800/50 rounded-lg px-3 py-1.5 text-[10px] text-blue-400 font-black font-mono tracking-widest text-center shadow-inner">
                                                    {leg.sealNumber || '---'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-8 align-top text-center">
                                                <div className="text-[11px] font-black text-white">{leg.pallets || 0}</div>
                                                <div className="text-[8px] font-black text-slate-600 uppercase mt-1">Units</div>
                                            </td>
                                            <td className="px-6 py-8 align-top text-center">
                                                <div className="text-[11px] font-black text-white">{leg.weight?.toLocaleString() || 0}</div>
                                                <div className="text-[8px] font-black text-slate-600 uppercase mt-1">LBS</div>
                                            </td>
                                            <td className="px-6 py-8 align-top space-y-1">
                                                <div className="text-xs font-black text-white font-mono">{leg.date}</div>
                                                <div className="text-[9px] text-amber-500 font-black uppercase tracking-widest">{leg.appointmentTime || '00:00'} APPT</div>
                                            </td>
                                            <td className="px-6 py-8 align-top">
                                                <div className="max-w-[180px]">
                                                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1.5">TACTICAL REQS</div>
                                                    <p className="text-[9px] text-slate-400 italic leading-relaxed">{leg.requirements || 'No specific site requirements logged.'}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Artifact Matrix Section (Vault Integration) */}
                    <div className="space-y-5">
                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3 px-2">
                            <FileText className="w-4 h-4 text-amber-500" /> Digital Artifacts Matrix
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {vaultDocs.map((doc) => (
                                <div key={doc.id} className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-blue-500/30 transition-all cursor-pointer group shadow-xl">
                                    <div className="aspect-[4/3] bg-black/40 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-800 relative shadow-inner">
                                        <FileText className="w-10 h-10 text-slate-800 group-hover:scale-110 transition-transform" />
                                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-all flex items-center justify-center">
                                            <Download className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-black text-white uppercase truncate tracking-tight">{doc.filename}</div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{doc.type}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${doc.status === 'Approved' ? 'text-green-500' : 'text-orange-500'}`}>
                                                {doc.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="bg-slate-900/10 border-2 border-dashed border-slate-800/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-blue-500/30 transition-all hover:bg-blue-600/5">
                                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
                                    <Plus className="w-6 h-6 text-slate-700 group-hover:text-blue-400" />
                                </div>
                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-blue-500">Inject Electronic Records</div>
                                <p className="text-[8px] text-slate-800 uppercase mt-2 font-bold tracking-widest">BOL, POD, RATE CON, HAZMAT</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions (Matches EditLoadForm) */}
                <div className="p-8 bg-slate-900 border-t border-slate-800 flex justify-end items-center gap-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
                    <button onClick={onClose} className="px-8 py-4 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors">Discard View</button>
                    <div className="flex gap-4">
                        <button onClick={handleGenerateInvoice} disabled={isGenerating} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
                            Initialize Settlement
                        </button>
                        <button
                            onClick={() => onEdit(load)}
                            className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-900/40 active:scale-95 transition-all outline-none"
                        >
                            Authorize Manifest Edits
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
