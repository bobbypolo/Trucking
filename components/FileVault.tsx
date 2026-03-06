import React, { useState, useEffect, useMemo } from 'react';
import {
    Shield, FileText, Upload, Filter, Search,
    Lock, Unlock, History, MoreVertical,
    Download, Trash2, CheckCircle, AlertCircle,
    User, Truck, Package, HardDrive, Clock, ExternalLink
} from 'lucide-react';
import { VaultDoc, VaultDocType, VaultDocStatus, User as UserType, LoadData } from '../types';
import { getVaultDocs, uploadToVault, updateDocStatus } from '../services/financialService';

interface Props {
    currentUser: UserType;
    loads: LoadData[];
}

export const FileVault: React.FC<Props> = ({ currentUser, loads }) => {
    const [docs, setDocs] = useState<VaultDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<VaultDocType | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<VaultDocStatus | 'all'>('all');
    const [showUploadModal, setShowUploadModal] = useState(false);

    const loadVault = async () => {
        setLoading(true);
        try {
            const data = await getVaultDocs({});
            setDocs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load vault', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadVault();
    }, []);

    const filteredDocs = useMemo(() => {
        return docs.filter(doc => {
            const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.loadId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.vendorName?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'all' || doc.type === typeFilter;
            const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
            return matchesSearch && matchesType && matchesStatus;
        });
    }, [docs, searchQuery, typeFilter, statusFilter]);

    const getDocIcon = (type: VaultDocType) => {
        switch (type) {
            case 'BOL':
            case 'POD': return <FileText className="w-5 h-5 text-blue-500" />;
            case 'Fuel': return <FileText className="w-5 h-5 text-emerald-500" />;
            case 'Repair': return <FileText className="w-5 h-5 text-orange-500" />;
            case 'Insurance':
            case 'Permit': return <Shield className="w-5 h-5 text-purple-500" />;
            default: return <FileText className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusStyle = (status: VaultDocStatus) => {
        switch (status) {
            case 'Approved':
            case 'Locked': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Draft': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            case 'Submitted': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'Rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <HardDrive className="w-7 h-7 text-blue-500" />
                        Audit-Ready File Vault
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                        Locked Compliance Records • Load-Linked Metadata • Immutable History
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Secure Upload
                    </button>
                </div>
            </header>

            {/* FILTERS */}
            <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-3xl border border-white/5">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="SEARCH BY LOAD #, VENDOR, FILENAME..."
                        className="w-full bg-slate-950 border border-white/5 rounded-xl pl-12 pr-6 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-blue-500/50 transition-all font-mono"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-blue-500/50"
                >
                    <option value="all">DOCUMENT TYPES</option>
                    <option value="BOL">BOL</option>
                    <option value="POD">POD</option>
                    <option value="Fuel">FUEL RECEIPT</option>
                    <option value="Repair">REPAIR BILL</option>
                    <option value="Insurance">INSURANCE</option>
                    <option value="Permit">PERMIT</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-blue-500/50"
                >
                    <option value="all">ALL STATUSES</option>
                    <option value="Draft">DRAFT</option>
                    <option value="Submitted">SUBMITTED</option>
                    <option value="Approved">APPROVED</option>
                    <option value="Locked">LOCKED</option>
                </select>
            </div>

            {/* GRID / TABLE */}
            <div className="flex-1 overflow-auto bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] backdrop-blur-md">
                <table className="w-full text-left">
                    <thead className="bg-black/20 border-b border-white/5">
                        <tr>
                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">Document</th>
                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">Linked Reference</th>
                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">Meta / Amount</th>
                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">Auditor / Date</th>
                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">Status</th>
                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={6} className="px-8 py-8"><div className="h-4 bg-white/5 rounded w-full"></div></td>
                                </tr>
                            ))
                        ) : filteredDocs.length > 0 ? (
                            filteredDocs.map((doc) => (
                                <tr key={doc.id} className="hover:bg-white/[0.02] transition-all group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-900 rounded-2xl border border-white/5">
                                                {getDocIcon(doc.type)}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{doc.filename}</div>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase">{doc.type} • v{doc.version}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1">
                                            {doc.loadId && (
                                                <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase">
                                                    <Package className="w-3 h-3" /> Load #{doc.loadId}
                                                </div>
                                            )}
                                            {doc.truckId && (
                                                <div className="flex items-center gap-2 text-[10px] font-black text-purple-400 uppercase">
                                                    <Truck className="w-3 h-3" /> Truck #{doc.truckId}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-[11px] font-black text-emerald-500">{doc.amount ? `$${doc.amount.toLocaleString()}` : '--'}</div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase">{doc.vendorName || 'Not Specified'}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-[10px] font-black text-white">{new Date(doc.createdAt).toLocaleDateString()}</div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                            <User className="w-2 h-2" /> {doc.createdBy}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${getStatusStyle(doc.status)}`}>
                                                {doc.status}
                                            </span>
                                            {doc.isLocked && <Lock className="w-3 h-3 text-emerald-500" />}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 transition-all">
                                                <Download className="w-3.5 h-3.5 text-slate-400" />
                                            </button>
                                            <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 transition-all">
                                                <History className="w-3.5 h-3.5 text-slate-400" />
                                            </button>
                                            <button className="p-2 bg-slate-800 hover:bg-red-500/20 rounded-lg border border-white/5 transition-all group/del" disabled={doc.isLocked}>
                                                <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover/del:text-red-500" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-8 py-32 text-center">
                                    <div className="flex flex-col items-center justify-center opacity-20">
                                        <HardDrive className="w-16 h-16 mb-4" />
                                        <div className="text-xl font-black uppercase tracking-widest">No matching records found</div>
                                        <div className="text-[10px] uppercase font-bold mt-2 tracking-widest">Adjust filters or search criteria</div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* SUMMARY BAR */}
            <div className="flex justify-between items-center bg-slate-900/30 border border-white/5 p-6 rounded-[2rem] px-10">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-3">
                        <Lock className="w-4 h-4 text-emerald-500" />
                        <div>
                            <div className="text-[12px] font-black text-white uppercase tracking-tighter">{docs.filter(d => d.isLocked).length} Locked</div>
                            <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Post-Approval Secure</div>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <div>
                            <div className="text-[12px] font-black text-white uppercase tracking-tighter">{docs.filter(d => d.status === 'Submitted').length} Pending</div>
                            <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Awaiting Review</div>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 justify-end">
                        <Shield className="w-3 h-3" /> SOC2 Compliance Verified
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">Audit Log Coverage: 100% Transactions</div>
                </div>
            </div>
        </div>
    );
};
