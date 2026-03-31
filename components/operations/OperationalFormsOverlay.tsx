import React from "react";
import { v4 as uuidv4 } from "uuid";
import {
  X,
  Share2,
  ClipboardList,
  AlertTriangle,
  Phone,
  FileText,
  Search,
  Plus,
  CreditCard,
  CheckCircle,
  Link2,
  Home,
  LogOut,
  Lock,
  Navigation,
  MapPin,
  Users,
  DollarSign,
  ChevronRight,
  Building2,
  MessageSquare,
  Truck,
  User as UserIcon,
  Activity,
  Star,
  Workflow,
} from "lucide-react";
import {
  getIncidents,
  getProviders,
  getContacts,
  saveProvider,
  saveContact,
  saveServiceTicket,
  saveNotificationJob,
  createIncident as coreCreateIncident,
  saveTask,
  saveIncidentAction,
  saveIncidentCharge,
  globalSearch,
} from "../../services/storageService";
import { getVendors, saveVendor } from "../../services/safetyService";
import {
  OperationalEvent,
  User,
  WorkItem,
  EntityType,
  ContextRecord,
  OperationalTask,
  KCIRequest,
  RequestType,
  Incident,
  IncidentAction,
  Provider,
  Contact,
  ServiceTicket,
  NotificationJob,
  GlobalSearchResult,
  WorkspaceSession,
} from "../../types";

export interface OperationalFormsOverlayProps {
  showHandoffForm: boolean;
  setShowHandoffForm: (v: boolean) => void;
  showCallLogForm: boolean;
  setShowCallLogForm: (v: boolean) => void;
  showTaskForm: boolean;
  setShowTaskForm: (v: boolean) => void;
  showIssueForm: boolean;
  setShowIssueForm: (v: boolean) => void;
  showRequestForm: boolean;
  setShowRequestForm: (v: boolean) => void;
  showDirectoryDrawer: boolean;
  setShowDirectoryDrawer: (v: boolean) => void;
  handoffData: { assignedTo: string; notes: string };
  setHandoffData: (v: { assignedTo: string; notes: string }) => void;
  callData: { type: string; category: string; notes: string; attachedRecord: GlobalSearchResult | null };
  setCallData: (v: any) => void;
  taskData: any;
  setTaskData: (v: any) => void;
  issueData: any;
  setIssueData: (v: any) => void;
  requestData: any;
  setRequestData: (v: any) => void;
  propUsers: User[];
  user: User;
  activeRecord: ContextRecord | null;
  active360Data: any;
  session: WorkspaceSession;
  onRecordAction: (e: OperationalEvent) => Promise<void>;
  fetchQueues: () => Promise<void>;
  showSuccessMessage: (msg: string, timeout?: number) => void;
  setToast: (v: any) => void;
  setInteractionState: (v: any) => void;
  setSelectedTab: (v: string) => void;
  directoryTab: string;
  setDirectoryTab: (v: any) => void;
  directorySearchQuery: string;
  setDirectorySearchQuery: (v: string) => void;
  attachmentSearchQuery: string;
  setAttachmentSearchQuery: (v: string) => void;
  attachmentResults: GlobalSearchResult[];
  setAttachmentResults: (v: GlobalSearchResult[]) => void;
  handleAttachToRecord: (item: any, type: EntityType | "PROVIDER" | "CONTACT") => void;
  handleCreateRequest: () => Promise<void>;
  notificationContacts: Contact[];
  selectedContacts: string[];
  setSelectedContacts: (v: string[]) => void;
  allProviders: Provider[];
  allContacts: Contact[];
  recordResults: GlobalSearchResult[];
}

export const OperationalFormsOverlay: React.FC<OperationalFormsOverlayProps> = (props) => {
  const {
    showHandoffForm, setShowHandoffForm,
    showCallLogForm, setShowCallLogForm,
    showTaskForm, setShowTaskForm,
    showIssueForm, setShowIssueForm,
    showRequestForm, setShowRequestForm,
    showDirectoryDrawer, setShowDirectoryDrawer,
    handoffData, setHandoffData,
    callData, setCallData,
    taskData, setTaskData,
    issueData, setIssueData,
    requestData, setRequestData,
    propUsers, user,
    activeRecord, active360Data,
    onRecordAction, fetchQueues,
    showSuccessMessage, setToast,
    setInteractionState, setSelectedTab,
    directoryTab, setDirectoryTab,
    directorySearchQuery, setDirectorySearchQuery,
    attachmentSearchQuery, setAttachmentSearchQuery,
    attachmentResults, setAttachmentResults,
    handleAttachToRecord,
    handleCreateRequest,
    notificationContacts, selectedContacts, setSelectedContacts,
    session,
    allProviders, allContacts, recordResults,
  } = props;

  return (
    <>
      {showHandoffForm && (
        <div className="absolute inset-0 z-[1000] bg-[#050810]/95 backdrop-blur-xl flex items-center justify-center p-20">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[3rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                Initiate Handoff
              </h3>
              <button
                onClick={() => setShowHandoffForm(false)}
                className="text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-8">
              <select
                aria-label="Select operator for handoff"
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-blue-500/50"
                value={handoffData.assignedTo}
                onChange={(e) =>
                  setHandoffData({ ...handoffData, assignedTo: e.target.value })
                }
              >
                <option value="">Select Operator...</option>
                {propUsers.length > 0 ? (
                  propUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="user-1">John Dispatcher (Primary)</option>
                    <option value="user-2">Sarah Nightshift</option>
                    <option value="user-3">Mike Logistics</option>
                  </>
                )}
              </select>
              <textarea
                className="w-full bg-slate-950 border border-white/10 rounded-[2rem] p-6 text-sm text-white h-40 resize-none outline-none focus:border-blue-500/50"
                placeholder="Strategic briefing for the next operator..."
                aria-label="Strategic briefing for handoff"
                value={handoffData.notes}
                onChange={(e) =>
                  setHandoffData({ ...handoffData, notes: e.target.value })
                }
              ></textarea>
              <button
                onClick={async () => {
                  if (!handoffData.assignedTo) {
                    setToast({
                      message: "Select an operator for handoff",
                      type: "error",
                    });
                    return;
                  }
                  const assignedUser = propUsers.find(
                    (u) => u.id === handoffData.assignedTo,
                  ) || { name: handoffData.assignedTo };

                  // Persistent Ownership Transition
                  if (activeRecord?.type === "INCIDENT") {
                    const incs = await getIncidents();
                    const idx = incs.findIndex((i) => i.id === activeRecord.id);
                    if (idx >= 0) {
                      incs[idx].ownerUserId = handoffData.assignedTo;
                      incs[idx].status = "Handoff_Pending";
                      localStorage.setItem(
                        "loadpilot_crisis_v1",
                        JSON.stringify(incs),
                      );
                    }
                  } else if (activeRecord?.type === "WORK_ITEM") {
                    const wisString = localStorage.getItem(
                      "loadpilot_work_items_v1",
                    );
                    if (wisString) {
                      const wis: WorkItem[] = JSON.parse(wisString);
                      const idx = wis.findIndex(
                        (wi) => wi.id === activeRecord.id,
                      );
                      if (idx >= 0) {
                        wis[idx].status = "Handoff_Pending";
                        localStorage.setItem(
                          "loadpilot_work_items_v1",
                          JSON.stringify(wis),
                        );
                      }
                    }
                  }

                  try {
                    await onRecordAction({
                      id: uuidv4(),
                      type: "SYSTEM",
                      timestamp: new Date().toISOString(),
                      actorId: user.id,
                      actorName: user.name,
                      loadId: active360Data?.load?.id,
                      message: `Operational Handoff: Transtioned to ${assignedUser.name}. Note: ${handoffData.notes}`,
                      payload: handoffData,
                    });

                    await fetchQueues();
                    setShowHandoffForm(false);
                    showSuccessMessage(
                      `Operational Handoff Committed to ${assignedUser.name}`,
                    );
                  } catch (e) {
                    setToast({
                      message: `Handoff failed: ${e instanceof Error ? e.message : "Unknown error"}`,
                      type: "error",
                    });
                  }
                }}
                className="w-full py-4 bg-blue-600 rounded-2xl text-[11px] font-black text-white uppercase shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Commit Handoff
              </button>
            </div>
          </div>
        </div>
      )}

      {showCallLogForm && (
        <div className="absolute inset-0 z-[300] bg-[#050810]/95 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                  Manual Operational Log
                </h3>
              </div>
              <button
                onClick={() => setShowCallLogForm(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="call-entity-type"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                  >
                    Entity Type
                  </label>
                  <select
                    id="call-entity-type"
                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white outline-none"
                    value={callData.type}
                    onChange={(e) =>
                      setCallData({ ...callData, type: e.target.value })
                    }
                  >
                    <option>Driver</option>
                    <option>Broker</option>
                    <option>Carrier</option>
                    <option>Facility</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="call-category"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                  >
                    Category
                  </label>
                  <select
                    id="call-category"
                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white outline-none"
                    value={callData.category}
                    onChange={(e) =>
                      setCallData({ ...callData, category: e.target.value })
                    }
                  >
                    <option>Update</option>
                    <option>Emergency</option>
                    <option>Financial</option>
                    <option>Document</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="call-notes"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Notes
                </label>
                <textarea
                  id="call-notes"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-sm text-slate-300 h-32 resize-none outline-none focus:border-blue-500/50"
                  placeholder="Enter operational notes here..."
                  value={callData.notes}
                  onChange={(e) =>
                    setCallData({ ...callData, notes: e.target.value })
                  }
                ></textarea>
              </div>
              <button
                onClick={async () => {
                  await onRecordAction({
                    id: uuidv4(),
                    type: "CALL_LOG",
                    timestamp: new Date().toISOString(),
                    actorId: user.id,
                    actorName: user.name,
                    message: callData.notes,
                    loadId:
                      session.primaryContext?.type === "LOAD"
                        ? session.primaryContext.id
                        : undefined,
                    payload: { ...callData },
                  });
                  setShowCallLogForm(false);
                  showSuccessMessage("Operational Log Saved", 3000);
                }}
                className="w-full py-4 bg-teal-600 shadow-xl shadow-teal-900/40 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-teal-500 transition-all"
              >
                Save Log Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskForm && (
        <div className="absolute inset-0 z-[1000] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                  New Task
                </h3>
              </div>
              <button
                onClick={() => setShowTaskForm(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="task-title"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Task Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white outline-none focus:border-orange-500/50"
                  placeholder="What needs to be done?"
                  value={taskData.title}
                  onChange={(e) =>
                    setTaskData({ ...taskData, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="task-assignee"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Assignee
                </label>
                <select
                  id="task-assignee"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white outline-none"
                  value={taskData.assignedTo}
                  onChange={(e) =>
                    setTaskData({ ...taskData, assignedTo: e.target.value })
                  }
                >
                  <option value="">Select Assignee...</option>
                  {propUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={async () => {
                  if (!taskData.title) {
                    setToast({ message: "Title required", type: "error" });
                    return;
                  }
                  await onRecordAction({
                    id: uuidv4(),
                    type: "TASK",
                    timestamp: new Date().toISOString(),
                    actorId: user.id,
                    actorName: user.name,
                    message: `New Task: ${taskData.title}`,
                    payload: { ...taskData, status: "PENDING" },
                  });
                  setShowTaskForm(false);
                  showSuccessMessage("Task Created", 3000);
                }}
                className="w-full py-4 bg-orange-600 shadow-xl shadow-orange-900/40 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-orange-500 transition-all"
              >
                Dispatch Task
              </button>
            </div>
          </div>
        </div>
      )}

      {showIssueForm && (
        <div className="absolute inset-0 z-[1000] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                  Report Issue
                </h3>
              </div>
              <button
                onClick={() => setShowIssueForm(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="issue-category"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Category
                </label>
                <select
                  id="issue-category"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white outline-none"
                  value={issueData.category}
                  onChange={(e) =>
                    setIssueData({ ...issueData, category: e.target.value })
                  }
                >
                  <option>Safety</option>
                  <option>Mechanical</option>
                  <option>Financial</option>
                  <option>Dispatch</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="issue-description"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Description
                </label>
                <textarea
                  id="issue-description"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-sm text-slate-300 h-32 resize-none outline-none focus:border-red-500/50"
                  placeholder="Describe the issue in detail..."
                  value={issueData.description}
                  onChange={(e) =>
                    setIssueData({ ...issueData, description: e.target.value })
                  }
                ></textarea>
              </div>
              <button
                onClick={async () => {
                  if (!issueData.description) {
                    setToast({
                      message: "Description required",
                      type: "error",
                    });
                    return;
                  }
                  await onRecordAction({
                    id: uuidv4(),
                    type: "ISSUE",
                    timestamp: new Date().toISOString(),
                    actorId: user.id,
                    actorName: user.name,
                    message: `New Issue: ${issueData.category} - ${issueData.description}`,
                    loadId:
                      session.primaryContext?.type === "LOAD"
                        ? session.primaryContext.id
                        : undefined,
                    payload: { ...issueData, status: "OPEN" },
                  });
                  setShowIssueForm(false);
                  showSuccessMessage("Issue Logged", 3000);
                }}
                className="w-full py-4 bg-red-600 shadow-xl shadow-red-900/40 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-red-500 transition-all"
              >
                Commmit Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestForm && (
        <div className="absolute inset-0 z-[1000] bg-[#050810]/95 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-[#0a0f18] border border-slate-800 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
            {/* Header Section */}
            <div className="bg-slate-900 border-b border-slate-800 px-8 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">
                    Strategic Financial Request
                  </h3>
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                    Ref Identity: {requestData.id.split("-")[0]}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRequestForm(false)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500 hover:text-white" />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto no-scrollbar">
              {/* Context Grid */}
              <div className="space-y-3">
                <label
                  htmlFor="request-asset-context"
                  className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1"
                >
                  Asset Context (Required)
                </label>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-[13px] text-white font-bold outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-800"
                    placeholder="SEARCH LOAD, CUSTOMER, OR DRIVER..."
                    id="request-asset-context"
                    value={
                      requestData.attachedRecord
                        ? requestData.attachedRecord.label
                        : attachmentSearchQuery
                    }
                    onChange={(e) => {
                      if (requestData.attachedRecord) {
                        setRequestData({
                          ...requestData,
                          attachedRecord: null,
                        });
                        setAttachmentSearchQuery(e.target.value);
                      } else {
                        setAttachmentSearchQuery(e.target.value);
                      }
                    }}
                  />
                  {attachmentResults.length > 0 &&
                    !requestData.attachedRecord && (
                      <div className="absolute top-full left-0 right-0 mt-3 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden z-[1100] shadow-[0_20px_60px_rgba(0,0,0,0.8)] max-h-64 overflow-y-auto no-scrollbar">
                        {attachmentResults.map((res) => (
                          <button
                            key={res.id}
                            onClick={() => {
                              setRequestData({
                                ...requestData,
                                attachedRecord: {
                                  id: res.id,
                                  label: res.label,
                                  type: res.type,
                                },
                              });
                              setAttachmentResults([]);
                              setAttachmentSearchQuery("");
                            }}
                            className="w-full text-left px-6 py-4 hover:bg-blue-600/20 flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                          >
                            <div className="space-y-0.5">
                              <div className="text-[11px] font-black text-white uppercase tracking-tight">
                                {res.label}
                              </div>
                              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                {res.type}{" "}
                                {res.subLabel ? `• ${res.subLabel}` : ""}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-800" />
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label
                    htmlFor="request-type"
                    className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1"
                  >
                    Type Designation
                  </label>
                  <select
                    id="request-type"
                    value={requestData.type}
                    onChange={(e) =>
                      setRequestData({
                        ...requestData,
                        type: e.target.value as RequestType,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-[11px] font-black text-white outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="DETENTION">DETENTION (ACCESSORIAL)</option>
                    <option value="LAYOVER">LAYOVER (STRATEGIC)</option>
                    <option value="LUMPER">LUMPER (SERVICE)</option>
                    <option value="TOW">TOWING (CRITICAL)</option>
                    <option value="DOWNTIME">DOWNTIME (IDLE)</option>
                    <option value="REPOWER">REPOWER (LOGISTICS)</option>
                    <option value="TONU">TONU (CANCELLATION)</option>
                    <option value="EXPENSE">EXPENSE (GENERAL)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label
                    htmlFor="request-amount"
                    className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1"
                  >
                    Quantum (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-black font-mono">
                      $
                    </span>
                    <input
                      id="request-amount"
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-white font-mono outline-none focus:border-blue-500 transition-all shadow-inner"
                      placeholder="0.00"
                      value={requestData.amount}
                      onChange={(e) =>
                        setRequestData({
                          ...requestData,
                          amount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="request-justification"
                  className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1"
                >
                  Mission Justification
                </label>
                <textarea
                  id="request-justification"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-[11px] font-bold text-slate-400 h-32 resize-none outline-none focus:border-blue-500 transition-all shadow-inner no-scrollbar"
                  placeholder="PROVIDE OPERATIONAL RATIONALE FOR THIS EXCEPTION..."
                  value={requestData.notes}
                  onChange={(e) =>
                    setRequestData({ ...requestData, notes: e.target.value })
                  }
                ></textarea>
              </div>
            </div>

            {/* Footer Section */}
            <div className="p-8 bg-slate-900 border-t border-slate-800 flex justify-end items-center gap-6 shrink-0">
              <button
                onClick={() => setShowRequestForm(false)}
                className="px-8 py-4 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleCreateRequest}
                className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-lg shadow-blue-900/40 active:scale-95 transition-all outline-none"
              >
                Authorize Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENTERPRISE DIRECTORY DRAWER */}
      {showDirectoryDrawer && (
        <div className="fixed inset-0 z-[1200] flex justify-end">
          <div
            className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md"
            onClick={() => setShowDirectoryDrawer(false)}
          />
          <div className="relative w-[480px] h-full bg-[#0a0c10]/90 backdrop-blur-3xl border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col animate-in slide-in-from-right-full duration-500">
            {/* Drawer Header */}
            <div className="h-24 shrink-0 px-8 flex items-center justify-between border-b border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-[1.25rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-widest italic">
                    Enterprise Directory
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Network Live
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDirectoryDrawer(false)}
                className="p-3 hover:bg-white/10 rounded-2xl transition-all group"
              >
                <X className="w-6 h-6 text-slate-500 group-hover:text-white" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-white/5 bg-slate-950/20 px-6">
              {["PROVIDERS", "CONTACTS", "RECORDS", "PREFERRED", "IMPORT"].map(
                (tab: any) => (
                  <button
                    key={tab}
                    onClick={() => setDirectoryTab(tab)}
                    className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative ${directoryTab === tab ? "text-blue-400" : "text-slate-500 hover:text-white"}`}
                  >
                    {tab}
                    {directoryTab === tab && (
                      <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500" />
                    )}
                  </button>
                ),
              )}
            </div>

            {/* Search Bar */}
            <div className="p-6 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={`SEARCH ${directoryTab}...`}
                  aria-label={`Search ${directoryTab.toLowerCase()}`}
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-xs text-white outline-none focus:border-blue-500/50"
                  value={directorySearchQuery}
                  onChange={(e) => setDirectorySearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {directoryTab === "PROVIDERS" &&
                allProviders.filter(
                  (p) =>
                    !directorySearchQuery ||
                    p.name
                      .toLowerCase()
                      .includes(directorySearchQuery.toLowerCase()),
                ).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                    <Building2 className="w-12 h-12 text-slate-500/30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {directorySearchQuery
                        ? "No providers match your search"
                        : "No providers in directory"}
                    </p>
                    <p className="text-[11px] text-slate-600 font-bold uppercase leading-relaxed">
                      {directorySearchQuery
                        ? "Try a different search term"
                        : "Add providers from the Network portal"}
                    </p>
                  </div>
                )}

              {directoryTab === "PROVIDERS" &&
                allProviders
                  .filter(
                    (p) =>
                      !directorySearchQuery ||
                      p.name
                        .toLowerCase()
                        .includes(directorySearchQuery.toLowerCase()),
                  )
                  .map((provider) => (
                    <div
                      key={provider.id}
                      className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                          <h4 className="text-[15px] font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">
                            {provider.name}
                          </h4>
                          <div className="flex gap-2 mt-1.5">
                            <span className="text-[11px] font-black uppercase px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/10 rounded-lg">
                              PRO: {provider.type}
                            </span>
                            {provider.is247 && (
                              <span className="text-[11px] font-black uppercase px-2.5 py-1 bg-green-500/20 text-green-400 border border-green-500/10 rounded-lg">
                                24/7 ACTIVE
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleAttachToRecord(provider, "PROVIDER")
                          }
                          className="p-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-2xl transition-all shadow-lg shadow-blue-900/10"
                          title="Attach to Case"
                        >
                          <Link2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-2 mb-5 text-[11px] text-slate-400 relative z-10 opacity-80">
                        <div className="flex gap-2 flex-wrap">
                          {(provider.capabilities ?? []).map((c) => (
                            <span
                              key={c}
                              className="px-2.5 py-1 bg-white/[0.05] rounded-xl border border-white/5 text-[11px] font-black uppercase tracking-widest"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="flex items-center gap-1.5 font-bold uppercase tracking-tight">
                          <MapPin className="w-4 h-4 text-slate-600" />{" "}
                          {provider.coverage?.regions?.join(", ") ||
                            "Global Network"}
                        </p>
                      </div>
                      <div className="flex gap-2 relative z-10">
                        <button
                          onClick={() => {
                            setInteractionState("ACTIVE");
                            setSelectedTab("messaging");
                            showSuccessMessage(
                              `Directing Link to ${provider.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Phone className="w-3 h-3 text-blue-400" /> Call
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("messaging");
                            showSuccessMessage(
                              `Opening Liaison Thread for ${provider.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-3 h-3 text-blue-400" />{" "}
                          Chat
                        </button>
                      </div>
                    </div>
                  ))}

              {directoryTab === "RECORDS" && (
                <div className="space-y-4">
                  {recordResults.length > 0 ? (
                    recordResults.map((res) => (
                      <div
                        key={`${res.type}-${res.id}`}
                        className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all group relative overflow-hidden flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 text-blue-500">
                            {res.type === "LOAD" ? (
                              <Truck className="w-5 h-5" />
                            ) : res.type === "DRIVER" ? (
                              <UserIcon className="w-5 h-5" />
                            ) : (
                              <Activity className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-[13px] font-black text-white uppercase tracking-tight">
                              {res.label}
                            </h4>
                            <p className="text-[11px] font-bold text-slate-500 uppercase">
                              {res.subLabel}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleAttachToRecord(res, res.type as EntityType)
                          }
                          className="p-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-2xl transition-all shadow-lg"
                          title="Attach to Context"
                        >
                          <Link2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50 pt-10">
                      <Search className="w-12 h-12 text-slate-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                        Search for Loads, Drivers, or Incidents <br /> to Link
                        to the Current Flow
                      </p>
                    </div>
                  )}
                </div>
              )}

              {directoryTab === "PREFERRED" && (
                <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50 grayscale pt-10">
                  <Star className="w-12 h-12 text-yellow-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    No Preferred Vendors Flagged
                  </p>
                </div>
              )}

              {directoryTab === "CONTACTS" &&
                allContacts.filter(
                  (c) =>
                    !directorySearchQuery ||
                    (c.name ?? "")
                      .toLowerCase()
                      .includes(directorySearchQuery.toLowerCase()),
                ).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                    <Users className="w-12 h-12 text-slate-500/30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {directorySearchQuery
                        ? "No contacts match your search"
                        : "No contacts in directory"}
                    </p>
                    <p className="text-[11px] text-slate-600 font-bold uppercase leading-relaxed">
                      {directorySearchQuery
                        ? "Try a different search term"
                        : "Add contacts from the Network portal"}
                    </p>
                  </div>
                )}

              {directoryTab === "CONTACTS" &&
                allContacts
                  .filter(
                    (c) =>
                      !directorySearchQuery ||
                      (c.name ?? "")
                        .toLowerCase()
                        .includes(directorySearchQuery.toLowerCase()),
                  )
                  .map((contact) => (
                    <div
                      key={contact.id}
                      className="p-6 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 transition-all"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">
                            {(contact.name ?? "?").charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase">
                              {contact.name}
                            </h4>
                            <p className="text-[11px] font-bold text-slate-500 uppercase">
                              {contact.type} • {contact.title || "No Title"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleAttachToRecord(contact, "CONTACT")
                          }
                          className="p-2 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-xl transition-all"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setInteractionState("ACTIVE");
                            setSelectedTab("messaging");
                            showSuccessMessage(
                              `Directing Link to ${contact.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all border border-white/5"
                        >
                          Call
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("messaging");
                            showSuccessMessage(
                              `Opening SMS Channel for ${contact.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all border border-white/5"
                        >
                          SMS
                        </button>
                      </div>
                    </div>
                  ))}

              {directoryTab === "IMPORT" && (
                <div className="flex flex-col items-center justify-center h-full space-y-8 p-10 text-center">
                  <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center">
                    <Workflow className="w-10 h-10 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase mb-2">
                      Bulk Import Directory
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Standardize your operational network by importing
                      Providers and Contacts via CSV payload.
                    </p>
                  </div>
                  <label className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest cursor-pointer hover:bg-blue-500 transition-all flex items-center justify-center gap-3">
                    <FileText className="w-5 h-5" /> Select CSV Data
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv"
                      onChange={() =>
                        showSuccessMessage(
                          "Import Simulated: 42 Contacts created",
                        )
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
