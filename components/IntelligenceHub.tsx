import React, { useState, useEffect, useMemo } from "react";
import { usePollingEffect } from "../services/usePollingEffect";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import {
  PhoneCall,
  Brain,
  Zap,
  Search,
  AlertTriangle,
  ClipboardList,
  Phone,
  Truck,
  Activity,
  ChevronRight,
  User as UserIcon,
  X,
  MessageSquare,
  DollarSign,
  CheckCircle,
  RefreshCw,
  Wrench,
  Share2,
  FileText,
  BarChart3,
  ShieldAlert,
  Lock,
  Bell,
  MapPin,
} from "lucide-react";
import { api } from "../services/api";
import { v4 as uuidv4 } from "uuid";
import { getExceptions, getDashboardCards } from "../services/exceptionService";
import { Exception, DashboardCard } from "../types";
import { OperationalMessaging } from "./OperationalMessaging";
import { CommandCenterView } from "./CommandCenterView";
import { LoadDetailView } from "./LoadDetailView";
// mockDataService removed — all mock seeding eliminated per T5-09
import {
  globalSearch,
  getRecord360Data,
  getIncidents,
  getRequests,
  getTriageQueues,
  initiateRepowerWorkflow,
  getWorkItems,
  saveWorkItem,
  saveCallSession,
  saveRequest,
  saveIncident,
  getProviders,
  getContacts,
  saveServiceTicket,
  saveNotificationJob,
  saveTask,
  saveIncidentAction,
  saveIncidentCharge,
} from "../services/storageService";
import { getVendors } from "../services/safetyService";
import { ExceptionConsole } from "./ExceptionConsole";
import { NetworkPortal } from "./NetworkPortal";
import { QuoteManager } from "./QuoteManager";
import {
  GlobalSearchResult,
  EntityType,
  Incident,
  KCIRequest,
  WorkspaceSession,
  ContextRecord,
  RequestType,
  CallSession,
  CallSessionStatus,
  OperationalEvent,
  LoadData,
  User,
  Broker,
  Provider,
  Contact,
  WorkItem,
  Company as CompanyType,
} from "../types";
import { DispatchIntelligence } from "../services/dispatchIntelligence";
import { features } from "../config/features";
import { Toast } from "./Toast";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { InputDialog } from "./ui/InputDialog";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./EmptyState";
import { OpsDashboardPanel } from "./operations/OpsDashboardPanel";
import { OperationalFormsOverlay } from "./operations/OperationalFormsOverlay";
import { RepowerSelectionPanel } from "./operations/RepowerSelectionPanel";
import { TriageWorkspacePanel } from "./operations/TriageWorkspacePanel";
import { ActionGroup } from "./operations/WorkspacePrimitives";
import { useCrisisHandlers } from "./operations/useCrisisHandlers";

interface Thread {
  id: string;
  primaryContext: { label: string };
  lastTouch: string;
  summary: string;
  ownerName: string;
  ownerId: string;
  isAtRisk?: boolean;
  handedOffFrom?: string;
}

const IntelligenceHub: React.FC<{
  show?: boolean;
  user: User;
  loads: LoadData[];
  activeLoad?: LoadData;
  incidents?: Incident[];
  users?: User[];
  brokers?: Broker[];
  currentLoadId?: string;
  initialTab?: string;
  showInitialCallForm?: boolean;
  initialShowCallForm?: boolean;
  activeCallSession?: CallSession | null;
  initialCallSession?: CallSession | null;
  initialOverlayState?: "floating" | "docked" | "collapsed";
  setActiveCallSession?: (s: CallSession | null) => void;
  setOverlayState?: (s: "floating" | "docked" | "collapsed") => void;
  onClose?: () => void;
  onRecordAction: (e: OperationalEvent) => Promise<void>;
  onNavigate?: (tab: string, context?: any) => void;
  session: WorkspaceSession;
  setSession: (
    s: WorkspaceSession | ((prev: WorkspaceSession) => WorkspaceSession),
  ) => void;
  summary?: any;
  setSummary?: (s: any) => void;
  openRecordWorkspace: (
    type: EntityType,
    id: string,
    subTab?: string,
  ) => Promise<void>;
  company?: CompanyType;
  onCloseContext: () => void;
  onLinkSessionToRecord: (
    sessionId: string,
    recordId: string,
    recordType: EntityType,
  ) => Promise<void>;
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}> = (props) => {
  const {
    user,
    company,
    loads = [],
    activeLoad,
    incidents = [],
    users: propUsers = [],
    brokers = [],
    initialTab,
    showInitialCallForm,
    activeCallSession,
    setActiveCallSession,
    setOverlayState,
    onClose,
    onRecordAction,
    onNavigate,
    session,
    setSession,
    summary,
    setSummary,
    openRecordWorkspace,
    onCloseContext,
    onLinkSessionToRecord,
  } = props;
  const [selectedTab, setSelectedTab] = useState(initialTab || "command");

  // Sync selectedTab with initialTab when navigation occurs
  useEffect(() => {
    if (initialTab && initialTab !== selectedTab) {
      setSelectedTab(initialTab);
    }
  }, [initialTab]);

  const activeRecord = session.primaryContext;
  const [active360Tab, setActive360Tab] = useState<string>(
    activeRecord?.activeSubTab || "TIMELINE",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    activeLoad?.id || null,
  );

  // === INTELLIGENCE HUB LIVE DATA STATE ===
  const [brokerRisk, setBrokerRisk] = useState<any[]>([]);
  const [missedRevenue, setMissedRevenue] = useState<any[]>([]);
  const [facilityQuery, setFacilityQuery] = useState("");
  const [facilityResults, setFacilityResults] = useState<any[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);

  useEffect(() => {
    if (selectedTab !== "intelligence") return;
    setIntelLoading(true);
    Promise.all([
      api.get(`/intelligence/broker-risk`),
      api.get(`/intelligence/missed-revenue`),
    ])
      .then(([risk, missed]) => {
        setBrokerRisk((risk as any[]) || []);
        setMissedRevenue((missed as any[]) || []);
      })
      .catch(console.error)
      .finally(() => setIntelLoading(false));
  }, [selectedTab]);

  const handleFacilitySearch = async () => {
    if (!facilityQuery.trim()) return;
    setIntelLoading(true);
    try {
      const results = await api.get(
        `/intelligence/facility-index?facility=${encodeURIComponent(facilityQuery)}`,
      );
      setFacilityResults((results as any[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIntelLoading(false);
    }
  };

  // === OPS DASHBOARD STATE (migrated from Dashboard.tsx) ===
  const [opsExceptions, setOpsExceptions] = useState<Exception[]>([]);
  const [opsCards, setOpsCards] = useState<DashboardCard[]>([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState<string | null>(null);

  const loadOpsDashboardData = async (signal?: AbortSignal) => {
    setOpsError(null);
    setOpsLoading(true);
    try {
      const [exs, cardDefs] = await Promise.all([
        getExceptions({ status_not_in: "RESOLVED,CLOSED" }),
        getDashboardCards(),
      ]);
      if (signal?.aborted) return;
      setOpsExceptions(exs);
      setOpsCards(cardDefs);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (signal?.aborted) return;
      setOpsError("Unable to load operations data. Please retry.");
    } finally {
      if (!signal?.aborted) {
        setOpsLoading(false);
      }
    }
  };

  usePollingEffect((signal) => loadOpsDashboardData(signal), 10000, []);

  // Ops Dashboard computed stats
  // Intelligent Space Detection
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(
    window.innerWidth < 1600,
  );
  const [rightRailCollapsed, setRightRailCollapsed] = useState(
    window.innerWidth < 1440,
  );
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(320);

  const obstructionLevel = useMemo(() => {
    let occupiedWidth = 0;
    if (!leftRailCollapsed) occupiedWidth += leftWidth;
    if (!rightRailCollapsed) occupiedWidth += rightWidth;

    // Detail drawer in CommandCenterView
    if (session.primaryContext) {
      if (windowWidth < 1440) occupiedWidth += 360;
      else if (windowWidth < 1600) occupiedWidth += 420;
      else occupiedWidth += 480;
    }

    const ratio = occupiedWidth / windowWidth;
    if (ratio > 0.75) return "CRITICAL";
    if (ratio > 0.5) return "HIGH";
    if (ratio > 0.25) return "MODERATE";
    return "NOMINAL";
  }, [
    leftRailCollapsed,
    rightRailCollapsed,
    leftWidth,
    rightWidth,
    session.primaryContext,
    windowWidth,
  ]);

  const isHighObstruction =
    obstructionLevel === "HIGH" || obstructionLevel === "CRITICAL";

  const threads = useMemo(() => {
    const activeLoadThreads = (loads || [])
      .filter((l) => l.status === "in_transit" || l.isActionRequired)
      .map((l) => ({
        id: l.id,
        primaryContext: { label: `Load #${l.loadNumber || "---"}` },
        lastTouch: new Date(l.createdAt || Date.now()).toISOString(),
        summary: l.actionSummary || `Status: ${l.status || "Unknown"}`,
        ownerName: "Dispatch",
        ownerId: "system",
        isAtRisk: l.isActionRequired || false,
      }));

    const incidentThreads = incidents
      .filter((inc) => inc.status === "Open")
      .map((inc) => ({
        id: `inc-${inc.id}`,
        primaryContext: { label: `INCIDENT: ${inc.type}` },
        lastTouch: inc.reportedAt,
        summary: inc.description,
        ownerName: "Safety",
        ownerId: "safety",
        isAtRisk: true,
      }));

    return [...activeLoadThreads, ...incidentThreads].sort((a, b) => {
      const timeA = new Date(a.lastTouch || 0).getTime();
      const timeB = new Date(b.lastTouch || 0).getTime();
      if (isNaN(timeA) || isNaN(timeB)) return 0;
      return timeB - timeA;
    });
  }, [loads, incidents]);

  const unifiedEvents = useMemo(() => {
    const events: OperationalEvent[] = [];
    if (!session.primaryContext) {
      (loads || []).forEach((load) => {
        events.push({
          id: `load-${load.id}`,
          type: "SYSTEM",
          timestamp: load.pickupDate || new Date().toISOString(),
          actorId: "system",
          actorName: "Core Dispatch",
          message: `Load #${load.loadNumber} (${load.status}) active in system.`,
          loadId: load.id,
        });
      });
    }
    if (session.primaryContext?.data) {
      const data = session.primaryContext.data;
      (data.requests || []).forEach((req: any) => {
        events.push({
          id: req.id,
          type: "REQUEST",
          timestamp: req.createdAt,
          actorId: req.createdBy,
          actorName: req.createdBy,
          message: `${req.type || "System"} Request: ${req.requestedAmount ? "$" + req.requestedAmount : ""} - ${req.status || "NEW"}`,
          payload: req,
          loadId: req.loadId,
          isActionRequired: ["NEW", "PENDING_APPROVAL"].includes(req.status),
        });
      });
      (data.calls || []).forEach((call: any) => {
        events.push({
          id: call.id,
          type: "CALL_LOG",
          timestamp: call.startTime,
          actorId: call.recordedBy,
          actorName: call.recordedBy,
          message: `Comm Cycle: ${call.notes || "No description available."}`,
          payload: call,
          loadId: data.load?.id,
        });
      });
      (data.incidents || []).forEach((inc: any) => {
        events.push({
          id: inc.id,
          type: "INCIDENT",
          timestamp: inc.reportedAt,
          actorId: "safety-bot",
          actorName: "Safety Control",
          message: `CRITICAL: ${inc.type} incident - ${inc.severity}`,
          payload: inc,
          loadId: inc.loadId,
          isActionRequired: inc.status === "Open",
        });
      });
      (data.messages || []).forEach((msg: any) => {
        events.push({
          id: msg.id,
          type: "MESSAGE",
          timestamp: msg.timestamp,
          actorId: msg.senderId,
          actorName: msg.senderName,
          message: msg.text,
          payload: msg,
          loadId: msg.loadId,
        });
      });
      // 5. Add Telemetry/Pings
      if (data.load?.telemetry) {
        data.load.telemetry.forEach((ping: any, idx: number) => {
          events.push({
            id: `ping-${idx}`,
            type: "TELEMETRY",
            timestamp: ping.timestamp,
            actorId: "gps-unit",
            actorName: "IoT Gateway",
            message: `Telemetry Ping: ${ping.event || "LOCATION_UPDATE"} - Lat: ${ping.lat}, Lng: ${ping.lng}`,
            payload: ping,
            loadId: data.load.id,
          });
        });
      }
    }
    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [loads, incidents, session.primaryContext]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      // Proactive space management: If user resizes to very small, ensure rails collapse
      if (window.innerWidth < 1200) {
        setLeftRailCollapsed(true);
        setRightRailCollapsed(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showCallLogForm, setShowCallLogForm] = useState(false);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [successMessage, showSuccessMessage, clearSuccessMessage] =
    useAutoFeedback<string | null>(null);
  const [activeTimelineFilter, setActiveTimelineFilter] = useState<
    | "ALL"
    | "MESSAGE"
    | "CALL_LOG"
    | "INCIDENT"
    | "ISSUE"
    | "TASK"
    | "REQUEST"
    | "TELEMETRY"
  >("ALL");
  const [showRepowerPanel, setShowRepowerPanel] = useState(false);
  const [repowerLoadId, setRepowerLoadId] = useState<string | null>(null);
  const [repowerMatches, setRepowerMatches] = useState<any[]>([]);
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);
  const [showLoadDetail, setShowLoadDetail] = useState(false);
  const [selectedLoadForDetail, setSelectedLoadForDetail] =
    useState<LoadData | null>(null);

  const handleRepower = async (loadId?: string) => {
    const targetId =
      loadId || (activeRecord?.type === "LOAD" ? activeRecord.id : undefined);
    if (!targetId) return;

    setRepowerLoadId(targetId);
    setShowRepowerPanel(true);
    setIsSearchingMatches(true);

    const load = loads.find((l) => l.id === targetId);
    if (load) {
      const matches = await DispatchIntelligence.getBestMatches(
        load,
        propUsers,
      );
      setRepowerMatches(matches);
    }
    setIsSearchingMatches(false);
  };

  const executeRepowerHandoff = async (
    driverId: string,
    driverName: string,
  ) => {
    if (!repowerLoadId) return;

    const load = loads.find((l) => l.id === repowerLoadId);
    if (!load) return;

    await initiateRepowerWorkflow(
      repowerLoadId,
      user,
      `Repowered to ${driverName} via strategic handoff protocol`,
    );

    await handleActionLogging({
      id: uuidv4(),
      type: "CALL_LOG",
      timestamp: new Date().toISOString(),
      message: `REPOWER COMPLETED: Load #${load.loadNumber} handed off to ${driverName}`,
      actorId: user.id,
      actorName: user.name,
      loadId: load.id,
      payload: {
        category: "Dispatch",
        action: "RepowerHandoff",
        newDriverId: driverId,
      },
    });

    // KCI Requirement: Notify Shipper/Receiver ASAP
    if (load.notificationEmails && load.notificationEmails.length > 0) {
      const msg = `UPDATE: Load #${load.loadNumber} has been repowered to Driver ${driverName}. Estimated arrival updated. We apologize for the delay.`;

      // Trigger automated notification (system-to-customer)
      await automatedStakeholderNotify(load.id, load.notificationEmails, msg);
    }

    setShowRepowerPanel(false);
    showSuccessMessage(
      `Repower Handoff successful: ${driverName} is now assigned. Stakeholders notified.`,
    );

    // Refresh queues
    const queues = await getTriageQueues();
    setTriageQueues(queues);
  };

  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [commQueue, setCommQueue] = useState<CallSession[]>([]);

  // 360 Search State
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [requestData, setRequestData] = useState({
    id: `REQ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    type: "DETENTION" as RequestType,
    amount: 0,
    priority: "NORMAL" as "NORMAL" | "HIGH",
    requiresDocs: false,
    notes: "",
    attachedRecord: null as {
      id: string;
      type: EntityType;
      label?: string;
    } | null,
  });
  const [globalOpenRequestsCount, setGlobalOpenRequestsCount] = useState(0);
  const [isAutoPilotEnabled, setIsAutoPilotEnabled] = useState(false);
  const [attachmentSearchQuery, setAttachmentSearchQuery] = useState("");
  const [attachmentResults, setAttachmentResults] = useState<
    GlobalSearchResult[]
  >([]);
  const [isSearchingAttachment, setIsSearchingAttachment] = useState(false);
  // Dialog state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [inputDialogState, setInputDialogState] = useState<{
    open: boolean;
    title: string;
    message: string;
    resolve?: (v: string | null) => void;
  }>({ open: false, title: "", message: "" });
  const [confirmDialogState, setConfirmDialogState] = useState<{
    open: boolean;
    title: string;
    message: string;
    resolve?: (v: boolean) => void;
  }>({ open: false, title: "", message: "" });

  const showInputDialog = (title: string, message: string) =>
    new Promise<string | null>((resolve) =>
      setInputDialogState({ open: true, title, message, resolve }),
    );

  const showConfirmDialog = (title: string, message: string) =>
    new Promise<boolean>((resolve) =>
      setConfirmDialogState({ open: true, title, message, resolve }),
    );

  // Interaction State Engine
  const [interactionState, setInteractionState] = useState<
    "IDLE" | "ACTIVE" | "WRAP-UP"
  >(
    activeCallSession?.status === "ACTIVE"
      ? "ACTIVE"
      : activeCallSession?.status === "COMPLETED"
        ? "WRAP-UP"
        : "IDLE",
  );
  const [currentCallSession, setCurrentCallSession] =
    useState<CallSession | null>(activeCallSession || null);
  const [commSearchQuery, setCommSearchQuery] = useState("");

  // Sync from prop
  useEffect(() => {
    if (activeCallSession && activeCallSession.id !== currentCallSession?.id) {
      setCurrentCallSession(activeCallSession);
      setInteractionState(
        activeCallSession.status === "COMPLETED" ? "WRAP-UP" : "ACTIVE",
      );
    } else if (!activeCallSession && currentCallSession) {
      setCurrentCallSession(null);
      setInteractionState("IDLE");
    }
  }, [activeCallSession]);

  const startInteraction = async () => {
    const newSession: CallSession = {
      id: `CALL-${uuidv4().slice(0, 8).toUpperCase()}`,
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      participants: [],
      lastActivityAt: new Date().toISOString(),
      links: session.primaryContext
        ? [
            {
              id: uuidv4(),
              entityType: session.primaryContext.type,
              entityId: session.primaryContext.id,
              isPrimary: true,
              createdAt: new Date().toISOString(),
              createdBy: user.name,
            },
          ]
        : [],
    };
    setCurrentCallSession(newSession);
    setInteractionState("ACTIVE");
    if (setActiveCallSession) setActiveCallSession(newSession);

    // Appear in queue within 1s
    await saveCallSession(newSession);
    const queues = await getTriageQueues();
    setTriageQueues((prev) => ({ ...prev, calls: [...queues.calls] }));

    showSuccessMessage(`Interaction Started: ${newSession.id}`);
  };

  const wrapUpInteraction = async () => {
    const sessionToWrap = currentCallSession || activeCallSession;
    if (!sessionToWrap) return;

    const callNotes = await showInputDialog(
      "Call Wrap-Up",
      "Enter summary of call for the permanent record:",
    );
    if (!callNotes) return; // Force notes for audit compliance

    const updatedSession = {
      ...sessionToWrap,
      status: "COMPLETED" as CallSessionStatus,
      endTime: new Date().toISOString(),
      notes: callNotes,
    };
    await saveCallSession(updatedSession);

    // Record the call in the Incident Timeline and Audit Actions if linked
    const primaryLink = sessionToWrap.links.find((l) => l.isPrimary);
    if (primaryLink && primaryLink.entityType === "INCIDENT") {
      // 1. Update In-Memory Incident
      const incidents = await getIncidents();
      const inc = incidents.find((i) => i.id === primaryLink.entityId);
      if (inc) {
        inc.timeline = [
          ...(inc.timeline || []),
          {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            actorName: user.name,
            action: "DRIVER_CONTACT_RECORDED",
            notes: `Call Summary: ${callNotes}`,
          },
        ];
        await saveIncident(inc);
      }

      // 2. Save to Immutable Audit Trail (Backend)
      await saveIncidentAction(primaryLink.entityId, {
        actorName: user.name,
        action: "Recorded Call",
        notes: callNotes,
      });
    }

    setCurrentCallSession(updatedSession);
    setInteractionState("WRAP-UP");
    if (setActiveCallSession) setActiveCallSession(updatedSession);

    showSuccessMessage(
      `Interaction wrapped & audit log created: ${sessionToWrap.id}`,
    );

    // Refresh queues
    fetchQueues();
  };

  const handleActionLogging = async (event: OperationalEvent) => {
    await onRecordAction(event);
    fetchQueues(); // Refresh queues to show changes
    if (activeRecord) {
      const data = await getRecord360Data(activeRecord.type, activeRecord.id);
      setSession((prev) => ({
        ...prev,
        primaryContext: prev.primaryContext
          ? { ...prev.primaryContext, data }
          : null,
      }));
    }

    // If we log a note or message, we treat the interaction as managed
    if (event.type === "CALL_LOG" || event.type === "MESSAGE") {
      setOverlayState("collapsed");
    }
  };

  const handleInteractionNote = async (note: string) => {
    if (!currentCallSession) return;

    const event: OperationalEvent = {
      id: uuidv4(),
      type: "CALL_LOG",
      timestamp: new Date().toISOString(),
      message: note,
      actorId: user.id,
      actorName: user.name,
      loadId:
        activeRecord?.type === "LOAD"
          ? String(activeRecord.id)
          : session.primaryContext?.data?.load?.id ||
            session.primaryContext?.data?.incident?.loadId,
      payload: {
        call_session_id: currentCallSession.id,
        category: "Comm",
        interactionNote: true,
      },
    };

    await handleActionLogging(event);
    showSuccessMessage(
      `Note attached to interaction: ${currentCallSession.id}`,
    );
  };

  const handleCreateRequest = async () => {
    if (!requestData.attachedRecord) {
      showSuccessMessage(
        "ERROR: Strategic Attachment Required to process request.",
        3000,
      );
      return;
    }

    const newRequest: KCIRequest = {
      id: requestData.id,
      type: requestData.type,
      status: "NEW",
      priority: requestData.priority,
      requestedAmount: requestData.amount,
      currency: "USD",
      requiresDocs: requestData.requiresDocs,
      source: "DISPATCH",
      notes: requestData.notes,
      createdAt: new Date().toISOString(),
      requestedAt: new Date().toISOString(),
      createdBy: user.name,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      loadId:
        requestData.attachedRecord.type === "LOAD"
          ? requestData.attachedRecord.id
          : undefined,
      driverId:
        requestData.attachedRecord.type === "DRIVER"
          ? requestData.attachedRecord.id
          : undefined,
      links: [
        {
          id: uuidv4(),
          entityType: requestData.attachedRecord.type,
          entityId: requestData.attachedRecord.id,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          createdBy: user.name,
        },
      ],
      decisionLog: [
        {
          timestamp: new Date().toISOString(),
          actorId: user.id,
          actorName: user.name,
          action: "REQUEST_CREATED",
          beforeState: "NEW",
          afterState: "NEW",
          note: "Request initialized via Intelligence Hub",
        },
      ],
    };

    if (currentCallSession) {
      newRequest.links.push({
        id: uuidv4(),
        entityType: "CALL" as EntityType,
        entityId: currentCallSession.id,
        isPrimary: false,
        createdAt: new Date().toISOString(),
        createdBy: user.name,
      });
    }

    await saveRequest(newRequest);

    await handleActionLogging({
      id: uuidv4(),
      type: "REQUEST",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Created ${requestData.type} Request: ${requestData.id} ($${requestData.amount})`,
      loadId: newRequest.loadId,
      payload: { ...newRequest },
    });

    setShowRequestForm(false);
    showSuccessMessage(`Request Created: ${newRequest.id}`);

    // Refresh queues
    const queues = await getTriageQueues();
    setTriageQueues(queues);
  };

  useEffect(() => {
    const performAttachmentSearch = async () => {
      if (attachmentSearchQuery.length < 2) {
        setAttachmentResults([]);
        return;
      }
      setIsSearchingAttachment(true);
      const results = await globalSearch(attachmentSearchQuery);
      setAttachmentResults(results);
      setIsSearchingAttachment(false);
    };
    const timer = setTimeout(performAttachmentSearch, 300);
    return () => clearTimeout(timer);
  }, [attachmentSearchQuery]);

  const handleAutoAssign = async (load: LoadData) => {
    const matches = await DispatchIntelligence.getBestMatches(load, propUsers);
    const bestMatch = matches.find((m) => m.recommendation === "STRONG_MATCH");

    if (bestMatch) {
      await handleActionLogging({
        id: uuidv4(),
        type: "CALL_LOG",
        timestamp: new Date().toISOString(),
        message: `AI Auto-Assignment: ${bestMatch.driverName} assigned to Load #${load.loadNumber} (Match Score: ${bestMatch.matchScore}%)`,
        actorId: user.id,
        actorName: user.name,
        loadId: load.id,
        payload: {
          category: "Dispatch",
          action: "AutoAssign",
          driverId: bestMatch.driverId,
          score: bestMatch.matchScore,
        },
      });
      showSuccessMessage(
        `Auto-Assigned ${bestMatch.driverName} to Load #${load.loadNumber}`,
      );
    } else {
      showSuccessMessage(
        `No high-confidence match found for Load #${load.loadNumber}`,
      );
    }
  };

  useEffect(() => {
    const fetchGlobalRequests = async () => {
      const reqs = await getRequests();
      setGlobalOpenRequestsCount(
        reqs.filter((r) => ["NEW", "PENDING_APPROVAL"].includes(r.status))
          .length,
      );
    };
    fetchGlobalRequests();
  }, [unifiedEvents]);

  const [showNotifyPicker, setShowNotifyPicker] = useState(false);
  const [notificationContacts, setNotificationContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [notificationMessage, setNotificationMessage] = useState("");

  const [showRoadsideForm, setShowRoadsideForm] = useState(false);
  const [selectedVendorForRoadside, setSelectedVendorForRoadside] =
    useState<any>(null);
  const [roadsideNotes, setRoadsideNotes] = useState("");

  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [active360Data, setActive360Data] = useState<any>(null);

  useEffect(() => {
    if (activeRecord) {
      getRecord360Data(activeRecord.type, activeRecord.id).then((data) => {
        setActive360Data(data);
        if (activeRecord.type === "INCIDENT" && data?.incident?.timeline) {
          const mappedEvents: OperationalEvent[] = data.incident.timeline.map(
            (t: any) => ({
              id: t.id,
              type: "SYSTEM",
              timestamp: t.timestamp,
              message: t.notes || t.action,
              actorId: "system",
              actorName: t.actorName,
            }),
          );
          // unifiedEvents is now a useMemo that extracts from activeRecord.data
        }
      });
    }
  }, [activeRecord]);

  const [triageQueues, setTriageQueues] = useState<{
    requests: KCIRequest[];
    incidents: Incident[];
    tasks: any[];
    calls: CallSession[];
    atRiskLoads: LoadData[];
    workItems: any[];
  }>({
    requests: [],
    incidents: [],
    tasks: [],
    calls: [],
    atRiskLoads: [],
    workItems: [],
  });
  const [activeTriageTab, setActiveTriageTab] = useState<
    | "LIVE_COMMS"
    | "REQUESTS"
    | "CRISIS"
    | "SERVICE"
    | "TASKS"
    | "INSIGHTS"
    | "SUPPORT"
    | "ASSETS"
  >("LIVE_COMMS");

  // Directory Management
  const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);
  const [directoryTab, setDirectoryTab] = useState<
    "PROVIDERS" | "CONTACTS" | "RECORDS" | "PREFERRED" | "IMPORT"
  >("PROVIDERS");
  const [directorySearchQuery, setDirectorySearchQuery] = useState("");
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [roadsideVendors, setRoadsideVendors] = useState<Provider[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [recordResults, setRecordResults] = useState<GlobalSearchResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showNewRecordMenu, setShowNewRecordMenu] = useState(false);

  // Rails visibility logic (State managed at component top for intelligent window detection)

  // Context-Aware Visibility Logic
  useEffect(() => {
    // If an interaction starts, we want the voice queue (right) and messaging (center)
    if (interactionState === "ACTIVE") {
      setRightRailCollapsed(false);
      setLeftRailCollapsed(true);
    }
  }, [interactionState]);

  useEffect(() => {
    // If a high-severity incident is detected, open the triage view
    const hasCritical = triageQueues.incidents.some(
      (i) => i.severity === "Critical",
    );
    if (hasCritical && windowWidth > 1440) {
      setRightRailCollapsed(false);
    }
  }, [triageQueues.incidents, windowWidth]);

  useEffect(() => {
    if (activeRecord?.activeSubTab) {
      setActive360Tab(activeRecord.activeSubTab);
    }
  }, [activeRecord?.id, activeRecord?.activeSubTab]);

  const fetchQueues = async (signal?: AbortSignal) => {
    try {
      const queues = await getTriageQueues();
      const workItems = await getWorkItems(user.companyId);
      if (signal?.aborted) return;
      setTriageQueues({ ...queues, workItems });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (signal?.aborted) return;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchQueues(controller.signal);
    const interval = setInterval(() => fetchQueues(controller.signal), 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (showDirectoryDrawer) {
      getProviders().then(setAllProviders);
      getContacts().then(setAllContacts);
    }
  }, [showDirectoryDrawer]);

  useEffect(() => {
    getVendors()
      .then(setRoadsideVendors)
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setToast({
            message: "Failed to load roadside vendors",
            type: "error",
          });
        }
      });
  }, []);

  useEffect(() => {
    const performDirectorySearch = async () => {
      if (directoryTab === "RECORDS") {
        if (directorySearchQuery.length < 2) {
          setRecordResults([]);
          return;
        }
        const results = await globalSearch(directorySearchQuery);
        setRecordResults(results);
      }
    };
    const timer = setTimeout(performDirectorySearch, 300);
    return () => clearTimeout(timer);
  }, [directorySearchQuery, directoryTab]);

  const {
    handleSafetyEscalate,
    handleAttachToRecord,
    handleLinkSessionToRecord,
    handleNotifyPartners,
    automatedStakeholderNotify,
    sendNotificationJob,
    handleRoadsideAssist,
    submitRoadsideDispatch,
    handleEscalate,
    handleFullLockdown,
    handleVerifyTrailerDrop,
  } = useCrisisHandlers({
    user,
    activeRecord,
    active360Data,
    currentCallSession,
    setCurrentCallSession,
    allContacts,
    selectedVendorForRoadside,
    roadsideNotes,
    selectedContacts,
    notificationContacts,
    notificationMessage,
    showSuccessMessage,
    setToast,
    setShowRoadsideForm,
    setShowNotifyPicker,
    setNotificationContacts,
    setActive360Data,
    showConfirmDialog,
    onRecordAction,
    handleActionLogging,
    fetchQueues,
    getRecord360Data,
    saveTask,
    saveIncident,
    saveIncidentCharge,
    saveCallSession,
    saveServiceTicket,
    saveNotificationJob,
  });

  // handleSystemSeed removed — mock seeding eliminated per T5-09
  const [callData, setCallData] = useState({
    type: "Driver",
    category: "Update",
    notes: "",
    attachedRecord: null as GlobalSearchResult | null,
  });
  const [handoffData, setHandoffData] = useState({ assignedTo: "", notes: "" });
  const [issueData, setIssueData] = useState({
    category: "Safety",
    description: "",
  });
  const [taskData, setTaskData] = useState({ title: "", assignedTo: "" });
  const [docData, setDocData] = useState({ type: "BOL" });

  const [isSplitView, setIsSplitView] = useState(false);
  const [recentDropdownOpen, setRecentDropdownOpen] = useState(false);

  // Auto-clear is now handled by useAutoFeedback hook

  const activeThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((t) => t.id === selectedThreadId);
  }, [threads, selectedThreadId]);

  // Crisis handlers extracted to useCrisisHandlers hook

  // Compute stats from active load data (no mock values)
  const stats = activeLoad
    ? {
        driver: { name: active360Data?.driver?.name || "No active load" },
        customer: {
          name: active360Data?.broker?.name || "Unknown",
          loadCount: loads.filter((l) => l.brokerId === activeLoad.brokerId)
            .length,
          onTime: "N/A",
          revenue: loads
            .filter((l) => l.brokerId === activeLoad.brokerId)
            .reduce((sum, l) => sum + (l.carrierRate || 0), 0),
        },
      }
    : null;

  // Incoming call source from real data (empty when no active call)
  const incomingCallSource = activeCallSession?.participants?.[0]
    ? {
        id: activeCallSession.participants[0].id,
        name: activeCallSession.participants[0].name,
        type: activeCallSession.participants[0].role,
      }
    : null;

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length < 1) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const results = await globalSearch(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    };
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (showInitialCallForm) {
      if (setActiveCallSession && !activeCallSession) {
        setActiveCallSession({
          id: `CALL-${uuidv4().slice(0, 8).toUpperCase()}`,
          startTime: new Date().toISOString(),
          status: "ACTIVE",
          participants: [{ id: "TBD", name: "Unknown", role: "PARTICIPANT" }],
          lastActivityAt: new Date().toISOString(),
          links: session.primaryContext
            ? [
                {
                  id: uuidv4(),
                  entityType: session.primaryContext.type,
                  entityId: session.primaryContext.id,
                  isPrimary: true,
                  createdAt: new Date().toISOString(),
                  createdBy: user.name,
                },
              ]
            : [],
        });
      }
    }
  }, [showInitialCallForm]);

  const handleSearchSelect = async (type: EntityType, id: string) => {
    if (!id) return;
    await openRecordWorkspace(type, id);
    setSearchQuery("");
    setSearchResults([]);
  };

  const filteredTimeline = useMemo(() => {
    if (activeTimelineFilter === "ALL") return unifiedEvents;
    return unifiedEvents.filter((e) => e.type === activeTimelineFilter);
  }, [unifiedEvents, activeTimelineFilter]);

  const startResizingLeft = (e: React.MouseEvent) => {
    const handleMouseMove = (moveEvent: MouseEvent) =>
      setLeftWidth(moveEvent.clientX);
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const startResizingRight = (e: React.MouseEvent) => {
    const handleMouseMove = (moveEvent: MouseEvent) =>
      setRightWidth(window.innerWidth - moveEvent.clientX);
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const saveThread = async (thread: Thread) => {};
  const handleTimelineEventClick = (event: OperationalEvent) => {};
  const handleTimelineAction = (eventId: string, action: string) => {};
  const handleInitiateGlobalInbound = async () => {
    // Populate call queue from real triage data instead of mock callers
    const queues = await getTriageQueues();
    const realCallers = (queues.calls || []).filter(
      (c: CallSession) => c.status === "WAITING",
    );
    if (realCallers.length > 0) {
      setTriageQueues((prev) => ({ ...prev, calls: [...queues.calls] }));
      const firstCaller = realCallers[0];
      const callerName = firstCaller.participants?.[0]?.name || "Unknown";
      const callerRole = firstCaller.participants?.[0]?.role || "UNKNOWN";
      showSuccessMessage(
        `Tactical Inbound Initiated: ${callerName} (${callerRole})`,
      );
    } else {
      // No waiting calls — create a placeholder session from real user context
      const newCall: CallSession = {
        id: `CALL-IN-${uuidv4().slice(0, 4).toUpperCase()}`,
        startTime: new Date().toISOString(),
        status: "WAITING",
        participants: [{ id: user.id, name: user.name, role: "DISPATCHER" }],
        lastActivityAt: new Date().toISOString(),
        links: [],
        team: "DISPATCH",
      };
      await saveCallSession(newCall);
      const updatedQueues = await getTriageQueues();
      setTriageQueues((prev) => ({ ...prev, calls: [...updatedQueues.calls] }));
      showSuccessMessage(
        `Tactical Inbound Initiated: ${user.name} (DISPATCHER)`,
      );
    }
  };

  // Context Management Logic
  const setPrimaryContext = async (type: EntityType, id: string) => {
    await openRecordWorkspace(type, id);
  };

  const togglePin = (ctx: ContextRecord) => {
    setSession((prev) => {
      const isPinned = prev.pinnedContexts.some((c) => c.id === ctx.id);
      if (isPinned)
        return {
          ...prev,
          pinnedContexts: prev.pinnedContexts.filter((c) => c.id !== ctx.id),
        };
      return { ...prev, pinnedContexts: [...prev.pinnedContexts, ctx] };
    });
  };

  const handleOpenWorkspace = async (
    type: EntityType,
    id: string,
    subTab?: string,
  ) => {
    // INTELLIGENT FLOW: Detect space before deciding rail states
    if (windowWidth < 1800) {
      // Priority 1: The workspace content. On mid-size screens, collapse EVERYTHING else.
      setLeftRailCollapsed(true);
      setRightRailCollapsed(true);
    } else {
      // On large screens, we can afford the right rail for triage/comm
      setLeftRailCollapsed(true);
      setRightRailCollapsed(false);
    }

    setSelectedTab("command");
    if (subTab) setActive360Tab(subTab);

    // Trigger the core workspace opening
    await openRecordWorkspace(type, id, subTab);
  };

  const handleTriageAction = async (
    action: "TAKE" | "ASSIGN" | "SNOOZE" | "ESCALATE",
    item: any,
    type: string,
  ) => {
    const timestamp = new Date().toISOString();

    if (action === "SNOOZE") {
      setSnoozedIds((prev) => new Set([...prev, item.id]));
      showSuccessMessage(`Record ${item.id} Snoozed for 1 hour`);
    } else if (action === "TAKE") {
      if (type === "INCIDENT") {
        const incs = await getIncidents();
        const inc = incs.find((i) => i.id === item.id);
        if (inc) {
          inc.status = "In_Progress";
          inc.ownerUserId = user.id;
          await saveIncident(inc);
        }
      } else if (type === "WORK_ITEM") {
        const updatedItem = {
          ...item,
          status: "In-Progress" as WorkItem["status"],
          assignedTo: [user.id],
        };
        await saveWorkItem(updatedItem);
      }
      showSuccessMessage(`Record ${item.id} Assigned to You`);
    } else if (action === "ESCALATE") {
      if (type === "INCIDENT") {
        const incs = await getIncidents();
        const inc = incs.find((i) => i.id === item.id);
        if (inc) {
          inc.status = "Critical";
          inc.severity = "Critical";
          await saveIncident(inc);
        }
      } else if (type === "WORK_ITEM") {
        const wis = await getWorkItems();
        const wi = wis.find((w) => w.id === item.id);
        if (wi) {
          wi.status = "Critical";
          wi.priority = "Critical";
          await saveWorkItem(wi);
        }
      }
      showSuccessMessage(`Record ${item.id} ESCALATED TO LEADERSHIP`);
    }

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp,
      actorId: user.id,
      actorName: user.name,
      loadId: item.loadId || (type === "LOAD" ? item.id : undefined),
      message: `Dispatcher ${user.name} handled ${type} ${item.id} with action: ${action}`,
      payload: {
        action,
        recordId: item.id,
        recordType: type,
        category: "Triage",
      },
    });

    if (action === "ASSIGN") {
      setShowHandoffForm(true);
    }

    await fetchQueues();
  };

  if (props.isLoading) {
    return (
      <div className="flex h-full w-full bg-[#0a0c10] items-start justify-center p-8">
        <div className="w-full max-w-4xl space-y-6">
          <LoadingSkeleton variant="card" count={3} />
          <LoadingSkeleton variant="table" count={5} />
        </div>
      </div>
    );
  }

  if (props.loadError) {
    return (
      <div className="flex h-full w-full bg-[#0a0c10] items-center justify-center">
        <ErrorState
          message={props.loadError}
          onRetry={props.onRetry ?? (() => {})}
        />
      </div>
    );
  }

  if (loads.length === 0 && incidents.length === 0) {
    return (
      <div className="flex h-full w-full bg-[#0a0c10] items-center justify-center">
        <EmptyState
          icon={<Brain className="w-12 h-12" />}
          title="Intelligence Hub Ready"
          description="No operational data yet. Create loads and start dispatching to populate the command center."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#0a0c10] overflow-hidden text-slate-300 font-inter relative">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      <InputDialog
        open={inputDialogState.open}
        title={inputDialogState.title}
        message={inputDialogState.message}
        multiline
        onSubmit={(v) => {
          setInputDialogState((s) => ({ ...s, open: false }));
          inputDialogState.resolve?.(v);
        }}
        onCancel={() => {
          setInputDialogState((s) => ({ ...s, open: false }));
          inputDialogState.resolve?.(null);
        }}
      />
      <ConfirmDialog
        open={confirmDialogState.open}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        danger
        onConfirm={() => {
          setConfirmDialogState((s) => ({ ...s, open: false }));
          confirmDialogState.resolve?.(true);
        }}
        onCancel={() => {
          setConfirmDialogState((s) => ({ ...s, open: false }));
          confirmDialogState.resolve?.(false);
        }}
      />
      {/* CENTER WORKSPACE: THE 360 TRUTH PANEL */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-[#0a0c10] overflow-hidden relative transition-all duration-300 ${rightRailCollapsed ? "mr-16" : "mr-96"}`}
      >
        {/* Simplified Header */}
        <header
          className={`${isHighObstruction ? "h-11 px-6" : "h-14 px-8"} shrink-0 border-b border-white/5 bg-slate-950/20 flex items-center justify-between z-20`}
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-indigo-500 fill-indigo-500/20" />
              <span className="text-sm font-black text-white font-inter tracking-[0.2em] uppercase italic">
                Unified Command Center
              </span>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                Workspace
              </span>
              <span className="text-sm font-black text-white uppercase">
                {activeRecord?.label || "Awaiting Selection"}
              </span>
            </div>
            <div className="h-8 w-px bg-white/5 mx-2" />
            <div className="flex gap-4">
              <div className="relative w-80">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isSearching ? "text-indigo-500 animate-pulse" : "text-slate-600"}`}
                />
                <input
                  type="text"
                  placeholder="SEARCH COMMAND..."
                  aria-label="Search intelligence commands"
                  className={`w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 ${isHighObstruction ? "py-1 text-[11px] font-black" : "py-2 text-[10px]"} text-white outline-none focus:border-indigo-500/50 transition-all`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 border-b border-white/5 bg-slate-900/50">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                        Global Intelligence Results
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto no-scrollbar">
                      {searchResults.map((res) => (
                        <button
                          key={`${res.type}-${res.id}`}
                          onClick={() =>
                            handleSearchSelect(res.type as EntityType, res.id)
                          }
                          className="w-full p-4 flex items-center justify-between hover:bg-white/5 border-b border-white/5 transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 group-hover:border-indigo-500/30 transition-all">
                              {res.type === "LOAD" ? (
                                <Truck className="w-5 h-5 text-indigo-500" />
                              ) : res.type === "DRIVER" ? (
                                <UserIcon className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <Activity className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div className="text-left">
                              <div className="text-[11px] font-black text-white uppercase tracking-tight">
                                {res.label}
                              </div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {res.subLabel}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {res.chips?.map((chip) => (
                              <span
                                key={chip.label}
                                className="px-2 py-0.5 bg-slate-900 border border-white/5 text-[10px] font-black text-slate-400 uppercase rounded"
                              >
                                {chip.label}
                              </span>
                            ))}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-6">
              {[
                { label: "OPS", tab: "ops" },
                { label: "FEED", tab: "messaging" },
                { label: "COMMAND", tab: "command" },
                { label: "SAFETY", tab: "safety" },
                { label: "SALES/CRM", tab: "crm" },
                { label: "NETWORK", tab: "directory" },
                { label: "INTELLIGENCE", tab: "intelligence" },
                { label: "REPORTS", tab: "reports" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setSelectedTab(chip.tab)}
                  className={`text-[11px] font-black uppercase tracking-widest transition-all border-b pb-1 ${selectedTab === chip.tab ? "text-blue-400 border-blue-400/50" : "text-slate-500 border-transparent hover:text-blue-400 hover:border-blue-400/50"}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              className="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ACTION COMMAND STRIP (Inverted Position) */}
          <div
            className={`${isHighObstruction ? "h-11 px-6" : "h-14 px-8"} flex items-center justify-between bg-slate-900/40 border-b border-white/5 transition-all`}
          >
            <div className="flex items-center gap-2">
              {features.simulateActions && (
                <ActionGroup
                  label="SIMULATE"
                  color="purple"
                  icon={Activity}
                  isHighObstruction={isHighObstruction}
                  actions={[
                    {
                      label: "Inbound Call",
                      icon: PhoneCall,
                      action: handleInitiateGlobalInbound,
                    },
                    {
                      label: "Financial Auth",
                      icon: Lock,
                      action: () => {
                        handleActionLogging({
                          id: uuidv4(),
                          type: "REQUEST",
                          timestamp: new Date().toISOString(),
                          actorId: user.id,
                          actorName: user.name,
                          message:
                            "FINANCIAL PROTOCOL: High-value exception authorized for settlement queue.",
                          payload: {
                            category: "Financial",
                            action: "AuthOverride",
                            status: "AUTHORIZED",
                          },
                        });
                        showSuccessMessage(
                          "FINANCIAL PROTOCOL: High-value exception authorized for settlement queue.",
                          4000,
                        );
                      },
                    },
                  ]}
                />
              )}
              <ActionGroup
                label="Quick Actions"
                color="orange"
                icon={Zap}
                isHighObstruction={isHighObstruction}
                actions={[
                  {
                    label: "Create Request",
                    icon: DollarSign,
                    action: async () => {
                      const id = `REQ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
                      setRequestData((prev) => ({
                        ...prev,
                        id,
                        attachedRecord: activeRecord
                          ? {
                              id: activeRecord.id,
                              label: activeRecord.label,
                              type: activeRecord.type,
                            }
                          : null,
                      }));
                      setShowRequestForm(true);
                      await fetchQueues();
                    },
                  },
                  {
                    label: "Task",
                    icon: ClipboardList,
                    action: async () => {
                      setShowTaskForm(true);
                      await fetchQueues();
                    },
                  },
                  {
                    label: "Verify Drop",
                    icon: CheckCircle,
                    action: async () => {
                      await handleVerifyTrailerDrop();
                      await fetchQueues();
                    },
                  },
                  {
                    label: "Repower",
                    icon: RefreshCw,
                    action: async () => {
                      await handleRepower();
                      await fetchQueues();
                    },
                  },
                  {
                    label: "Roadside",
                    icon: Wrench,
                    action: async () => {
                      await handleRoadsideAssist();
                      await fetchQueues();
                    },
                  },
                  {
                    label: "Notify Partners",
                    icon: ShieldAlert,
                    action: handleNotifyPartners,
                  },
                  {
                    label: "Handoff",
                    icon: Share2,
                    action: () => {
                      setHandoffData((prev) => ({
                        ...prev,
                        notes: activeRecord
                          ? `Context: ${activeRecord.label}`
                          : "",
                      }));
                      setShowHandoffForm(true);
                    },
                  },
                  {
                    label: "Issue",
                    icon: AlertTriangle,
                    action: () => setShowIssueForm(true),
                  },
                  ...(features.injectRecord
                    ? [
                        {
                          label: "Inject Record",
                          icon: FileText,
                          action: () => setShowDocForm(true),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-950/10 border-r border-white/5 overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* === OPS DASHBOARD VIEW === */}
              {selectedTab === "ops" && (
                <OpsDashboardPanel
                  opsLoading={opsLoading}
                  opsError={opsError}
                  loadOpsDashboardData={loadOpsDashboardData}
                  loads={loads}
                  opsCards={opsCards}
                  opsExceptions={opsExceptions}
                  onNavigate={onNavigate}
                />
              )}

              {selectedTab === "command" && (
                <CommandCenterView
                  session={session}
                  loads={loads}
                  users={propUsers}
                  currentUser={user}
                  onRecordAction={onRecordAction}
                  onNavigate={(tab) => {
                    if (tab === "loads") setSelectedTab("command");
                    else if (tab === "quotes") setSelectedTab("crm");
                    else setSelectedTab(tab);
                  }}
                  onRepower={handleRepower}
                  onRoadside={handleRoadsideAssist}
                  onNotify={handleNotifyPartners}
                  openRecordWorkspace={handleOpenWorkspace}
                  incidents={triageQueues.incidents}
                  workItems={triageQueues.workItems}
                  refreshQueues={fetchQueues}
                  activeRecord={session.primaryContext}
                  active360Data={active360Data || session.primaryContext?.data}
                  activeSubTab={active360Tab}
                  unifiedEvents={unifiedEvents}
                  onCloseContext={onCloseContext}
                  isHighObstruction={isHighObstruction}
                  obstructionLevel={obstructionLevel}
                  onViewFullLoad={(load) => {
                    setSelectedLoadForDetail(load);
                    setShowLoadDetail(true);
                  }}
                  setSuccessMessage={(msg) =>
                    msg === null
                      ? clearSuccessMessage()
                      : showSuccessMessage(msg)
                  }
                />
              )}

              {selectedTab === "safety" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617]">
                  <ExceptionConsole
                    currentUser={user}
                    loads={loads}
                    initialView="safety"
                  />
                </div>
              )}

              {selectedTab === "messaging" && (
                <div className="flex-1 flex flex-col min-h-0 bg-[#020617]">
                  <OperationalMessaging
                    user={user}
                    loads={loads}
                    initialLoadId={
                      activeRecord?.type === "LOAD"
                        ? String(activeRecord.id || "")
                        : null
                    }
                    interactionState={interactionState}
                    callSession={currentCallSession}
                    onNoteCreated={handleInteractionNote}
                    onRecordAction={handleActionLogging}
                    onLinkSession={onLinkSessionToRecord}
                    session={session}
                    unifiedEvents={unifiedEvents}
                    threads={threads}
                  />
                </div>
              )}

              {selectedTab === "crm" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617]">
                  <QuoteManager user={user} company={company || null} />
                </div>
              )}

              {selectedTab === "directory" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617]">
                  <NetworkPortal companyId={user.companyId} />
                </div>
              )}

              {selectedTab === "intelligence" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617] p-6 space-y-6">
                  {/* Missed Revenue Alert Banner */}
                  {missedRevenue.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-amber-300 text-xs font-black uppercase tracking-widest">
                          {missedRevenue.length} Missed Revenue{" "}
                          {missedRevenue.length === 1 ? "Alert" : "Alerts"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {missedRevenue.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-300 font-mono">
                              {item.load_number}
                            </span>
                            <span className="text-slate-500">
                              {item.broker_name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.reason === "DETENTION_NOT_INVOICED" ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"}`}
                            >
                              {item.reason === "DETENTION_NOT_INVOICED"
                                ? "Detention"
                                : "Lumper"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Broker Risk Leaderboard */}
                  <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-white text-xs font-black uppercase tracking-widest">
                        Broker Risk Leaderboard
                      </span>
                    </div>
                    {intelLoading ? (
                      <div className="p-8 text-center text-slate-600 text-xs">
                        Loading...
                      </div>
                    ) : brokerRisk.length === 0 ? (
                      <div className="p-8 text-center text-slate-600 text-xs">
                        No broker data yet. Complete loads to build the index.
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {brokerRisk.map((broker: any, i: number) => (
                          <div
                            key={broker.id}
                            className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                          >
                            <span
                              className={`text-xs font-black w-5 shrink-0 ${i === 0 ? "text-red-400" : i === 1 ? "text-orange-400" : "text-slate-500"}`}
                            >
                              #{i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-xs font-semibold truncate">
                                {broker.name}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                {broker.total_loads_completed ?? 0} loads
                                completed
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {broker.discrepancy_score > 0 && (
                                <div className="text-right">
                                  <div className="text-red-400 text-xs font-black">
                                    {broker.discrepancy_score}
                                  </div>
                                  <div className="text-slate-600 text-[10px]">
                                    Lie Score
                                  </div>
                                </div>
                              )}
                              {broker.avg_discrepancy_pct != null && (
                                <div className="text-right">
                                  <div className="text-orange-400 text-xs font-bold">
                                    {broker.avg_discrepancy_pct}%
                                  </div>
                                  <div className="text-slate-600 text-[10px]">
                                    Avg Variance
                                  </div>
                                </div>
                              )}
                              <div className="text-right">
                                <div
                                  className={`text-xs font-bold ${broker.avg_payment_days > 35 ? "text-red-400" : broker.avg_payment_days > 28 ? "text-yellow-400" : "text-green-400"}`}
                                >
                                  {broker.avg_payment_days ?? "—"} days
                                </div>
                                <div className="text-slate-600 text-[10px]">
                                  Avg Pay Time
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Facility Index Search */}
                  <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                      <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-white text-xs font-black uppercase tracking-widest">
                        Facility Index
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          value={facilityQuery}
                          onChange={(e) => setFacilityQuery(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleFacilitySearch()
                          }
                          placeholder="Search facility name (e.g. Americold, Atlanta)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          onClick={handleFacilitySearch}
                          className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Search className="w-3 h-3" /> Search
                        </button>
                      </div>
                      {facilityResults.length > 0 ? (
                        <div className="space-y-2">
                          {facilityResults.map((fac: any, i: number) => {
                            const avgHours = fac.avg_detention_minutes
                              ? (fac.avg_detention_minutes / 60).toFixed(1)
                              : null;
                            return (
                              <div
                                key={i}
                                className="bg-white/[0.03] border border-white/8 rounded-lg px-4 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-white text-xs font-bold">
                                      {fac.facility_name}
                                    </div>
                                    <div className="text-slate-500 text-[10px]">
                                      {fac.city}, {fac.state} ·{" "}
                                      {fac.total_visits} visits
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0">
                                    {avgHours && (
                                      <div className="text-right">
                                        <div
                                          className={`text-xs font-black ${parseFloat(avgHours) > 4 ? "text-red-400" : parseFloat(avgHours) > 2 ? "text-yellow-400" : "text-green-400"}`}
                                        >
                                          {avgHours}h avg
                                        </div>
                                        <div className="text-slate-600 text-[10px]">
                                          Load Time
                                        </div>
                                      </div>
                                    )}
                                    {fac.recommended_rate_increase > 0 && (
                                      <div className="text-right">
                                        <div className="text-blue-400 text-xs font-black">
                                          +${fac.recommended_rate_increase}
                                        </div>
                                        <div className="text-slate-600 text-[10px]">
                                          Rec. Rate Add
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : facilityQuery && !intelLoading ? (
                        <div className="text-center text-slate-600 text-xs py-4">
                          No data yet for that facility. It builds automatically
                          as loads complete.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === "reports" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617] p-6">
                  <h2 className="text-lg font-bold text-white mb-4">
                    <BarChart3 className="w-5 h-5 inline mr-2" />
                    Communication Reports
                  </h2>
                  {commQueue.length === 0 && threads.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">
                        No data available
                      </p>
                      <p className="text-slate-600 text-xs mt-1">
                        Call metrics and interaction summaries will appear here
                        once data is recorded.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Call Metrics */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-white mb-3">
                          Call Metrics
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400">
                              Total Calls
                            </p>
                            <p className="text-2xl font-bold text-blue-400">
                              {commQueue.length}
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-slate-400">
                              Avg Duration
                            </p>
                            <p className="text-2xl font-bold text-green-400">
                              {commQueue.length > 0
                                ? (() => {
                                    const withDuration = commQueue.filter(
                                      (c) => c.durationSeconds,
                                    );
                                    if (withDuration.length === 0) return "N/A";
                                    const avg = Math.round(
                                      withDuration.reduce(
                                        (sum, c) =>
                                          sum + (c.durationSeconds || 0),
                                        0,
                                      ) / withDuration.length,
                                    );
                                    return `${Math.floor(avg / 60)}m ${avg % 60}s`;
                                  })()
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Interaction Summary */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-white mb-3">
                          Interaction Summary
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                            <Phone className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-xs text-slate-400">Calls</p>
                              <p className="text-lg font-bold text-white">
                                {commQueue.length}
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-purple-400" />
                            <div>
                              <p className="text-xs text-slate-400">Messages</p>
                              <p className="text-lg font-bold text-white">
                                {threads.length}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT RAIL: PERSISTENT TRIAGE QUEUES */}
      <TriageWorkspacePanel
        triageQueues={triageQueues}
        activeTriageTab={activeTriageTab}
        setActiveTriageTab={(tab) =>
          setActiveTriageTab(tab as typeof activeTriageTab)
        }
        commSearchQuery={commSearchQuery}
        snoozedIds={snoozedIds}
        currentCallSession={currentCallSession}
        isHighObstruction={isHighObstruction}
        isCollapsed={rightRailCollapsed}
        onToggleCollapse={() => setRightRailCollapsed(!rightRailCollapsed)}
        onOpenWorkspace={handleOpenWorkspace}
        onInitiateGlobalInbound={handleInitiateGlobalInbound}
        onTriageAction={handleTriageAction}
        onSafetyEscalate={handleSafetyEscalate}
        setActiveCallSession={setActiveCallSession}
        setOverlayState={setOverlayState}
        setSelectedTab={setSelectedTab}
        setInteractionState={(state) =>
          setInteractionState(state as typeof interactionState)
        }
      />

      {/* MODALS */}
      <OperationalFormsOverlay
        showHandoffForm={showHandoffForm}
        setShowHandoffForm={setShowHandoffForm}
        showCallLogForm={showCallLogForm}
        setShowCallLogForm={setShowCallLogForm}
        showTaskForm={showTaskForm}
        setShowTaskForm={setShowTaskForm}
        showIssueForm={showIssueForm}
        setShowIssueForm={setShowIssueForm}
        showRequestForm={showRequestForm}
        setShowRequestForm={setShowRequestForm}
        showDirectoryDrawer={showDirectoryDrawer}
        setShowDirectoryDrawer={setShowDirectoryDrawer}
        handoffData={handoffData}
        setHandoffData={setHandoffData}
        callData={callData}
        setCallData={setCallData}
        taskData={taskData}
        setTaskData={setTaskData}
        issueData={issueData}
        setIssueData={setIssueData}
        requestData={requestData}
        setRequestData={setRequestData}
        propUsers={propUsers}
        user={user}
        activeRecord={activeRecord}
        active360Data={active360Data}
        onRecordAction={onRecordAction}
        fetchQueues={fetchQueues}
        showSuccessMessage={showSuccessMessage}
        setToast={setToast}
        setInteractionState={setInteractionState}
        setSelectedTab={setSelectedTab}
        directoryTab={directoryTab}
        setDirectoryTab={setDirectoryTab}
        directorySearchQuery={directorySearchQuery}
        setDirectorySearchQuery={setDirectorySearchQuery}
        attachmentSearchQuery={attachmentSearchQuery}
        setAttachmentSearchQuery={setAttachmentSearchQuery}
        attachmentResults={attachmentResults}
        setAttachmentResults={setAttachmentResults}
        handleAttachToRecord={handleAttachToRecord}
        handleCreateRequest={handleCreateRequest}
        notificationContacts={notificationContacts}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
        session={session}
        allProviders={allProviders}
        allContacts={allContacts}
        recordResults={recordResults}
      />
      {/* REPOWER SELECTION PANEL */}
      <RepowerSelectionPanel
        showRepowerPanel={showRepowerPanel}
        setShowRepowerPanel={setShowRepowerPanel}
        repowerLoadId={repowerLoadId}
        repowerMatches={repowerMatches}
        isSearchingMatches={isSearchingMatches}
        executeRepower={executeRepowerHandoff}
        executeRepowerHandoff={executeRepowerHandoff}
        loads={loads}
        user={user}
        session={session}
        activeRecord={activeRecord}
        onRecordAction={onRecordAction}
        showSuccessMessage={showSuccessMessage}
        showRoadsideForm={showRoadsideForm}
        setShowRoadsideForm={setShowRoadsideForm}
        roadsideNotes={roadsideNotes}
        setRoadsideNotes={setRoadsideNotes}
        roadsideVendors={roadsideVendors}
        selectedVendorForRoadside={selectedVendorForRoadside}
        setSelectedVendorForRoadside={setSelectedVendorForRoadside}
        submitRoadsideAssist={submitRoadsideDispatch}
        submitRoadsideDispatch={submitRoadsideDispatch}
        showNotifyPicker={showNotifyPicker}
        setShowNotifyPicker={setShowNotifyPicker}
        notificationContacts={notificationContacts}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
        notificationMessage={notificationMessage}
        setNotificationMessage={setNotificationMessage}
        handleNotifyPartners={handleNotifyPartners}
        sendNotificationJob={sendNotificationJob}
        showDocForm={showDocForm}
        setShowDocForm={setShowDocForm}
      />

      {showLoadDetail && selectedLoadForDetail && (
        <LoadDetailView
          load={selectedLoadForDetail}
          onClose={() => setShowLoadDetail(false)}
          onEdit={(l) => {
            setShowLoadDetail(false);
            // This might need a way to trigger EditLoadForm in App.tsx
            // For now we assume they can edit from the Detail view if implemented
          }}
          users={propUsers}
          brokers={brokers}
          canViewRates={true}
        />
      )}
    </div>
  );
};

export default IntelligenceHub;
