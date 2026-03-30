import React from "react";
import {
  Phone,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Activity,
  CreditCard,
  ClipboardList,
  Workflow,
  Truck,
} from "lucide-react";
import type { CallSession } from "../../types";

interface TriageWorkspacePanelProps {
  triageQueues: {
    calls: any[];
    incidents: any[];
    workItems: any[];
    requests: any[];
    atRiskLoads: any[];
    tasks: any[];
  };
  activeTriageTab: string;
  setActiveTriageTab: (tab: string) => void;
  commSearchQuery: string;
  snoozedIds: Set<string>;
  currentCallSession: any;
  isHighObstruction: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenWorkspace: (type: string, id: string, subTab?: string) => void;
  onInitiateGlobalInbound: () => void;
  onTriageAction: (
    action: "TAKE" | "ASSIGN" | "SNOOZE" | "ESCALATE",
    item: any,
    type: string,
  ) => void;
  onSafetyEscalate?: (load: any) => void;
  onActivateCall?: (call: any) => void;
  setActiveCallSession?: (call: any) => void;
  setOverlayState?: (state: string) => void;
  setSelectedTab?: (tab: string) => void;
  setInteractionState?: (state: string) => void;
}

const TriageItem: React.FC<{
  item: any;
  type: string;
  onClick: () => void | Promise<void>;
  isHighObstruction: boolean;
  currentCallSession: any;
  snoozedIds: Set<string>;
  onTriageAction: (
    action: "TAKE" | "ASSIGN" | "SNOOZE" | "ESCALATE",
    item: any,
    type: string,
  ) => void;
  setActiveCallSession?: (call: any) => void;
  setOverlayState?: (state: string) => void;
  setSelectedTab?: (tab: string) => void;
}> = ({
  item,
  type,
  onClick,
  isHighObstruction,
  currentCallSession,
  snoozedIds,
  onTriageAction,
  setActiveCallSession,
  setOverlayState,
  setSelectedTab,
}) => {
  const isSnoozed = snoozedIds.has(item.id);
  if (isSnoozed) return null;

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase().replace("-", "_");
    switch (s) {
      case "CRITICAL":
      case "BREACHED":
      case "HIGH_RISK":
        return "text-red-500 bg-red-500/10 border-red-500/20";
      case "ACTIVE":
      case "IN_PROGRESS":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "PENDING":
        return "text-orange-400 bg-orange-400/10 border-orange-400/20";
      case "RESOLVED":
      case "CLOSED":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      default:
        return "text-slate-500 bg-slate-500/10 border-white/5";
    }
  };

  const priority =
    item.severity ||
    item.priority ||
    (type === "CALL" ? "Strategic" : "Medium");
  const status = item.status || (type === "CALL" ? "Active" : "Pending");
  const Icon =
    type === "CALL"
      ? Phone
      : type === "INCIDENT"
        ? AlertTriangle
        : type === "WORK_ITEM"
          ? Workflow
          : type === "REQUEST"
            ? CreditCard
            : type === "TASK"
              ? ClipboardList
              : Activity;

  return (
    <div
      onClick={() => {
        onClick();
        if (type === "CALL") {
          setActiveCallSession?.(item);
          setOverlayState?.("floating");
          setSelectedTab?.("messaging");
        }
      }}
      className={`${isHighObstruction ? "p-2.5 rounded-2xl" : "p-4 rounded-[1.75rem]"} border backdrop-blur-xl transition-all cursor-pointer group relative overflow-hidden ${currentCallSession?.id === item.id ? "bg-blue-600/10 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.15)]" : "bg-white/[0.03] border-white/5 hover:border-blue-500/30 hover:bg-white/[0.07] hover:shadow-2xl shadow-xl"}`}
    >
      {item.isAtRisk && (
        <div
          className={`${isHighObstruction ? "w-12 h-12 -top-2 -right-2" : "w-20 h-20 -top-4 -right-4"} absolute bg-red-500/10 blur-2xl rounded-full animate-pulse`}
        />
      )}

      <div
        className={`flex justify-between items-start ${isHighObstruction ? "mb-1.5" : "mb-3"}`}
      >
        <div
          className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] border backdrop-blur-md ${getStatusColor(priority)} ${isHighObstruction ? "scale-90 origin-left" : ""}`}
        >
          {priority}
        </div>
        <div className="flex items-center gap-2">
          {type === "CALL" && (
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          )}
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">
            {new Date(
              item.timestamp || item.reportedAt || item.createdAt || Date.now(),
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <div className={`${isHighObstruction ? "space-y-0.5" : "space-y-1.5"}`}>
        <div
          className={`${isHighObstruction ? "text-[14px]" : "text-[13px]"} font-black text-white uppercase tracking-tight flex items-center justify-between group-hover:text-blue-400 transition-colors`}
        >
          <div className="flex items-center gap-2.5 max-w-[85%]">
            <Icon
              className={`${isHighObstruction ? "w-3.5 h-3.5" : "w-4 h-4"} ${type === "INCIDENT" ? "text-red-500" : "text-blue-400"} opacity-80 group-hover:opacity-100`}
            />
            <span className="truncate">
              {item.label ||
                item.title ||
                item.type ||
                item.message ||
                item.loadNumber ||
                item.id ||
                "Unknown"}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
        </div>

        {(item.description || item.notes) && (
          <p
            className={`${isHighObstruction ? "text-[12px] font-black" : "text-[11px] font-bold"} text-slate-400 leading-relaxed line-clamp-1 opacity-70 italic`}
          >
            {item.description || item.notes}
          </p>
        )}

        {type === "CALL" && Array.isArray(item.participants) && (
          <div
            className={`flex -space-x-1 ${isHighObstruction ? "pt-1" : "pt-1.5"}`}
          >
            {item.participants.map((p: any, i: number) => (
              <div
                key={i}
                className="w-5 h-5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-black text-slate-400 shadow-sm backdrop-blur-sm"
              >
                {p.name?.charAt(0) || "?"}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={`${isHighObstruction ? "mt-2 pt-2" : "mt-4 pt-3.5"} border-t border-white/5 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.1em]">
            ID: {item.id ? String(item.id).slice(0, 8) : "---"}
          </span>
          {status && !isHighObstruction && (
            <span
              className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider backdrop-blur-md ${getStatusColor(status)}`}
            >
              {status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(type === "INCIDENT" || type === "WORK_ITEM") && (
            <div className="flex gap-1 mr-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTriageAction("TAKE", item, type);
                }}
                className={`${isHighObstruction ? "px-2 py-1 text-[8px]" : "px-2.5 py-1.5 text-[9px]"} bg-blue-600/90 hover:bg-blue-500 font-black text-white rounded-xl uppercase transition-all shadow-lg shadow-blue-900/20 active:scale-95`}
              >
                Take
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTriageAction("ESCALATE", item, type);
                }}
                className={`${isHighObstruction ? "p-1" : "p-1.5"} bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/10`}
                title="Escalate Critical"
              >
                <ShieldAlert
                  className={`${isHighObstruction ? "w-3 h-3" : "w-3.5 h-3.5"}`}
                />
              </button>
            </div>
          )}
          {!isHighObstruction && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTriageAction("SNOOZE", item, type);
              }}
              className="p-1.5 hover:bg-white/10 rounded-xl text-slate-600 hover:text-white transition-all active:scale-90"
              title="Snooze"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const TriageWorkspacePanel: React.FC<TriageWorkspacePanelProps> = ({
  triageQueues,
  activeTriageTab,
  setActiveTriageTab,
  commSearchQuery,
  snoozedIds,
  currentCallSession,
  isHighObstruction,
  isCollapsed,
  onToggleCollapse,
  onOpenWorkspace,
  onInitiateGlobalInbound,
  onTriageAction,
  onSafetyEscalate,
  setActiveCallSession,
  setOverlayState,
  setSelectedTab,
  setInteractionState,
}) => {
  return (
    <aside
      className={`absolute right-0 top-0 bottom-0 z-[100] ${isCollapsed ? "w-16" : "w-96"} border-l border-white/5 flex flex-col bg-[#05070a] transition-all duration-300 group/right shadow-2xl overflow-hidden`}
    >
      <button
        onClick={onToggleCollapse}
        className="absolute left-4 top-14 z-30 w-8 h-8 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-xl"
      >
        {isCollapsed ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      <div
        className={`flex-1 flex flex-col overflow-hidden ${isCollapsed ? "items-center pt-20" : ""}`}
      >
        {!isCollapsed ? (
          <>
            <div className="h-[42%] flex flex-col border-b border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5 bg-white/[0.03] backdrop-blur-lg space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-60">
                      Strategic Voice Queue
                    </h2>
                    <div className="flex gap-2 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                        {triageQueues.calls.length +
                          triageQueues.incidents.length}{" "}
                        ACTIVE
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onInitiateGlobalInbound}
                    aria-label="Initiate global inbound"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-[9px] font-black text-white uppercase rounded-lg shadow-lg shadow-blue-900/40 flex items-center gap-2 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {/* Consolidated search to header only */}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {triageQueues.calls
                  .filter((c) => !snoozedIds.has(c.id))
                  .filter(
                    (c) =>
                      !commSearchQuery ||
                      c.id
                        .toLowerCase()
                        .includes(commSearchQuery.toLowerCase()) ||
                      (c.participants ?? []).some((p: any) =>
                        p.name
                          .toLowerCase()
                          .includes(commSearchQuery.toLowerCase()),
                      ),
                  )
                  .map((call) => (
                    <TriageItem
                      key={call.id}
                      item={call}
                      type="CALL"
                      isHighObstruction={isHighObstruction}
                      currentCallSession={currentCallSession}
                      snoozedIds={snoozedIds}
                      onTriageAction={onTriageAction}
                      setActiveCallSession={setActiveCallSession}
                      setOverlayState={setOverlayState}
                      setSelectedTab={setSelectedTab}
                      onClick={() => {
                        const primary = call.links?.find(
                          (l: any) => l.isPrimary,
                        );
                        if (primary)
                          onOpenWorkspace(
                            primary.entityType,
                            primary.entityId,
                            "TIMELINE",
                          );
                        else setInteractionState?.("ACTIVE");
                      }}
                    />
                  ))}
                {triageQueues.incidents
                  .filter((i) => !snoozedIds.has(i.id))
                  .filter(
                    (i) =>
                      !commSearchQuery ||
                      i.id
                        .toLowerCase()
                        .includes(commSearchQuery.toLowerCase()) ||
                      i.type
                        .toLowerCase()
                        .includes(commSearchQuery.toLowerCase()),
                  )
                  .map((inc) => (
                    <TriageItem
                      key={inc.id}
                      item={inc}
                      type="INCIDENT"
                      isHighObstruction={isHighObstruction}
                      currentCallSession={currentCallSession}
                      snoozedIds={snoozedIds}
                      onTriageAction={onTriageAction}
                      setActiveCallSession={setActiveCallSession}
                      setOverlayState={setOverlayState}
                      setSelectedTab={setSelectedTab}
                      onClick={() => onOpenWorkspace("INCIDENT", inc.id)}
                    />
                  ))}
                {triageQueues.calls.length === 0 &&
                  triageQueues.incidents.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
                      <Phone className="w-10 h-10 mb-2" />
                      <span className="text-[10px] font-black uppercase">
                        No Active Inbound
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {/* PERSISTENT TRIAGE TABS */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
              <div className="flex border-b border-white/5">
                {[
                  {
                    id: "CRISIS",
                    label: "Strategic Triage",
                    count:
                      triageQueues.incidents.filter(
                        (i) => !snoozedIds.has(i.id),
                      ).length +
                      triageQueues.workItems.filter(
                        (wi) =>
                          !snoozedIds.has(wi.id) && wi.priority === "Critical",
                      ).length,
                  },
                  {
                    id: "SUPPORT",
                    label: "Operational Support",
                    count:
                      triageQueues.requests.filter((r) => !snoozedIds.has(r.id))
                        .length +
                      triageQueues.workItems.filter(
                        (wi) =>
                          !snoozedIds.has(wi.id) && wi.priority !== "Critical",
                      ).length,
                  },
                  {
                    id: "ASSETS",
                    label: "Asset Intake",
                    count:
                      triageQueues.atRiskLoads.filter(
                        (l) => !snoozedIds.has(l.id),
                      ).length +
                      triageQueues.tasks.filter((t) => !snoozedIds.has(t.id))
                        .length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTriageTab(tab.id)}
                    className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest transition-all relative ${activeTriageTab === tab.id ? "text-blue-500 bg-white/5" : "text-slate-600 hover:text-slate-400"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {activeTriageTab === "CRISIS" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {triageQueues.incidents
                      .filter((i) => !snoozedIds.has(i.id))
                      .map((inc) => (
                        <TriageItem
                          key={inc.id}
                          item={inc}
                          type="INCIDENT"
                          isHighObstruction={isHighObstruction}
                          currentCallSession={currentCallSession}
                          snoozedIds={snoozedIds}
                          onTriageAction={onTriageAction}
                          setActiveCallSession={setActiveCallSession}
                          setOverlayState={setOverlayState}
                          setSelectedTab={setSelectedTab}
                          onClick={() =>
                            onOpenWorkspace("INCIDENT", inc.id, "TIMELINE")
                          }
                        />
                      ))}
                    {triageQueues.workItems
                      .filter((wi) => !snoozedIds.has(wi.id))
                      .filter((wi) => wi.priority === "Critical")
                      .map((wi) => (
                        <TriageItem
                          key={wi.id}
                          item={wi}
                          type="WORK_ITEM"
                          isHighObstruction={isHighObstruction}
                          currentCallSession={currentCallSession}
                          snoozedIds={snoozedIds}
                          onTriageAction={onTriageAction}
                          setActiveCallSession={setActiveCallSession}
                          setOverlayState={setOverlayState}
                          setSelectedTab={setSelectedTab}
                          onClick={() =>
                            onOpenWorkspace(
                              wi.entityType,
                              wi.entityId,
                              wi.type.includes("Detention")
                                ? "DETENTION"
                                : "TIMELINE",
                            )
                          }
                        />
                      ))}
                    {triageQueues.incidents.filter((i) => !snoozedIds.has(i.id))
                      .length === 0 &&
                      triageQueues.workItems.filter(
                        (wi) =>
                          !snoozedIds.has(wi.id) && wi.priority === "Critical",
                      ).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                          <CheckCircle className="w-10 h-10 text-emerald-500/30" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            No crisis incidents to triage
                          </p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase">
                            Your operations are running smoothly
                          </p>
                        </div>
                      )}
                  </div>
                )}
                {activeTriageTab === "SUPPORT" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {triageQueues.requests
                      .filter((req) => !snoozedIds.has(req.id))
                      .map((req) => (
                        <TriageItem
                          key={req.id}
                          item={req}
                          type="REQUEST"
                          isHighObstruction={isHighObstruction}
                          currentCallSession={currentCallSession}
                          snoozedIds={snoozedIds}
                          onTriageAction={onTriageAction}
                          setActiveCallSession={setActiveCallSession}
                          setOverlayState={setOverlayState}
                          setSelectedTab={setSelectedTab}
                          onClick={() =>
                            onOpenWorkspace("LOAD", req.loadId!, "FINANCE")
                          }
                        />
                      ))}
                    {triageQueues.workItems
                      .filter((wi) => !snoozedIds.has(wi.id))
                      .filter((wi) => wi.priority !== "Critical")
                      .map((wi) => (
                        <TriageItem
                          key={wi.id}
                          item={wi}
                          type="WORK_ITEM"
                          isHighObstruction={isHighObstruction}
                          currentCallSession={currentCallSession}
                          snoozedIds={snoozedIds}
                          onTriageAction={onTriageAction}
                          setActiveCallSession={setActiveCallSession}
                          setOverlayState={setOverlayState}
                          setSelectedTab={setSelectedTab}
                          onClick={() =>
                            onOpenWorkspace(
                              wi.entityType,
                              wi.entityId,
                              wi.type.includes("Detention")
                                ? "DETENTION"
                                : "TIMELINE",
                            )
                          }
                        />
                      ))}
                    {triageQueues.requests.filter((r) => !snoozedIds.has(r.id))
                      .length === 0 &&
                      triageQueues.workItems.filter(
                        (wi) =>
                          !snoozedIds.has(wi.id) && wi.priority !== "Critical",
                      ).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                          <ClipboardList className="w-10 h-10 text-slate-500/30" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            No open work items
                          </p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase">
                            Pending requests and tasks will appear here
                          </p>
                        </div>
                      )}
                  </div>
                )}
                {activeTriageTab === "ASSETS" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    <div className="px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl mb-4">
                      <p className="text-[9px] font-bold text-blue-400 uppercase leading-relaxed">
                        Monitor asset intake for safety/compliance risks.
                        Escalate at-risk loads to Strategic Triage.
                      </p>
                    </div>
                    {triageQueues.atRiskLoads
                      .filter((l) => !snoozedIds.has(l.id))
                      .map((load) => (
                        <div key={load.id} className="relative group">
                          <TriageItem
                            item={load}
                            type="LOAD"
                            isHighObstruction={isHighObstruction}
                            currentCallSession={currentCallSession}
                            snoozedIds={snoozedIds}
                            onTriageAction={onTriageAction}
                            setActiveCallSession={setActiveCallSession}
                            setOverlayState={setOverlayState}
                            setSelectedTab={setSelectedTab}
                            onClick={() =>
                              onOpenWorkspace("LOAD", load.id, "TIMELINE")
                            }
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSafetyEscalate?.(load);
                            }}
                            className="absolute top-4 right-4 p-2 bg-red-600/20 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white"
                            title="Escalate to Safety"
                          >
                            <ShieldAlert className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    {triageQueues.tasks
                      .filter((t) => !snoozedIds.has(t.id))
                      .map((task) => (
                        <TriageItem
                          key={task.id}
                          item={task}
                          type="TASK"
                          isHighObstruction={isHighObstruction}
                          currentCallSession={currentCallSession}
                          snoozedIds={snoozedIds}
                          onTriageAction={onTriageAction}
                          setActiveCallSession={setActiveCallSession}
                          setOverlayState={setOverlayState}
                          setSelectedTab={setSelectedTab}
                          onClick={() =>
                            onOpenWorkspace("LOAD", task.loadId, "TIMELINE")
                          }
                        />
                      ))}
                    {triageQueues.atRiskLoads.filter(
                      (l) => !snoozedIds.has(l.id),
                    ).length === 0 &&
                      triageQueues.tasks.filter((t) => !snoozedIds.has(t.id))
                        .length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                          <Truck className="w-10 h-10 text-slate-500/30" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            No at-risk assets
                          </p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase">
                            All assets are operating within normal parameters
                          </p>
                        </div>
                      )}
                  </div>
                )}

                <div className="pt-10 pb-20 text-center opacity-20">
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-8 opacity-40 pt-10">
            <Activity className="w-5 h-5 text-white" />
            <Phone className="w-5 h-5 text-white" />
            <AlertTriangle className="w-5 h-5 text-white" />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
};
