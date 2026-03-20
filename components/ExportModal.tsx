
import React, { useState, useMemo } from 'react';
import { LoadData } from '../types';
import { X, FileText, Download, Calendar, Filter, CheckSquare, Square, Building2 } from 'lucide-react';
import { exportToPDF, exportToCSV } from '../services/storageService';

interface Props {
  loads: LoadData[];
  onClose: () => void;
  currentUserRole?: string;
}

export type ReportColumn = 'loadNumber' | 'status' | 'date' | 'customer' | 'origin' | 'destination' | 'rate' | 'driver' | 'truck' | 'miles' | 'expenses';

const AVAILABLE_COLUMNS: { id: ReportColumn; label: string }[] = [
  { id: 'loadNumber', label: 'Load #' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Pickup Date' },
  { id: 'customer', label: 'Customer/Broker' },
  { id: 'origin', label: 'Origin City' },
  { id: 'destination', label: 'Dest City' },
  { id: 'rate', label: 'Carrier Rate ($)' },
  { id: 'driver', label: 'Driver' },
  { id: 'truck', label: 'Truck #' },
  { id: 'miles', label: 'IFTA Miles' },
  { id: 'expenses', label: 'Accessorials ($)' },
];

export const ExportModal: React.FC<Props> = ({ loads, onClose, currentUserRole }) => {
  // --- State ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>([
    'loadNumber', 'status', 'date', 'customer', 'origin', 'destination', 'rate'
  ]);

  // --- Derived Data for Filters ---
  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    loads.forEach(l => {
      // Use Facility Name if broker is missing, or Broker Name if linked (simplified here to Facility Name for generic use)
      const name = l.pickup?.facilityName || 'Unknown';
      customers.add(name);
    });
    return Array.from(customers).sort();
  }, [loads]);

  // --- Filtering Logic ---
  const filteredData = useMemo(() => {
    return loads.filter(l => {
      // Date Filter
      if (startDate && l.pickupDate < startDate) return false;
      if (endDate && l.pickupDate > endDate) return false;

      // Customer Filter
      if (selectedCustomerId !== 'all') {
        const custName = l.pickup?.facilityName || 'Unknown';
        if (custName !== selectedCustomerId) return false;
      }

      return true;
    });
  }, [loads, startDate, endDate, selectedCustomerId]);

  const toggleColumn = (colId: ReportColumn) => {
    if (selectedColumns.includes(colId)) {
      if (selectedColumns.length > 1) { // Prevent empty selection
        setSelectedColumns(prev => prev.filter(c => c !== colId));
      }
    } else {
      setSelectedColumns(prev => [...prev, colId]);
    }
  };

  const handleExport = (type: 'pdf' | 'csv') => {
    const config = {
      columns: selectedColumns,
      title: `Load Report`,
      subtitle: `${startDate || 'Start'} to ${endDate || 'Present'}`,
      includeTotals: selectedColumns.includes('rate') || selectedColumns.includes('miles')
    };

    if (type === 'pdf') {
      exportToPDF(filteredData, config);
    } else {
      exportToCSV(filteredData, config);
    }
    onClose();
  };

  // Quick Date Helpers
  const setMonth = (offset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" /> Export & Reports
            </h2>
            <p className="text-xs text-slate-400">Generate custom reports for accounting or analysis.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Filters */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
              <Filter className="w-4 h-4 text-blue-400" /> 1. Filter Data
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 p-3 rounded border border-slate-700">
                <label className="text-xs text-slate-400 mb-2 block font-semibold">Date Range</label>
                <div className="flex gap-2 mb-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs text-white" />
                  <span className="text-slate-500 self-center">-</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs text-white" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMonth(0)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-blue-300 border border-slate-600">This Month</button>
                  <button onClick={() => setMonth(-1)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-600">Last Month</button>
                  <button onClick={() => {setStartDate(''); setEndDate('')}} className="text-[10px] text-slate-500 hover:text-slate-300 ml-auto">Clear</button>
                </div>
              </div>

              <div className="bg-slate-900 p-3 rounded border border-slate-700">
                <label className="text-xs text-slate-400 mb-2 block font-semibold">Customer / Facility</label>
                <div className="relative">
                  <Building2 className="absolute left-2 top-2 w-4 h-4 text-slate-500" />
                  <select 
                    value={selectedCustomerId} 
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded pl-8 p-2 text-xs text-white outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="all">All Customers</option>
                    {uniqueCustomers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Columns */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
              <CheckSquare className="w-4 h-4 text-green-400" /> 2. Select Columns
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-slate-900 p-4 rounded border border-slate-700">
              {AVAILABLE_COLUMNS.map(col => {
                // Hide Rate/Expenses if user is restricted (Driver view usually hides this in lists, but check role)
                if ((col.id === 'rate' || col.id === 'expenses') && currentUserRole === 'driver') return null;

                const isSelected = selectedColumns.includes(col.id);
                return (
                  <button 
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`flex items-center gap-2 text-xs p-2 rounded transition-colors text-left
                      ${isSelected ? 'bg-blue-900/30 text-blue-200 border border-blue-800' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}
                    `}
                  >
                    {isSelected ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" />}
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Preview */}
          <div className="bg-slate-800 p-3 rounded border border-slate-600 flex justify-between items-center text-xs">
             <span className="text-slate-400">Records found: <strong className="text-white">{filteredData.length}</strong></span>
             {filteredData.length === 0 && <span className="text-red-400 font-bold">No data matches filters</span>}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-700 bg-slate-900/50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
          
          <button 
            disabled={filteredData.length === 0}
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded border border-green-600 shadow-lg shadow-green-900/20 transition-all"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          
          <button 
            disabled={filteredData.length === 0}
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded border border-red-600 shadow-lg shadow-red-900/20 transition-all"
          >
            <FileText className="w-4 h-4" /> Generate PDF Report
          </button>
        </div>

      </div>
    </div>
  );
};
