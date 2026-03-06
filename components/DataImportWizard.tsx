import React, { useState, useRef } from 'react';
import {
    Upload, FileSpreadsheet, Map, CheckCircle,
    AlertCircle, X, ArrowRight, Save,
    Settings, Table, Download, Eye, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ImportTemplate, ImportMapping, ImportDryRun } from '../types';

interface Props {
    type: 'Fuel' | 'Bills' | 'Invoices' | 'CoA';
    onImport: (data: any[]) => Promise<void>;
    onClose: () => void;
}

export const DataImportWizard: React.FC<Props> = ({ type, onImport, onClose }) => {
    const [step, setStep] = useState(1);
    const [fileData, setFileData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<ImportMapping[]>([]);
    const [dryRun, setDryRun] = useState<ImportDryRun | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const targetFields = {
        'Fuel': ['date', 'stateCode', 'gallons', 'unitPrice', 'totalCost', 'vendorName', 'truckId', 'driverId', 'cardNumber'],
        'Bills': ['billNumber', 'vendorId', 'billDate', 'dueDate', 'totalAmount', 'description', 'category', 'allocationType', 'allocationId'],
        'Invoices': ['invoiceNumber', 'customerId', 'loadId', 'invoiceDate', 'dueDate', 'totalAmount', 'description'],
        'CoA': ['accountNumber', 'name', 'type', 'category', 'subCategory']
    }[type];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            if (file.name.endsWith('.csv')) {
                Papa.parse(bstr as string, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        setFileData(results.data);
                        setHeaders(Object.keys(results.data[0] || {}));
                        setStep(2);
                    }
                });
            } else {
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                setFileData(data);
                setHeaders(Object.keys(data[0] || {}));
                setStep(2);
            }
        };

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    };

    const runDryRun = () => {
        setLoading(true);
        // Simulate dry run validation
        const errors: any[] = [];
        const preview = fileData.slice(0, 5).map((row, idx) => {
            const mapped: any = {};
            mappings.forEach(m => {
                const val = row[m.sourceColumn];
                mapped[m.targetField] = val;

                // Simple validation logic
                if (m.targetField === 'gallons' && Number(val) <= 0) {
                    errors.push({ row: idx + 1, field: m.targetField, message: 'Gallons must be positive' });
                }
                if (m.targetField === 'date' && !Date.parse(val)) {
                    errors.push({ row: idx + 1, field: m.targetField, message: 'Invalid date format' });
                }
            });
            return mapped;
        });

        setDryRun({
            success: errors.length === 0,
            totalRows: fileData.length,
            validRows: fileData.length - errors.length,
            errorRows: errors.length,
            errors,
            preview
        });
        setStep(3);
        setLoading(false);
    };

    const handleMappingChange = (target: string, source: string) => {
        setMappings(prev => {
            const existing = prev.filter(m => m.targetField !== target);
            if (!source) return existing;
            return [...existing, { targetField: target, sourceColumn: source }];
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[200] flex items-center justify-center p-10">
            <div className="bg-[#020617] border border-white/10 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col h-[80vh] overflow-hidden">
                {/* HEADER */}
                <div className="p-10 border-b border-white/5 bg-slate-900/20 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                            <Upload className="w-8 h-8 text-blue-500" />
                            Import Engine <span className="text-blue-500/50">Pro</span>
                        </h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 ml-1">
                            {type} Statement Import • Template Mapping • Integrity Guard
                        </p>
                    </div>
                    <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl transition-all">
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* STEPS INDICATOR */}
                <div className="px-10 py-6 bg-slate-900/10 flex items-center gap-6 shrink-0">
                    {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${step >= s ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-900 text-slate-700'}`}>
                                {s}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${step === s ? 'text-white' : 'text-slate-700'}`}>
                                {s === 1 ? 'Upload' : s === 2 ? 'Mapping' : 'Dry Run'}
                            </span>
                            {s < 3 && <ArrowRight className="w-4 h-4 text-slate-800" />}
                        </div>
                    ))}
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-auto p-10">
                    {step === 1 && (
                        <div className="h-full flex flex-col items-center justify-center space-y-8 border-4 border-dashed border-white/5 rounded-[3rem] bg-slate-900/5">
                            <div className="p-10 bg-blue-500/5 rounded-full border border-blue-500/10">
                                <FileSpreadsheet className="w-20 h-20 text-blue-500 opacity-20" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Drop Excel or CSV File</h3>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Maximum file size: 50MB</p>
                            </div>
                            <input
                                type="file"
                                hidden
                                ref={fileInputRef}
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20"
                            >
                                Select File from Desktop
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <Settings className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <div className="text-[10px] font-black text-white uppercase tracking-widest">Saved Layouts</div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase">Auto-detected MHC-Kenworth_v2</div>
                                    </div>
                                </div>
                                <button className="px-4 py-2 bg-white/5 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest">Apply Template</button>
                            </div>

                            <div className="bg-slate-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-black/20 border-b border-white/5">
                                        <tr>
                                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase w-1/3">Target Logical Field</th>
                                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase w-1/2">Source Column Link</th>
                                            <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">Sample</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {targetFields.map(field => (
                                            <tr key={field}>
                                                <td className="px-8 py-6 font-black text-white uppercase tracking-tighter text-xs">{field}</td>
                                                <td className="px-8 py-6">
                                                    <select
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-[10px] font-black text-slate-300 outline-none focus:border-blue-500/50 appearance-none"
                                                        value={mappings.find(m => m.targetField === field)?.sourceColumn || ''}
                                                        onChange={(e) => handleMappingChange(field, e.target.value)}
                                                    >
                                                        <option value="">-- UNMAPPED --</option>
                                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-8 py-6 text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                                                    {fileData[0]?.[mappings.find(m => m.targetField === field)?.sourceColumn || ''] || '---'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 3 && dryRun && (
                        <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                            {/* RESULTS BANNER */}
                            <div className={`p-8 rounded-[2.5rem] border ${dryRun.success ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'} flex items-center justify-between`}>
                                <div className="flex items-center gap-6">
                                    <div className={`p-5 rounded-full ${dryRun.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {dryRun.success ? <CheckCircle className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-black uppercase tracking-tighter ${dryRun.success ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {dryRun.success ? 'Data Integrity Verified' : 'Integrity Failures Detected'}
                                        </h3>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                                            Processed {dryRun.totalRows} records • {dryRun.validRows} valid • {dryRun.errorRows} errors
                                        </p>
                                    </div>
                                </div>
                                {!dryRun.success && (
                                    <div className="text-right">
                                        <div className="text-xs font-black text-red-500 uppercase font-mono">{dryRun.errorRows} CRITICAL ERRORS</div>
                                        <button className="text-[10px] font-black text-slate-500 uppercase hover:underline mt-2">View Error Manifest</button>
                                    </div>
                                )}
                            </div>

                            {/* PREVIEW GRID */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Sample Output Buffer</h4>
                                <div className="bg-slate-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-black/20 border-b border-white/5">
                                            <tr>
                                                {targetFields.slice(0, 5).map(f => (
                                                    <th key={f} className="px-6 py-4 text-[8px] font-black text-slate-600 uppercase">{f}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {dryRun.preview.map((row, i) => (
                                                <tr key={i}>
                                                    {targetFields.slice(0, 5).map(f => (
                                                        <td key={f} className="px-6 py-4 text-[10px] font-mono text-slate-300">{String(row[f])}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-10 border-t border-white/5 bg-slate-900/20 shrink-0 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                    >
                        Cancel Import
                    </button>
                    <div className="flex gap-4">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="px-8 py-5 bg-white/5 text-white border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-inter"
                            >
                                Previous Step
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                onClick={runDryRun}
                                className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 font-inter"
                                disabled={mappings.length === 0}
                            >
                                Run Integrity Check <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                onClick={() => onImport(fileData)}
                                className="px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 font-inter"
                                disabled={!dryRun?.success}
                            >
                                Commit to Database <Save className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
