import React, { useMemo, useState } from 'react';
import { LoadData, User, Issue, IssueCategory } from '../types';
import {
  AlertTriangle, X, CheckCircle, Wrench, DollarSign,
  Truck, AlertOctagon, ArrowRight, Headset, History,
  CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { saveLoad } from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loads: LoadData[];
  currentUser: User;
  onViewLoad: (load: LoadData) => void;
  onRefresh: () => void;
}

export const IssueSidebar: React.FC<Props> = ({ isOpen, onClose, loads, currentUser, onViewLoad, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'Issues' | 'Calls'>('Issues');

  // Aggregate all active issues from all loads
  const activeIssues = useMemo(() => {
    const issuesList: { issue: Issue, load: LoadData }[] = [];
    loads.forEach(load => {
      if (load.issues) {
        load.issues.forEach(issue => {
          if (issue.status !== 'Resolved') {
            issuesList.push({ issue, load });
          }
        });
      }
    });
    return issuesList;
  }, [loads]);

  const filteredIssues = useMemo(() => {
    if (currentUser.role === 'admin') return activeIssues;
    if (currentUser.role === 'safety_manager') return activeIssues.filter(i => i.issue.category === 'Safety' || i.issue.category === 'Maintenance' || i.issue.category === 'Incident');
    if (currentUser.role === 'payroll_manager') return activeIssues.filter(i => i.issue.category === 'Payroll');
    if (currentUser.role === 'dispatcher') return activeIssues.filter(i => i.issue.category === 'Dispatch' || i.issue.category === 'Handoff');
    return [];
  }, [activeIssues, currentUser.role]);

  const handleResolve = (load: LoadData, issueId: string) => {
    const updatedIssues = load.issues?.map(i =>
      i.id === issueId ? { ...i, status: 'Resolved' as const, resolvedAt: new Date().toISOString(), resolvedBy: currentUser.name } : i
    );
    const updatedLoad = { ...load, issues: updatedIssues };
    saveLoad(updatedLoad, currentUser);
    onRefresh();
  };

  const getCategoryColor = (cat: IssueCategory) => {
    switch (cat) {
      case 'Payroll': return 'text-yellow-400 border-yellow-500/50 bg-yellow-900/20';
      case 'Safety': return 'text-red-400 border-red-500/50 bg-red-900/20';
      case 'Maintenance': return 'text-orange-400 border-orange-500/50 bg-orange-900/20';
      case 'Handoff': return 'text-purple-400 border-purple-500/50 bg-purple-900/20';
      default: return 'text-blue-400 border-blue-500/50 bg-blue-900/20';
    }
  };

  const allCallLogs = useMemo(() => {
    const logs: { log: any, load: LoadData }[] = [];
    loads.forEach(load => {
      if (load.callLogs) {
        load.callLogs.forEach(log => logs.push({ log, load }));
      }
    });
    return logs.sort((a, b) => new Date(b.log.timestamp).getTime() - new Date(a.log.timestamp).getTime());
  }, [loads]);

  const handleApproveAction = (load: LoadData, isApproved: boolean) => {
    const updatedLoad = {
      ...load,
      isActionRequired: false,
      actionSummary: isApproved ? `Approved: ${load.actionSummary}` : `Rejected: ${load.actionSummary}`
    };
    saveLoad(updatedLoad, currentUser);
    onRefresh();
  };

  const getCategoryIcon = (cat: IssueCategory) => {
    switch (cat) {
      case 'Payroll': return <DollarSign className="w-4 h-4" />;
      case 'Safety': return <AlertOctagon className="w-4 h-4" />;
      case 'Maintenance': return <Wrench className="w-4 h-4" />;
      case 'Dispatch': return <Truck className="w-4 h-4" />;
      case 'Handoff': return <ArrowRight className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[60] w-96 bg-[#0a0f18] border-l border-slate-800 shadow-2xl flex flex-col animate-fade-in-right">
      <div className="p-4 border-b border-slate-800 flex flex-col gap-4 bg-slate-900/90 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Action Center
            <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{filteredIssues.length}</span>
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('Issues')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === 'Issues' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <AlertTriangle className="w-3 h-3" /> Dept Issues
          </button>
          <button
            onClick={() => setActiveTab('Calls')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === 'Calls' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <History className="w-3 h-3" /> Call Matrix
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-slate-900/20">

        {activeTab === 'Issues' && (
          <>
            {filteredIssues.length === 0 && (
              <div className="text-center text-slate-700 py-10">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Priority Issues</p>
              </div>
            )}

            {filteredIssues.map(({ issue, load }) => (
              <div key={issue.id} className={`p-4 rounded-xl border ${getCategoryColor(issue.category)} relative group shadow-lg`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest">
                    {getCategoryIcon(issue.category)} {issue.category}
                  </span>
                  <span className="text-[8px] text-slate-500 font-bold">{new Date(issue.reportedAt).toLocaleDateString()}</span>
                </div>

                <p className="text-xs text-white font-medium mb-2 leading-relaxed">{issue.description}</p>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    Manifest #{load.loadNumber}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewLoad(load)}
                      className="p-1.5 bg-slate-900/50 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all border border-white/5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {(currentUser.role === 'admin' || currentUser.role === 'safety_manager' || currentUser.role === 'dispatcher') && (
                      <button
                        onClick={() => handleResolve(load, issue.id)}
                        className="p-1.5 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white rounded-lg transition-all border border-green-500/20"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Handoff/Action Required Section */}
            {loads.filter(l => l.isActionRequired).length > 0 && (
              <div className="mt-8 space-y-3">
                <h4 className="text-[8px] font-black text-yellow-600 uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> Required Approvals / Handoffs
                </h4>
                {loads.filter(l => l.isActionRequired).map(load => (
                  <div key={load.id} className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black text-white uppercase tracking-widest bg-yellow-600/20 px-2 py-0.5 rounded">Action REQ: {load.loadNumber}</span>
                      <span className="text-[8px] text-slate-600 font-bold uppercase">{load.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 italic leading-relaxed">"{load.actionSummary || 'No justification provided.'}"</p>
                    {currentUser.role === 'admin' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApproveAction(load, true)}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleApproveAction(load, false)}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-900 text-red-500 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-900/30 transition-all"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'Calls' && (
          <div className="space-y-3">
            {allCallLogs.length === 0 && (
              <div className="text-center text-slate-700 py-10">
                <Headset className="w-12 h-12 mx-auto mb-2 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Comm Records</p>
              </div>
            )}
            {allCallLogs.map(({ log, load }) => (
              <div key={log.id} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2 group hover:border-blue-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/20 px-1.5 py-0.5 rounded w-fit">{log.type}</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{log.recordedBy}</span>
                  </div>
                  <span className="text-[8px] text-slate-600 font-bold">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium italic border-l border-slate-700 pl-3 leading-relaxed">"{log.notes}"</p>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[8px] font-black text-slate-600 uppercase">MNF: {load.loadNumber}</span>
                  <button onClick={() => onViewLoad(load)} className="text-[8px] font-black text-blue-500 uppercase flex items-center gap-1 hover:text-blue-400 transition-colors">View <ArrowRight className="w-2.5 h-2.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
