import React, { useState, useEffect, useMemo } from "react";
import {
  Gauge,
  AlertCircle,
  PhoneCall,
  Cpu,
  Brain,
  Zap,
  Target,
  Search,
  Plus,
  CreditCard,
  AlertTriangle,
  ClipboardList,
  Phone,
  Truck,
  Activity,
  ChevronRight,
  User as UserIcon,
  Building2,
  Anchor,
  X,
  MessageSquare,
  DollarSign,
  CheckCircle,
  RefreshCw,
  Wrench,
  Share2,
  ShieldCheck,
  Clock,
  FileCheck,
  FileText,
  BarChart3,
  Filter,
  History,
  Star,
  Trophy,
  Users,
  Link2,
  Home,
  LogOut,
  Workflow,
  ChevronLeft,
  ShieldAlert,
  Map,
  MapPin,
  Bell,
  Navigation,
  Lock,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { OperationalMessaging } from "./OperationalMessaging";
import { CommandCenterView } from "./CommandCenterView";
// mockDataService gated behind import.meta.env.DEV — no production path imports it
const seedMockData = async (u: any) => {
  if (!import.meta.env.DEV) return; // import.meta.env.DEV gate
  const mod = await import("../services/mockDataService"); // guarded by import.meta.env.DEV
  await mod.seedMockData(u);
};
import {
  globalSearch,
  getRecord360Data,
  getIncidents,
  getLoadSummary,
  getDriverSummary,
  getBrokerSummary,
  getMessages,
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
  saveProvider,
  saveContact,
  saveServiceTicket,
  saveNotificationJob,
  createIncident as coreCreateIncident,
  saveTask,
  getAuthHeaders,
} from "../services/storageService";
import { getVendors, saveVendor } from "../services/safetyService";
import { SafetyView } from "./SafetyView";
import { NetworkPortal } from "./NetworkPortal";
import { QuoteManager } from "./QuoteManager";
import { LoadDetailView } from "./LoadDetailView";
import {
  GlobalSearchResult,
  EntityType,
  LoadSummary,
  DriverSummary,
  Incident,
  IncidentAction,
  KCIRequest,
  WorkspaceSession,
  ContextRecord,
  RequestType,
  WorkflowStep,
  CallSession,
  CallSessionStatus,
  OperationalEvent,
  LoadData,
  User,
  Broker,
  Provider,
  Contact,
  ServiceTicket,
  NotificationJob,
  OperationalTask,
  WorkItem,
} from "../types";
import {
  DispatchIntelligence,
  getRegion,
} from "../services/dispatchIntelligence";
import { FuelCardService } from "../services/fuelService";
import { DetentionService } from "../services/detentionService";
import { checkCapability } from "../services/authService";
import { Company as CompanyType } from "../types";
import { features } from "../config/features";

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
      .filter(
        (l) =>
          l.status === "in_transit" ||
          (l.issues &&
            Array.isArray(l.issues) &&
            l.issues.some((i: any) => i.status === "Open")),
      )
      .map((l) => ({
        id: l.id,
        primaryContext: { label: `Load #${l.loadNumber || "---"}` },
        lastTouch: new Date(l.createdAt || Date.now()).toISOString(),
        summary:
          l.actionSummary ||
          (l.issues &&
            Array.isArray(l.issues) &&
            l.issues.find((i: any) => i.status === "Open")?.description) ||
          `Status: ${l.status || "Unknown"}`,
        ownerName: "Dispatch",
        ownerId: "system",
        isAtRisk:
          l.isActionRequired ||
          (l.issues &&
            Array.isArray(l.issues) &&
            l.issues.some((i: any) => i.status === "Open")),
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
    setSuccessMessage(
      `Repower Handoff successful: ${driverName} is now assigned. Stakeholders notified.`,
    );

    // Refresh queues
    const queues = await getTriageQueues();
    setTriageQueues(queues);
  };

  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [commQueue, setCommQueue] = useState<CallSession[]>([
    {
      id: "CS-9901",
      status: "WAITING",
      startTime: new Date(Date.now() - 300000).toISOString(),
      participants: [{ id: "D-12", name: "Mark Stevens", role: "DRIVER" }],
      lastActivityAt: new Date(Date.now() - 300000).toISOString(),
      links: [],
      team: "SAFETY",
    },
    {
      id: "CS-9902",
      status: "ACTIVE",
      startTime: new Date(Date.now() - 60000).toISOString(),
      participants: [
        { id: "B-88", name: "Choptank Logistics", role: "BROKER" },
      ],
      lastActivityAt: new Date(Date.now() - 60000).toISOString(),
      links: [],
      team: "DISPATCH",
    },
  ]);

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

    setSuccessMessage(`Interaction Started: ${newSession.id}`);
  };

  const wrapUpInteraction = async () => {
    const sessionToWrap = currentCallSession || activeCallSession;
    if (!sessionToWrap) return;

    const callNotes = prompt("Enter summary of call for the permanent record:");
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
      await fetch(`/api/incidents/${primaryLink.entityId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          actor_name: user.name,
          action: "Recorded Call",
          notes: callNotes,
        }),
      });
    }

    setCurrentCallSession(updatedSession);
    setInteractionState("WRAP-UP");
    if (setActiveCallSession) setActiveCallSession(updatedSession);

    setSuccessMessage(
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
    setSuccessMessage(`Note attached to interaction: ${currentCallSession.id}`);
  };

  const handleCreateRequest = async () => {
    if (!requestData.attachedRecord) {
      setSuccessMessage(
        "ERROR: Strategic Attachment Required to process request.",
      );
      setTimeout(() => setSuccessMessage(null), 3000);
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
    setSuccessMessage(`Request Created: ${newRequest.id}`);

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
      setSuccessMessage(
        `Auto-Assigned ${bestMatch.driverName} to Load #${load.loadNumber}`,
      );
    } else {
      setSuccessMessage(
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

  const fetchQueues = async () => {
    const queues = await getTriageQueues();
    const workItems = await getWorkItems(user.companyId);
    setTriageQueues({ ...queues, workItems });
  };

  useEffect(() => {
    fetchQueues();
    const interval = setInterval(fetchQueues, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showDirectoryDrawer) {
      getProviders().then(setAllProviders);
      getContacts().then(setAllContacts);
    }
  }, [showDirectoryDrawer]);

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

  const handleSafetyEscalate = async (load?: LoadData) => {
    if (!load && !activeRecord) {
      setSuccessMessage(
        "SYSTEM: Protocol requires an active record context for safety escalation.",
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }

    const targetLoadId =
      load?.id || (activeRecord?.type === "LOAD" ? activeRecord.id : undefined);

    const task: OperationalTask = {
      id: `TASK-${uuidv4().slice(0, 8).toUpperCase()}`,
      type: "GENERAL",
      title: `CRITICAL: Safety Handoff - Load #${load?.loadNumber || activeRecord?.label}`,
      description: `Manual safety escalation triggered by ${user.name}. Asset requires immediate compliance review or intervention.`,
      status: "OPEN",
      priority: "CRITICAL",
      assignedTo: "SAFETY_COMPLIANCE",
      dueDate: new Date(Date.now() + 900000).toISOString(), // 15 mins
      links: [
        {
          id: uuidv4(),
          entityType: "LOAD",
          entityId: targetLoadId,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          createdBy: user.name,
        },
      ],
      createdAt: new Date().toISOString(),
      createdBy: user.name,
    };
    await saveTask(task);
    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      loadId: targetLoadId,
      message: `Dispatcher ${user.name} escalated Load #${load?.loadNumber || activeRecord?.label} to Safety`,
      payload: { category: "Escalation", action: "Safety Handoff" },
    });
    setSuccessMessage(
      "SAFETY PROTOCOL TRIGGERED: Handoff Created for Safety & Compliance",
    );
    fetchQueues();
  };

  const handleAttachToRecord = async (
    item: any,
    type: EntityType | "PROVIDER" | "CONTACT",
  ) => {
    // 1. Priority: Link to active interaction if one exists
    if (currentCallSession) {
      await handleLinkSessionToRecord(
        currentCallSession.id,
        item.id,
        type as EntityType,
      );
      setSuccessMessage(
        `${type} ${item.name || item.label || item.id} linked to active call.`,
      );
      return;
    }

    // 2. Secondary: Attach to currently viewed record (Workspace)
    if (!activeRecord) return alert("No active record or call to attach to");

    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      loadId: activeRecord.type === "LOAD" ? activeRecord.id : undefined,
      message: `${type} attached to ${activeRecord.type}: ${item.name || item.label || item.id}`,
      payload: {
        category: "Attachment",
        itemId: item.id,
        itemType: type,
        recordId: activeRecord.id,
        recordType: activeRecord.type,
      },
    });

    if (activeRecord.type === "INCIDENT" && active360Data?.incident) {
      const updated = { ...active360Data.incident };
      updated.timeline.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        actorName: user.name,
        action: `${type}_ATTACHED`,
        notes: `${type} attached: ${item.name || item.label || item.id}`,
      });
      await saveIncident(updated);
      const data = await getRecord360Data(activeRecord.type, activeRecord.id);
      setActive360Data(data);
    }

    setSuccessMessage(
      `${item.name || item.label || item.id} attached to ${activeRecord.label}`,
    );
  };

  const handleSystemSeed = async () => {
    setSuccessMessage("COMMENCING SYSTEM SEEDING...");
    await seedMockData(user);
    await fetchQueues();
    setSuccessMessage("OPERATIONAL ENVIRONMENT READY - SYSTEM HOT");
    setTimeout(() => setSuccessMessage(null), 4000);
  };
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

  const handleLinkSessionToRecord = async (
    sessionId: string,
    recordId: string,
    recordType: EntityType,
  ) => {
    if (!currentCallSession || currentCallSession.id !== sessionId) return;

    const updatedSession = {
      ...currentCallSession,
      loadId: recordId,
      type: recordType,
    };
    await saveCallSession(updatedSession);
    setCurrentCallSession(updatedSession);

    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      loadId: recordId,
      message: `Interaction Session ${sessionId} linked to ${recordType} Record`,
      payload: { category: "Linking", sessionId, recordId, recordType },
    });

    setSuccessMessage(`Session Successfully Linked to Record`);
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const activeThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((t) => t.id === selectedThreadId);
  }, [threads, selectedThreadId]);

  const handleNotifyPartners = async () => {
    // Fetch relevant contacts for the active load/incident
    let contacts = [];

    // 1. Contextual internal contacts
    if (active360Data?.load) {
      contacts.push({
        id: "c-driver",
        name: active360Data.driver?.name || "Driver",
        role: "Driver",
        phone: active360Data.driver?.phone || "888-555-0000",
      });
      contacts.push({
        id: "c-safety",
        name: "Safety Team",
        role: "Internal",
        phone: "800-SAFE-KCI",
      });
    }

    // 2. Supplement with Enterprise Directory contacts
    const directoryContacts = allContacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.type,
      phone: c.phone,
    }));

    contacts = [...contacts, ...directoryContacts];

    setNotificationContacts(contacts);
    setShowNotifyPicker(true);
  };

  const automatedStakeholderNotify = async (
    loadId: string,
    emails: string[],
    message: string,
  ) => {
    const jobId = `AUTO-JOB-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Log the system action
    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: "SYSTEM-AI",
      actorName: "Intelligence Engine",
      message: `AUTOMATED ALERT: Stakeholders notified for Load #${loadId}: ${message}`,
      payload: {
        category: "Communications",
        action: "AutoNotify",
        loadId,
        emails,
      },
    });

    // Mirror the notification job in storage for audit
    const job: NotificationJob = {
      id: jobId,
      loadId,
      recipients: emails.map((e) => ({
        id: e,
        name: e,
        role: "Stakeholder",
        phone: "",
      })),
      message: message,
      channel: "Email",
      status: "SENT",
      sentBy: "SYSTEM",
      sentAt: new Date().toISOString(),
    };
    await saveNotificationJob(job);
  };

  const sendNotificationJob = async () => {
    if (selectedContacts.length === 0) {
      setSuccessMessage(
        "PROTOCOL ERROR: Recipient selection required for broadcast.",
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }

    const jobId = `JOB-${uuidv4().slice(0, 8).toUpperCase()}`;
    const job: NotificationJob = {
      id: jobId,
      loadId: active360Data?.load?.id,
      incidentId:
        activeRecord.type === "INCIDENT" ? activeRecord.id : undefined,
      recipients: selectedContacts.map((cId) => {
        const contact = notificationContacts.find((nc) => nc.id === cId);
        return {
          id: cId,
          name: contact?.name || "Unknown",
          role: contact?.role || "Partner",
          phone: contact?.phone || "",
        };
      }),
      message: notificationMessage,
      channel: "Multi",
      status: "SENT",
      sentBy: user.id,
      sentAt: new Date().toISOString(),
    };

    await saveNotificationJob(job);

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Broadcasting emergency alerts to ${selectedContacts.length} partners via ${jobId}: ${notificationMessage}`,
      payload: {
        category: "Safety",
        action: "NotificationJob",
        jobId,
        recipients: selectedContacts,
        notes: notificationMessage,
        loadId: active360Data?.load?.id,
      },
    });

    if (activeRecord.type === "INCIDENT") {
      const updated = { ...active360Data.incident };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "STAKEHOLDERS_NOTIFIED",
          notes: `Notified ${selectedContacts.length} partners via job ${jobId}. Message: ${notificationMessage}`,
        },
      ];
      await saveIncident(updated);
      await fetchQueues();
    }

    setShowNotifyPicker(false);
    setSuccessMessage("Stakeholders Notified via Multi-Channel Protocol");

    const data = await getRecord360Data(activeRecord.type, activeRecord.id);
    setActive360Data(data);
  };

  const handleRoadsideAssist = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    if (!loadId) return;

    // KCI Enhancement: Use Modal instead of prompt
    setShowRoadsideForm(true);
  };

  const submitRoadsideDispatch = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    if (!selectedVendorForRoadside || !loadId) {
      setSuccessMessage(
        "SYSTEM ERROR: Valid vendor selection required for roadside dispatch.",
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }

    const ticketId = `ST-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const ticket: ServiceTicket = {
      id: ticketId,
      unitId: active360Data?.load?.truckNumber || "UNKNOWN",
      type: "Breakdown",
      status: "Assigned",
      priority:
        activeRecord.type === "INCIDENT"
          ? active360Data?.incident?.severity || "High"
          : "Medium",
      description:
        roadsideNotes ||
        (activeRecord.type === "INCIDENT"
          ? active360Data?.incident?.description
          : "Roadside assistance requested"),
      estimatedCost: 0,
      assignedVendorId: selectedVendorForRoadside.id,
      eta: "45-60 mins",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveServiceTicket(ticket);

    // Record Emergency Charge (Financial Audit)
    if (activeRecord.type === "INCIDENT") {
      try {
        await fetch(`/api/incidents/${activeRecord.id}/charges`, {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            category: "Tow",
            amount: 0,
            provider_vendor: selectedVendorForRoadside.name,
            status: "Approved",
          }),
        });
      } catch (e) {
        console.warn(
          "Failed to record emergency charge:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    await handleActionLogging({
      id: uuidv4(),
      type: "TASK",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Dispatched ${selectedVendorForRoadside.name}: ${ticketId} for Unit ${ticket.unitId}`,
      payload: {
        category: "Safety",
        action: "RoadsideAssist",
        loadId,
        ticketId,
        vendor: selectedVendorForRoadside.name,
        notes: roadsideNotes,
      },
    });

    if (activeRecord.type === "INCIDENT") {
      const updated = { ...active360Data.incident };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "ROADSIDE_DISPATCHED",
          notes: `Vendor ${selectedVendorForRoadside.name} dispatched for roadside assistance. Ref: ${ticketId}. Contact: ${selectedVendorForRoadside.contacts?.[0]?.phone || "N/A"}`,
        },
      ];
      await saveIncident(updated);
    }

    await fetchQueues();
    setShowRoadsideForm(false);
    setSuccessMessage(
      `Roadside Assistance Dispatched: ${selectedVendorForRoadside.name}`,
    );
    setTimeout(() => setSuccessMessage(null), 4000);

    const data = await getRecord360Data(activeRecord.type, activeRecord.id);
    setActive360Data(data);
  };

  const handleEscalate = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    setSuccessMessage("Escalating to Leadership...");

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `URGENT ESCALATION: ${activeRecord.type} ${activeRecord.id} escalated by ${user.name}`,
      loadId: typeof loadId === "string" ? loadId : undefined,
      payload: {
        category: "Workflow",
        action: "Escalate",
        priority: "CRITICAL",
      },
    });

    if (activeRecord.type === "INCIDENT" && active360Data?.incident) {
      const updated = {
        ...active360Data.incident,
        severity: "Critical" as const,
      };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "INCIDENT_ESCALATED",
          notes: "Escalated to management via Command Center",
        },
      ];
      await saveIncident(updated);
      await fetchQueues();
      const fresh = await getRecord360Data(activeRecord.type, activeRecord.id);
      setActive360Data(fresh);
    }
  };

  const handleFullLockdown = async () => {
    if (
      !window.confirm(
        "CRITICAL: Initiating Full Operational Lockdown for this record. Confirm?",
      )
    )
      return;

    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    setSuccessMessage("PROTOCOL: FULL LOCKDOWN INITIATED");

    await handleActionLogging({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `!!! LOCKDOWN !!! ${activeRecord.type} ${activeRecord.id} locked by security protocol`,
      loadId: typeof loadId === "string" ? loadId : undefined,
      payload: { category: "Security", action: "Lockdown", status: "LOCKED" },
    });

    if (activeRecord.type === "INCIDENT" && active360Data?.incident) {
      const updated = { ...active360Data.incident, status: "Closed" as const }; // Or some 'Locked' status if it existed
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "SECURITY_LOCKDOWN",
          notes: "Full operational lockdown triggered",
        },
      ];
      await saveIncident(updated);
      await fetchQueues();
      const fresh = await getRecord360Data(activeRecord.type, activeRecord.id);
      setActive360Data(fresh);
    }
  };

  const handleVerifyTrailerDrop = async () => {
    const loadId =
      activeRecord?.type === "LOAD" ? activeRecord.id : active360Data?.load?.id;
    if (!loadId) {
      setSuccessMessage("No related load found to verify drop");
      return;
    }

    await onRecordAction({
      id: uuidv4(),
      type: "EQUIPMENT_EVENT",
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      message: `Trailer Drop Verified for Load ${activeRecord.label}`,
      payload: { event: "TRAILER_DROP_VERIFIED", status: "COMPLETED", loadId },
    });

    if (activeRecord.type === "INCIDENT" && active360Data?.incident) {
      const updated = { ...active360Data.incident };
      updated.timeline = [
        ...(updated.timeline || []),
        {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: "EQUIPMENT_VERIFIED",
          notes: `Trailer drop verified for linked Load ${loadId}`,
        },
      ];
      await saveIncident(updated);
    }

    setSuccessMessage("Trailer Drop Verified");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Mock stats
  const stats = activeLoad
    ? {
        driver: { name: "John Doe" },
        customer: {
          name: "Global Logistics",
          loadCount: 45,
          onTime: "98%",
          revenue: 125000,
        },
      }
    : null;

  // Simplified user access
  const incomingCallSource = {
    id: "D-101",
    name: "Trucker Tom",
    type: "DRIVER",
  };

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
    const mockCallers = [
      { id: "D-5501", name: "Mike Thompson", role: "DRIVER", team: "DISPATCH" },
      {
        id: "B-2209",
        name: "Choptank Logistics",
        role: "BROKER",
        team: "OPERATIONS",
      },
      {
        id: "P-9901",
        name: "Blue Star Towing",
        role: "PROVIDER",
        team: "SAFETY",
      },
    ];
    const randomCaller =
      mockCallers[Math.floor(Math.random() * mockCallers.length)];

    const newCall: CallSession = {
      id: `CALL-IN-${uuidv4().slice(0, 4).toUpperCase()}`,
      startTime: new Date().toISOString(),
      status: "WAITING",
      participants: [randomCaller],
      lastActivityAt: new Date().toISOString(),
      links: [],
      team: randomCaller.team,
    };
    await saveCallSession(newCall);
    const queues = await getTriageQueues();
    setTriageQueues((prev) => ({ ...prev, calls: [...queues.calls] }));
    setSuccessMessage(
      `Tactical Inbound Initiated: ${randomCaller.name} (${randomCaller.role})`,
    );
  };

  const RecordPicker = ({ onSelect, selectedRecord }: any) => (
    <div
      className="bg-slate-950 border border-white/10 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-blue-500/50"
      onClick={() =>
        onSelect({ id: "LOAD-123", label: "LOAD-123", type: "LOAD" })
      }
    >
      <span className="text-xs text-white">
        {selectedRecord?.label || "Select Record..."}
      </span>
      <Search className="w-4 h-4 text-slate-500" />
    </div>
  );

  const ActionGroup = ({
    label,
    color,
    actions,
    icon: Icon,
  }: {
    label: string;
    color: string;
    actions: any[];
    icon?: any;
  }) => (
    <div
      className={`px-2 rounded-2xl border border-white/5 flex items-center gap-1 bg-white/[0.03] backdrop-blur-md transition-all ${isHighObstruction ? "py-0.5" : "py-1.5"}`}
    >
      <div
        className={`px-2.5 py-1.5 rounded-xl bg-${color}-500/10 text-${color}-400 text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 border border-${color}-500/10 ${isHighObstruction ? "scale-90 origin-left" : ""}`}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="flex gap-0.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.action}
            className={`hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all group flex items-center gap-2 ${isHighObstruction ? "p-1" : "p-1.5"}`}
            title={a.label}
          >
            <a.icon
              className={`${isHighObstruction ? "w-3 h-3" : "w-4 h-4"} opacity-70 group-hover:opacity-100 group-hover:text-blue-400`}
            />
            <span className="text-[10px] font-black uppercase hidden group-hover:inline-block whitespace-nowrap tracking-wide">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

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

  const ContextCard = ({
    title,
    icon: Icon,
    color,
    children,
    onAction,
  }: {
    title: string;
    icon: any;
    color: string;
    children: React.ReactNode;
    onAction?: () => void;
  }) => (
    <div className="p-4 bg-white/[0.03] backdrop-blur-xl rounded-[1.75rem] border border-white/5 space-y-4 relative overflow-hidden group hover:border-white/10 transition-all shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-400 border border-${color}-500/10 shadow-[0_0_15px_rgba(var(--${color}-500-rgb),0.1)]`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <h4 className="text-[11px] font-black text-white uppercase tracking-[0.1em]">
            {title}
          </h4>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-600 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="space-y-1.5 px-0.5">{children}</div>
    </div>
  );

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

  const TriageItem: React.FC<{
    item: any;
    type: string;
    onClick: () => void | Promise<void>;
  }> = ({ item, type, onClick }) => {
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

    const handleAction = async (
      action: "TAKE" | "ASSIGN" | "SNOOZE" | "ESCALATE",
      e: React.MouseEvent,
    ) => {
      e.stopPropagation();
      const timestamp = new Date().toISOString();

      if (action === "SNOOZE") {
        setSnoozedIds((prev) => new Set([...prev, item.id]));
        setSuccessMessage(`Record ${item.id} Snoozed for 1 hour`);
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
        setSuccessMessage(`Record ${item.id} Assigned to You`);
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
        setSuccessMessage(`Record ${item.id} ESCALATED TO LEADERSHIP`);
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
      setTimeout(() => setSuccessMessage(null), 3000);
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
                item.timestamp ||
                  item.reportedAt ||
                  item.createdAt ||
                  Date.now(),
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
                    handleAction("TAKE", e);
                  }}
                  className={`${isHighObstruction ? "px-2 py-1 text-[8px]" : "px-2.5 py-1.5 text-[9px]"} bg-blue-600/90 hover:bg-blue-500 font-black text-white rounded-xl uppercase transition-all shadow-lg shadow-blue-900/20 active:scale-95`}
                >
                  Take
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction("ESCALATE", e);
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
                onClick={(e) => handleAction("SNOOZE", e)}
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

  return (
    <div className="flex h-full w-full bg-[#0a0c10] overflow-hidden text-slate-300 font-inter relative">
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
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
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
                  className={`w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 ${isHighObstruction ? "py-1 text-[11px] font-black" : "py-2 text-[10px]"} text-white outline-none focus:border-indigo-500/50 transition-all`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 border-b border-white/5 bg-slate-900/50">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
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
                              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                {res.subLabel}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {res.chips?.map((chip) => (
                              <span
                                key={chip.label}
                                className="px-2 py-0.5 bg-slate-900 border border-white/5 text-[7px] font-black text-slate-400 uppercase rounded"
                              >
                                {chip.label}
                              </span>
                            ))}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
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
                { label: "FEED", tab: "messaging" },
                { label: "COMMAND", tab: "command" },
                { label: "SALES/CRM", tab: "crm" },
                { label: "SAFETY", tab: "safety" },
                { label: "NETWORK", tab: "directory" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setSelectedTab(chip.tab)}
                  className={`text-[10px] font-black uppercase tracking-widest transition-all border-b pb-1 ${selectedTab === chip.tab ? "text-blue-400 border-blue-400/50" : "text-slate-500 border-transparent hover:text-blue-400 hover:border-blue-400/50"}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              className="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white"
              onClick={onClose}
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
                  actions={[
                    {
                      label: "Inbound Call",
                      icon: PhoneCall,
                      action: handleInitiateGlobalInbound,
                    },
                    {
                      label: "Seed System",
                      icon: Zap,
                      action: handleSystemSeed,
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
                        setSuccessMessage(
                          "FINANCIAL PROTOCOL: High-value exception authorized for settlement queue.",
                        );
                        setTimeout(() => setSuccessMessage(null), 4000);
                      },
                    },
                  ]}
                />
              )}
              <ActionGroup
                label="Quick Actions"
                color="orange"
                icon={Zap}
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
                  setSuccessMessage={setSuccessMessage}
                />
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

              {selectedTab === "safety" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617]">
                  <SafetyView
                    user={user}
                    loads={loads}
                    incidents={triageQueues.incidents}
                    onRecordAction={onRecordAction}
                    openRecordWorkspace={handleOpenWorkspace}
                    onSaveIncident={async (inc) => {
                      await coreCreateIncident(inc);
                      await fetchQueues();
                      setSuccessMessage(
                        "CRISIS PROTOCOL INITIATED: Incident Logged & Triage Updated",
                      );
                    }}
                  />
                </div>
              )}

              {selectedTab === "directory" && (
                <div className="flex-1 overflow-y-auto no-scrollbar bg-[#020617]">
                  <NetworkPortal companyId={user.companyId} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT RAIL: PERSISTENT TRIAGE QUEUES */}
      <aside
        className={`absolute right-0 top-0 bottom-0 z-[100] ${rightRailCollapsed ? "w-16" : "w-96"} border-l border-white/5 flex flex-col bg-[#05070a] transition-all duration-300 group/right shadow-2xl overflow-hidden`}
      >
        <button
          onClick={() => setRightRailCollapsed(!rightRailCollapsed)}
          className="absolute left-4 top-14 z-30 w-8 h-8 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-xl"
        >
          {rightRailCollapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <div
          className={`flex-1 flex flex-col overflow-hidden ${rightRailCollapsed ? "items-center pt-20" : ""}`}
        >
          {!rightRailCollapsed ? (
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
                      onClick={handleInitiateGlobalInbound}
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
                        c.participants.some((p) =>
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
                        onClick={() => {
                          const primary = call.links?.find(
                            (l: any) => l.isPrimary,
                          );
                          if (primary)
                            handleOpenWorkspace(
                              primary.entityType,
                              primary.entityId,
                              "TIMELINE",
                            );
                          else setInteractionState("ACTIVE");
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
                        onClick={() => handleOpenWorkspace("INCIDENT", inc.id)}
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
                            !snoozedIds.has(wi.id) &&
                            wi.priority === "Critical",
                        ).length,
                    },
                    {
                      id: "SUPPORT",
                      label: "Operational Support",
                      count:
                        triageQueues.requests.filter(
                          (r) => !snoozedIds.has(r.id),
                        ).length +
                        triageQueues.workItems.filter(
                          (wi) =>
                            !snoozedIds.has(wi.id) &&
                            wi.priority !== "Critical",
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
                      onClick={() =>
                        setActiveTriageTab(tab.id as typeof activeTriageTab)
                      }
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
                            onClick={() =>
                              handleOpenWorkspace(
                                "INCIDENT",
                                inc.id,
                                "TIMELINE",
                              )
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
                            onClick={() =>
                              handleOpenWorkspace(
                                wi.entityType as EntityType,
                                wi.entityId,
                                wi.type.includes("Detention")
                                  ? "DETENTION"
                                  : "TIMELINE",
                              )
                            }
                          />
                        ))}
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
                            onClick={() =>
                              handleOpenWorkspace(
                                "LOAD",
                                req.loadId!,
                                "FINANCE",
                              )
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
                            onClick={() =>
                              handleOpenWorkspace(
                                wi.entityType as EntityType,
                                wi.entityId,
                                wi.type.includes("Detention")
                                  ? "DETENTION"
                                  : "TIMELINE",
                              )
                            }
                          />
                        ))}
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
                              onClick={() =>
                                handleOpenWorkspace("LOAD", load.id, "TIMELINE")
                              }
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSafetyEscalate(load);
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
                            onClick={() =>
                              handleOpenWorkspace(
                                "LOAD",
                                task.loadId,
                                "TIMELINE",
                              )
                            }
                          />
                        ))}
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

      {/* MODALS */}
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
                value={handoffData.notes}
                onChange={(e) =>
                  setHandoffData({ ...handoffData, notes: e.target.value })
                }
              ></textarea>
              <button
                onClick={async () => {
                  if (!handoffData.assignedTo)
                    return alert("Select an operator for handoff");
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

                  onRecordAction({
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
                  setSuccessMessage(
                    `Operational Handoff Committed to ${assignedUser.name}`,
                  );
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Entity Type
                  </label>
                  <select
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Category
                  </label>
                  <select
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Notes
                </label>
                <textarea
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
                  setSuccessMessage("Operational Log Saved");
                  setTimeout(() => setSuccessMessage(null), 3000);
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Task Title
                </label>
                <input
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Assignee
                </label>
                <select
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
                  if (!taskData.title) return alert("Title required");
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
                  setSuccessMessage("Task Created");
                  setTimeout(() => setSuccessMessage(null), 3000);
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Category
                </label>
                <select
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Description
                </label>
                <textarea
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
                  if (!issueData.description)
                    return alert("Description required");
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
                  setSuccessMessage("Issue Logged");
                  setTimeout(() => setSuccessMessage(null), 3000);
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
                  <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">
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
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                  Asset Context (Required)
                </label>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-[13px] text-white font-bold outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-800"
                    placeholder="SEARCH LOAD, CUSTOMER, OR DRIVER..."
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
                              <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">
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
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                    Type Designation
                  </label>
                  <select
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
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                    Quantum (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 text-xs font-black font-mono">
                      $
                    </span>
                    <input
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
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                  Mission Justification
                </label>
                <textarea
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
                    className={`px-4 py-4 text-[9px] font-black uppercase tracking-widest transition-all relative ${directoryTab === tab ? "text-blue-400" : "text-slate-500 hover:text-white"}`}
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
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-xs text-white outline-none focus:border-blue-500/50"
                  value={directorySearchQuery}
                  onChange={(e) => setDirectorySearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/10 rounded-lg">
                              PRO: {provider.type}
                            </span>
                            {provider.is247 && (
                              <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-green-500/20 text-green-400 border border-green-500/10 rounded-lg">
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
                          {provider.capabilities.map((c) => (
                            <span
                              key={c}
                              className="px-2.5 py-1 bg-white/[0.05] rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="flex items-center gap-1.5 font-bold uppercase tracking-tight">
                          <MapPin className="w-4 h-4 text-slate-600" />{" "}
                          {provider.coverage.regions?.join(", ") ||
                            "Global Network"}
                        </p>
                      </div>
                      <div className="flex gap-2 relative z-10">
                        <button
                          onClick={() => {
                            setInteractionState("ACTIVE");
                            setSelectedTab("messaging");
                            setSuccessMessage(
                              `Directing Link to ${provider.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Phone className="w-3 h-3 text-blue-400" /> Call
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("messaging");
                            setSuccessMessage(
                              `Opening Liaison Thread for ${provider.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
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
                            <p className="text-[9px] font-bold text-slate-500 uppercase">
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
                allContacts
                  .filter(
                    (c) =>
                      !directorySearchQuery ||
                      c.name
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
                            {contact.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white uppercase">
                              {contact.name}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-500 uppercase">
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
                            setSuccessMessage(
                              `Directing Link to ${contact.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all border border-white/5"
                        >
                          Call
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("messaging");
                            setSuccessMessage(
                              `Opening SMS Channel for ${contact.name}...`,
                            );
                          }}
                          className="flex-1 py-3 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all border border-white/5"
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
                        setSuccessMessage(
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
      {/* REPOWER SELECTION PANEL */}
      {showRepowerPanel && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#050810]/90 backdrop-blur-xl"
            onClick={() => setShowRepowerPanel(false)}
          />
          <div className="relative w-full max-w-4xl bg-[#0a0c10] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="h-24 shrink-0 px-10 flex items-center justify-between border-b border-white/5 bg-slate-950/50">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <RefreshCw className="w-6 h-6 text-white animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                    Strategic Repower Handoff
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      Load Context:
                    </span>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2 py-0.5 bg-blue-500/10 rounded">
                      #
                      {loads.find((l) => l.id === repowerLoadId)?.loadNumber ||
                        "PENDING"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRepowerPanel(false)}
                className="p-3 hover:bg-white/5 rounded-2xl transition-all group"
              >
                <X className="w-6 h-6 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Target Load Summary */}
              <div className="w-80 border-r border-white/5 bg-slate-950/20 p-8 space-y-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Active Incident
                  </h4>
                  <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2 text-red-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[11px] font-black uppercase">
                        Mechanical Breakdown
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">
                      Vehicle stationary on I-90 EB. Asset rescue required for
                      hot delivery.
                    </p>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Current Location
                  </h4>
                  <div className="flex items-center gap-3 text-white">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-tight">
                      Chicago, IL (I-90 Shoulder)
                    </span>
                  </div>
                </section>
              </div>

              {/* Right: Driver Availability & Scoreboard */}
              <div className="flex-1 flex flex-col bg-slate-950/40">
                <div className="h-14 px-8 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Available Capacity Near Exception Site
                  </span>
                  <div className="flex items-center gap-4 text-[9px] font-black uppercase text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />{" "}
                      High Match
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />{" "}
                      Caution
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-4">
                  {isSearchingMatches ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-6">
                      <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
                        Querying Fleet Intelligence...
                      </span>
                    </div>
                  ) : (
                    repowerMatches.slice(0, 10).map((match: any) => (
                      <div
                        key={match.driverId}
                        className="p-6 bg-[#111827]/40 border border-white/5 rounded-[2rem] hover:border-blue-500/40 transition-all group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className={`p-4 rounded-2xl bg-slate-900 border border-white/5 group-hover:border-blue-500/20 text-white font-black text-lg transition-all ${match.recommendation === "STRONG_MATCH" ? "shadow-[0_0_20px_rgba(59,130,246,0.15)] text-blue-400" : ""}`}
                            >
                              {match.matchScore}%
                            </div>
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                              Match
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">
                              {match.driverName}
                            </h4>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {match.distanceToPickup} Mi away
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {match.hosAvailable}h HOS
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-orange-500" />
                                <span className="text-[9px] font-bold text-orange-500 uppercase">
                                  ETA:{" "}
                                  {new Date(
                                    match.estimatedArrival,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            executeRepowerHandoff(
                              match.driverId,
                              match.driverName,
                            )
                          }
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0"
                        >
                          Assign Handoff
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer Status */}
            <div className="h-12 bg-slate-950/60 border-t border-white/5 px-10 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">
                Authorized Operation: Dispatch Integrity Override
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[9px] font-black text-blue-500/80 uppercase">
                    Telemetry Link: Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDocForm && (
        <div className="absolute inset-0 z-[1000] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-[#0a0f18] border border-slate-800 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
            {/* Header Section */}
            <div className="bg-slate-900 border-b border-slate-800 px-8 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">
                    Electronic Record Injection
                  </h3>
                  <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                    Status: Pending Verification
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDocForm(false)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500 hover:text-white" />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto no-scrollbar">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                  Subspace Target
                </label>
                <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-4">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest font-mono">
                      {session.primaryContext?.type === "LOAD"
                        ? `MANIFEST #${activeRecord?.data?.load?.loadNumber}`
                        : "Select Operational Target..."}
                    </span>
                  </div>
                  <span className="text-[7px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 uppercase tracking-tighter">
                    LINKED
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-12 border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-5 hover:border-blue-500 transition-all cursor-pointer group bg-slate-950/20 hover:bg-blue-600/5 shadow-inner">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                    <Plus className="w-8 h-8 text-slate-700 group-hover:text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2 group-hover:text-blue-500 transition-colors">
                      Inject Image/PDF Artifact
                    </p>
                    <p className="text-[8px] font-bold text-slate-700 uppercase tracking-widest leading-loose">
                      BOL, POD, RATE CON, INVOICE SOURCE
                      <br />
                      (Max 25MB Multi-Layer)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                  Discrepancy Log (Optional)
                </label>
                <textarea
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-[11px] font-bold text-slate-400 h-28 resize-none outline-none focus:border-blue-500 transition-all shadow-inner no-scrollbar"
                  placeholder="SPECIFY ANY OSD OR CARGO DISCREPANCIES DETECTED DURING INTAKE..."
                ></textarea>
              </div>
            </div>

            {/* Footer Section */}
            <div className="p-8 bg-slate-900 border-t border-slate-800 flex justify-end items-center gap-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => setShowDocForm(false)}
                className="px-8 py-4 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
              >
                Discard View
              </button>
              <button
                onClick={async () => {
                  await onRecordAction({
                    id: uuidv4(),
                    type: "DOCUMENT",
                    timestamp: new Date().toISOString(),
                    actorId: user.id,
                    actorName: user.name,
                    message:
                      "Bill of Lading (BOL) Submitted via Driver Interface",
                    loadId:
                      session.primaryContext?.type === "LOAD"
                        ? session.primaryContext.id
                        : undefined,
                    payload: {
                      docType: "BOL",
                      status: "SUBMITTED",
                      source: "MOBILE_INTAKE",
                    },
                  });
                  setShowDocForm(false);
                  setSuccessMessage("BOL Successfully Uploaded to Depository");
                  setTimeout(() => setSuccessMessage(null), 3000);
                }}
                className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-lg shadow-indigo-900/40 active:scale-95 transition-all outline-none"
              >
                Authorize Depository Push
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifyPicker && (
        <div className="absolute inset-0 z-[1200] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Bell className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black text-white uppercase tracking-widest italic">
                    Multi-Channel Stakeholder Alert
                  </h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Select recipients for emergency broadcast
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifyPicker(false)}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                {notificationContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      if (selectedContacts.includes(contact.id)) {
                        setSelectedContacts((prev) =>
                          prev.filter((id) => id !== contact.id),
                        );
                      } else {
                        setSelectedContacts((prev) => [...prev, contact.id]);
                      }
                    }}
                    className={`p-4 border rounded-2xl flex items-center gap-4 transition-all text-left ${selectedContacts.includes(contact.id) ? "bg-blue-600/10 border-blue-500/50 shadow-lg" : "bg-white/5 border-white/5 hover:border-white/10"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${selectedContacts.includes(contact.id) ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500"}`}
                    >
                      {contact.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white uppercase truncate">
                        {contact.name}
                      </div>
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                        {contact.role}
                      </div>
                    </div>
                    {selectedContacts.includes(contact.id) && (
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                    )}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                  Emergency Briefing
                </label>
                <textarea
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-[11px] font-medium text-slate-300 h-32 resize-none outline-none focus:border-blue-500 transition-all shadow-inner"
                  placeholder="Enter the message for broadcast..."
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-8 bg-slate-900 border-t border-white/5 flex justify-end items-center gap-6">
              <button
                onClick={() => setShowNotifyPicker(false)}
                className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendNotificationJob}
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3"
              >
                <Zap className="w-4 h-4" /> Trigger Alert Job
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoadsideForm && (
        <div className="absolute inset-0 z-[1200] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-500">
            <div className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black text-white uppercase tracking-widest italic">
                    Roadside Recovery Dispatch
                  </h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Select vendor for mission-critical repair
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoadsideForm(false)}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                  Verified Vendor Network
                </label>
                <div className="space-y-3">
                  {getVendors().map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => setSelectedVendorForRoadside(vendor)}
                      className={`w-full p-5 border rounded-2xl flex items-center justify-between transition-all ${selectedVendorForRoadside?.id === vendor.id ? "bg-orange-600/10 border-orange-500/50 shadow-lg" : "bg-white/5 border-white/5 hover:border-white/10"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedVendorForRoadside?.id === vendor.id ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-500"}`}
                        >
                          <Truck className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-black text-white uppercase">
                            {vendor.name}
                          </div>
                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                            {vendor.type} • {vendor.status}
                          </div>
                        </div>
                      </div>
                      {selectedVendorForRoadside?.id === vendor.id && (
                        <CheckCircle className="w-4 h-4 text-orange-500" />
                      )}
                    </button>
                  ))}
                  <button className="w-full p-5 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:border-blue-500/50 hover:text-blue-500 transition-all flex items-center justify-center gap-3">
                    <Plus className="w-4 h-4" /> Add Temporary Vendor
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                  Tactical Damage Report
                </label>
                <textarea
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-[11px] font-medium text-slate-300 h-24 resize-none outline-none focus:border-orange-500 transition-all shadow-inner"
                  placeholder="Specify repair requirements..."
                  value={roadsideNotes}
                  onChange={(e) => setRoadsideNotes(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-8 bg-slate-900 border-t border-white/5 flex justify-end items-center gap-6">
              <button
                onClick={() => setShowRoadsideForm(false)}
                className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Abort Dispatch
              </button>
              <button
                onClick={submitRoadsideDispatch}
                className="px-10 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-3"
              >
                <Navigation className="w-4 h-4" /> Authorize & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

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
