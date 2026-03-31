import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import ConnectionBanner from "./components/ui/ConnectionBanner";
import { Toast } from "./components/Toast";
import {
  onUserChange,
  logout,
  getCompanyUsers,
  getEffectivePermissions,
  getCompany,
  seedDatabase,
  checkCapability,
} from "./services/authService";
import {
  getLoads,
  saveLoad,
  deleteLoad,
  getDispatchEvents,
  getTimeLogs,
  getIncidents,
  createIncident,
  saveIncidentAction,
  saveIncidentCharge,
  saveCallLog,
  saveIssue,
  saveRequest,
  updateRequestStatus,
  getLoadSummary,
  getDriverSummary,
  getBrokerSummary,
  linkSessionToRecord,
} from "./services/storageService";
import { getBrokers } from "./services/brokerService";
import {
  User,
  LoadData,
  Broker,
  RolePermissions,
  FreightType,
  PermissionCode,
  Capability,
  UserRole,
  Company,
  DispatchEvent,
  TimeLog,
  Incident,
  IncidentAction,
  KCIRequest,
  CallSession,
  LoadExpense,
  OperationalEvent,
  WorkspaceSession,
  ContextRecord,
  EntityType,
} from "./types";
const Auth = React.lazy(() =>
  import("./components/Auth").then((m) => ({ default: m.Auth })),
);
const LoadBoardEnhanced = React.lazy(() =>
  import("./components/LoadBoardEnhanced").then((m) => ({
    default: m.LoadBoardEnhanced,
  })),
);
const EditLoadForm = React.lazy(() =>
  import("./components/EditLoadForm").then((m) => ({
    default: m.EditLoadForm,
  })),
);
const CalendarView = React.lazy(() =>
  import("./components/CalendarView").then((m) => ({
    default: m.CalendarView,
  })),
);
const CompanyProfile = React.lazy(() =>
  import("./components/CompanyProfile").then((m) => ({
    default: m.CompanyProfile,
  })),
);
const LoadDetailView = React.lazy(() =>
  import("./components/LoadDetailView").then((m) => ({
    default: m.LoadDetailView,
  })),
);
const LoadSetupModal = React.lazy(() =>
  import("./components/LoadSetupModal").then((m) => ({
    default: m.LoadSetupModal,
  })),
);
const QuoteManager = React.lazy(() =>
  import("./components/QuoteManager").then((m) => ({
    default: m.QuoteManager,
  })),
);
import {
  Calendar,
  LogOut,
  Plus,
  Menu,
  X,
  Truck,
  AlertTriangle,
  Building2,
  Zap,
  Search,
  Globe,
  ChevronLeft,
  Radio,
} from "lucide-react";
const Scanner = React.lazy(() =>
  import("./components/Scanner").then((m) => ({ default: m.Scanner })),
);
const DriverMobileHome = React.lazy(() =>
  import("./components/DriverMobileHome").then((m) => ({
    default: m.DriverMobileHome,
  })),
);
const CustomerPortalView = React.lazy(() =>
  import("./components/CustomerPortalView").then((m) => ({
    default: m.CustomerPortalView,
  })),
);
import { LoadingSkeleton } from "./components/ui/LoadingSkeleton";
import { SessionExpiredModal } from "./components/ui/SessionExpiredModal";
const AccountingPortal = React.lazy(
  () => import("./components/AccountingPortal"),
);
const IntelligenceHub = React.lazy(
  () => import("./components/IntelligenceHub"),
);
const ExceptionConsole = React.lazy(() =>
  import("./components/ExceptionConsole").then((m) => ({
    default: m.ExceptionConsole,
  })),
);
const CommsOverlay = React.lazy(() =>
  import("./components/CommsOverlay").then((m) => ({
    default: m.CommsOverlay,
  })),
);
const NetworkPortal = React.lazy(() =>
  import("./components/NetworkPortal").then((m) => ({
    default: m.NetworkPortal,
  })),
);
const TelematicsSetup = React.lazy(
  () => import("./components/TelematicsSetup"),
);
import { getRecord360Data } from "./services/storageService";
import { features } from "./config/features";

/** Navigation item with optional permission/capability/role gates. */
interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  permission?: PermissionCode;
  capability?: Capability;
  roles?: UserRole[];
}

/** Navigation category grouping NavItems. */
interface NavCategory {
  title: string;
  items: NavItem[];
}

/** Valid tab IDs for AccountingPortal. */
type AccountingPortalTab = "DASHBOARD" | "AR" | "AP" | "GL" | "IFTA" | "VAULT";

const LEGACY_TAB_ALIASES: Record<string, string> = {
  analytics: "operations-hub",
  audit: "operations-hub",
  brokers: "network",
  dashboard: "operations-hub",
  finance: "accounting",
  map: "operations-hub",
  safety: "exceptions",
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loads, setLoads] = useState<LoadData[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [dispatchEvents, setDispatchEvents] = useState<DispatchEvent[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  // Derive activeTab from the URL path (e.g. /loads -> "loads", / -> "operations-hub")
  const activeTab: string = (() => {
    const seg = location.pathname.replace(/^\//, "") || "operations-hub";
    return LEGACY_TAB_ALIASES[seg] ?? seg;
  })();

  const [activeSubTab, setActiveSubTab] = useState<
    AccountingPortalTab | string | undefined
  >();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [editingLoad, setEditingLoad] = useState<Partial<LoadData> | null>(
    null,
  );
  const [viewingLoad, setViewingLoad] = useState<LoadData | null>(null);
  const [showLoadSetup, setShowLoadSetup] = useState<{
    brokerId?: string;
  } | null>(null);
  const [potentialBroker, setPotentialBroker] = useState<
    Partial<Broker> | undefined
  >(undefined);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showIntelligenceHub, setShowIntelligenceHub] = useState(false);
  const [hubInitialTab, setHubInitialTab] = useState<
    | "feed"
    | "messaging"
    | "intelligence"
    | "reports"
    | "crm"
    | "safety"
    | "command"
    | "directory"
  >("command");
  const [hubInitialShowCallForm, setHubInitialShowCallForm] = useState(false);
  const [activeCallSession, setActiveCallSession] =
    useState<CallSession | null>(null);
  const [overlayState, setOverlayState] = useState<
    "floating" | "docked" | "collapsed"
  >("collapsed");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // GLOBAL WORKSPACE SESSION
  const [session, setSession] = useState<WorkspaceSession>({
    primaryContext: null,
    secondaryContexts: [],
    recentContexts: [],
    pinnedContexts: [],
    splitView: { enabled: false },
  });
  const [summary, setSummary] = useState<any>(null);
  const [refreshToast, setRefreshToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  // Session expired modal — shown on first auth:session-expired event.
  // A ref guards against multiple rapid 401s showing the modal more than once.
  const sessionExpiredFiredRef = React.useRef(false);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onUserChange(async (updatedUser) => {
      setUser(updatedUser);
      if (updatedUser) {
        await refreshData(updatedUser);
        setIsAuthReady(true);
      } else {
        setIsAuthReady(false);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowIntelligenceHub((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Listen for 401 session-expired events emitted by apiFetch()
    const handleSessionExpired = () => {
      if (!sessionExpiredFiredRef.current) {
        sessionExpiredFiredRef.current = true;
        setShowSessionExpiredModal(true);
      }
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  const refreshData = useCallback(
    async (currentUser: User) => {
      const results = await Promise.allSettled([
        getLoads(currentUser),
        getBrokers(currentUser.companyId),
        getCompanyUsers(currentUser.companyId),
        getCompany(currentUser.companyId),
        getDispatchEvents(currentUser.companyId),
        getTimeLogs(currentUser.companyId, true),
        getIncidents(),
      ]);

      const [
        loadsResult,
        brokersResult,
        usersResult,
        companyResult,
        eventsResult,
        logsResult,
        incidentsResult,
      ] = results;

      // Apply each result, falling back to current state on failure
      setLoads((prev) =>
        loadsResult.status === "fulfilled" ? loadsResult.value : prev,
      );
      setBrokers((prev) =>
        brokersResult.status === "fulfilled" ? brokersResult.value : prev,
      );
      setCompany((prev) =>
        companyResult.status === "fulfilled"
          ? companyResult.value || null
          : prev,
      );
      setDispatchEvents((prev) =>
        eventsResult.status === "fulfilled" ? eventsResult.value : prev,
      );
      setTimeLogs((prev) =>
        logsResult.status === "fulfilled" ? logsResult.value : prev,
      );
      setIncidents((prev) =>
        incidentsResult.status === "fulfilled" ? incidentsResult.value : prev,
      );
      if (
        ["admin", "dispatcher", "safety_manager", "payroll_manager"].includes(
          currentUser.role,
        )
      ) {
        setCompanyUsers((prev) =>
          usersResult.status === "fulfilled" ? usersResult.value : prev,
        );
      } else {
        setCompanyUsers([currentUser]);
      }

      // Show toast if any calls failed
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        setRefreshToast({
          message: "Some data could not be loaded. Please retry.",
          type: "error",
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user?.companyId],
  );

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    // refreshData is triggered by the onUserChange listener in useEffect
    if (features.seedSystem) {
      seedDatabase();
    }

    // Support Agile Workspace Entry
    if (loggedInUser.primaryWorkspace === "Quotes") {
      navigate("/quotes");
    } else if (loggedInUser.primaryWorkspace === "Dispatch") {
      navigate("/loads");
    } else {
      navigate("/operations-hub");
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthReady(false);
    setUser(null);
    setLoads([]);
    navigate("/");
  };

  const handleSaveLoad = async (load: LoadData) => {
    if (!user) return;
    await saveLoad(load, user);
    await refreshData(user);
    setIsAdding(false);
    setEditingLoad(null);
    setViewingLoad(null);
  };

  const handleNavigate = (tab: string, subTab?: string) => {
    const nextTab = LEGACY_TAB_ALIASES[tab] ?? tab;
    navigate("/" + nextTab);
    setActiveSubTab(subTab || undefined);
    setShowIntelligenceHub(false);
    setIsMobileMenuOpen(false);
    setEditingLoad(null);
    setIsAdding(false);
    setViewingLoad(null);
    setShowLoadSetup(null);
    setScanMode(false);
  };

  const permissions: RolePermissions = user
    ? getEffectivePermissions(user, company || undefined)
    : {};

  const handleRecordAction = async (event: OperationalEvent) => {
    if (!user) return;

    // Core Action Processing
    if (event.type === "CALL_LOG") {
      await saveCallLog({
        id: event.id,
        timestamp: event.timestamp,
        type: event.payload?.type || "Operational",
        category: event.payload?.category || "Update",
        entityId: event.loadId || "GLOBAL",
        notes: event.payload?.notes || event.message,
        recordedBy: event.actorName,
      });
    } else if (event.type === "ISSUE") {
      await saveIssue(
        {
          id: event.id,
          category: event.payload?.category || "Dispatch",
          description: event.payload?.description || event.message,
          reportedAt: event.timestamp,
          reportedBy: event.actorName,
          status: "Open",
        },
        event.loadId,
      );
    } else if (event.type === "INCIDENT") {
      const incidentPayload = event.payload;
      if (incidentPayload) await createIncident(incidentPayload);
    } else if (event.type === "REQUEST") {
      if (event.payload) await saveRequest(event.payload as KCIRequest);
    }

    await refreshData(user);

    // Update active context if data changed
    if (session.primaryContext) {
      const updatedData = await getRecord360Data(
        session.primaryContext.type,
        session.primaryContext.id,
      );
      setSession((prev) => ({
        ...prev,
        primaryContext: prev.primaryContext
          ? { ...prev.primaryContext, data: updatedData }
          : null,
      }));
    }
  };

  const openRecordWorkspace = async (
    type: EntityType,
    id: string,
    subTab?: string,
  ) => {
    const data = await getRecord360Data(type, id);
    const context: ContextRecord = {
      id,
      type,
      label:
        type === "LOAD"
          ? `LOAD #${data?.load?.loadNumber || id}`
          : `${type} ${id}`,
      data,
      timestamp: new Date().toISOString(),
      activeSubTab: subTab,
    };

    setSession((prev) => ({
      ...prev,
      primaryContext: context,
      recentContexts: [
        context,
        ...prev.recentContexts.filter((c) => c.id !== id),
      ].slice(0, 10),
    }));

    setShowIntelligenceHub(true);
    setOverlayState("floating");
    setSidebarCollapsed(true);

    // Fetch Summary
    if (type === "LOAD") setSummary(await getLoadSummary(id));
    else if (type === "DRIVER")
      setSummary(await getDriverSummary(id).catch(() => null));
    else if (type === "BROKER")
      setSummary(await getBrokerSummary(id).catch(() => null));
  };

  const handleCloseContext = () => {
    setSession((prev) => ({ ...prev, primaryContext: null }));
  };

  const handleLinkSessionToRecord = async (
    sessionId: string,
    recordId: string,
    recordType: EntityType,
  ) => {
    if (!user) return;
    await linkSessionToRecord(sessionId, recordId, recordType);
    await refreshData(user);
    if (session.primaryContext?.id === recordId) {
      await openRecordWorkspace(
        recordType,
        recordId,
        session.primaryContext.activeSubTab,
      );
    }
  };

  if (!user)
    return (
      <Suspense fallback={<LoadingSkeleton variant="card" count={1} />}>
        <Auth onLogin={handleLogin} />
      </Suspense>
    );

  if (!isAuthReady)
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );

  const categories: NavCategory[] = [
    {
      title: "OPERATIONS",
      items: [
        {
          id: "operations-hub",
          label: "Operations Center",
          icon: Zap,
          permission: "LOAD_DISPATCH",
          roles: ["admin", "dispatcher", "owner_operator", "safety_manager", "payroll_manager", "OPS", "OPS_MANAGER", "ORG_OWNER_SUPER_ADMIN", "OWNER_ADMIN", "DISPATCHER"],
        },
        {
          id: "loads",
          label: "Load Board",
          icon: Truck,
          permission: "LOAD_DISPATCH",
          capability: "LOAD_TRACK",
        },
        {
          id: "calendar",
          label: "Schedule",
          icon: Calendar,
          permission: "LOAD_DISPATCH",
          capability: "LOAD_TRACK",
        },
        { id: "network", label: "Onboarding", icon: Globe, roles: ["admin", "dispatcher", "owner_operator", "safety_manager", "payroll_manager", "OPS", "OPS_MANAGER", "ORG_OWNER_SUPER_ADMIN", "OWNER_ADMIN", "DISPATCHER"] },
        {
          id: "telematics-setup",
          label: "Telematics",
          icon: Radio,
          permission: "ORG_SETTINGS_VIEW",
          roles: ["admin", "dispatcher", "owner_operator", "safety_manager", "payroll_manager", "OPS", "OPS_MANAGER", "ORG_OWNER_SUPER_ADMIN", "OWNER_ADMIN", "DISPATCHER"],
        },
      ],
    },
    {
      title: "FINANCIALS",
      items: [
        {
          id: "accounting",
          label: "Financials",
          icon: Building2,
          permission: "INVOICE_CREATE",
        },
      ],
    },
    {
      title: "ADMIN",
      items: [
        { id: "exceptions", label: "Issues & Alerts", icon: AlertTriangle },
        {
          id: "company",
          label: "Company Settings",
          icon: Building2,
          permission: "ORG_SETTINGS_VIEW",
        },
      ],
    },
  ];

  // Filter categories and items based on roles, permissions, and capabilities
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (user?.role === "admin") return true;

        // Check role-based visibility
        if (item.roles && !item.roles.includes(user?.role as UserRole))
          return false;

        // Check Agile Capability
        if (
          item.capability &&
          !checkCapability(user!, item.capability, undefined, company)
        )
          return false;

        // Check Legacy Permission
        if (
          item.permission &&
          !permissions.permissions?.includes(item.permission!)
        )
          return false;

        return true;
      }),
    }))
    .filter((cat) => cat.items.length > 0);

  // 4. Global Overlay Elements (Accessible everywhere)
  const globalOverlays = (
    <>
      {showLoadSetup && (
        <Suspense fallback={<LoadingSkeleton variant="card" count={1} />}>
          <LoadSetupModal
            currentUser={user!}
            preSelectedBrokerId={showLoadSetup.brokerId}
            onContinue={(bid, did, ln, cn, oft, imd) => {
              setShowLoadSetup(null);
              setEditingLoad({
                brokerId: bid,
                driverId: did,
                loadNumber: ln,
                phoneCallNotes: cn,
                freightType: oft,
                ...imd,
              });
              setIsAdding(true);
              setScanMode(!ln);
            }}
            onCancel={() => setShowLoadSetup(null)}
          />
        </Suspense>
      )}

      {(isAdding || editingLoad) && scanMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-lg relative">
            <Suspense fallback={<LoadingSkeleton variant="card" count={1} />}>
              <Scanner
                onDataExtracted={(d, b) => {
                  setScanMode(false);
                  setEditingLoad((prev) => ({
                    ...prev,
                    ...d,
                    brokerId: prev?.brokerId || d.brokerId,
                  }));
                  setPotentialBroker(b);
                }}
                onCancel={() => setScanMode(false)}
              />
            </Suspense>
            <button
              onClick={() => {
                setIsAdding(false);
                setEditingLoad(null);
              }}
              className="absolute -top-10 right-0 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X />
            </button>
          </div>
        </div>
      )}

      {(isAdding || editingLoad) && !scanMode && (
        <div className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full h-full max-w-7xl">
            <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
              <EditLoadForm
                initialData={editingLoad || {}}
                onSave={handleSaveLoad}
                onCancel={() => {
                  setIsAdding(false);
                  setEditingLoad(null);
                }}
                currentUser={user}
                users={companyUsers}
                existingLoads={loads}
                canViewRates={permissions.showRates}
                canManageLegs={permissions.manageLegs}
                showBrokerDetails={permissions.showBrokerDetails}
                canCreateBroker={permissions.createBrokers}
                isRestrictedDriver={
                  !permissions.editCompletedLoads &&
                  (editingLoad?.status === "delivered" ||
                    editingLoad?.status === "completed")
                }
                potentialBroker={potentialBroker}
                onOpenHub={(tab, call) => {
                  setHubInitialTab(tab);
                  setHubInitialShowCallForm(!!call);
                  setShowIntelligenceHub(true);
                }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {viewingLoad && (
        <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
          <LoadDetailView
            load={viewingLoad}
            onClose={() => setViewingLoad(null)}
            onEdit={(l) => {
              setViewingLoad(null);
              setEditingLoad(l);
              setIsAdding(false);
            }}
            users={companyUsers}
            brokers={brokers}
            canViewRates={permissions.showRates}
            onOpenHub={(tab) => {
              setHubInitialTab(tab);
              setShowIntelligenceHub(true);
            }}
            onNavigate={(tab, context) => {
              setViewingLoad(null);
              handleNavigate(tab);
            }}
          />
        </Suspense>
      )}
    </>
  );

  // ROLE-GATE ROUTING (4-Apps-in-One Logic)
  let mainContent;

  // 1. Driver Mobile Experience
  if (user.role === "driver") {
    mainContent = (
      <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
        <DriverMobileHome
          user={user}
          company={company || undefined}
          loads={loads}
          onLogout={handleLogout}
          onSaveLoad={handleSaveLoad}
          onOpenHub={(tab) => {
            if (tab) setHubInitialTab(tab);
            setShowIntelligenceHub(true);
          }}
        />
      </Suspense>
    );
  }

  // 2. Customer Portal Experience
  else if (user.role === "customer") {
    mainContent = (
      <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
        <CustomerPortalView
          user={user}
          loads={loads}
          onOpenHub={(tab) => {
            if (tab) setHubInitialTab(tab);
            setShowIntelligenceHub(true);
          }}
        />
      </Suspense>
    );
  }

  // 3. Dispatcher / Admin Experience (Existing Operations Rack)
  else {
    mainContent = (
      <div className="absolute inset-0 w-full h-full flex bg-[#020617] text-slate-100 overflow-hidden">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-50 ${sidebarCollapsed ? "w-20" : "w-72"} bg-[#0a0f18] border-r border-slate-800 transform transition-all duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col group/sidebar`}
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/40">
            <div
              className={`flex items-center gap-3 font-black text-sm text-white tracking-widest uppercase overflow-hidden transition-all ${sidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}
            >
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
                <Truck className="w-4 h-4 text-white" />
              </div>
              LoadPilot
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label="Toggle sidebar"
              className={`hidden md:flex p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-all ${sidebarCollapsed ? "mx-auto rotate-180" : ""}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
              className="md:hidden text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-3 space-y-8 flex-1 overflow-y-auto no-scrollbar py-8">
            {filteredCategories.map((cat) => (
              <div key={cat.title} className="space-y-2">
                <h4 className="px-4 text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] mb-3 opacity-80">
                  {cat.title}
                </h4>
                <div className="space-y-1">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      (activeTab === item.id && !showIntelligenceHub) ||
                      (showIntelligenceHub &&
                        (item.id === "operations-hub" ||
                          item.id === "messaging"));
                    return (
                      <button
                        key={item.id}
                        data-testid={`nav-${item.id}`}
                        onClick={() => {
                          if (item.id === "messaging" || item.id === "call") {
                            setHubInitialTab(
                              item.id === "messaging" ? "messaging" : "crm",
                            );
                            if (item.id === "call")
                              setHubInitialShowCallForm(true);
                            setShowIntelligenceHub(true);
                          } else {
                            handleNavigate(item.id);
                          }
                          setIsMobileMenuOpen(false);
                          setIsAdding(false);
                        }}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isActive ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner" : "text-slate-500 hover:bg-slate-800/40 hover:text-slate-300"} ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-500" : "text-slate-500"}`}
                        />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-slate-800 bg-slate-900/30">
            <div
              className={`flex items-center gap-2.5 mb-3 px-1 overflow-hidden transition-all ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-inner">
                {user.name.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 overflow-hidden transition-all">
                  <div className="text-[10px] font-black text-white truncate tracking-wider uppercase">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    {user.role?.replace("_", " ") || "USER"}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 hover:bg-red-950/20 rounded-md transition-all ${sidebarCollapsed ? "justify-center px-0" : ""}`}
            >
              <LogOut className="w-3 h-3 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-950">
          {/* GLOBAL OPERATIONAL HEADER */}
          <header className="h-20 bg-[#0a0f18] border-b border-white/5 flex items-center justify-between px-10 shrink-0 z-30">
            <div className="flex items-center gap-10">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
                className="md:hidden text-slate-400 p-2 hover:bg-slate-800 rounded-xl"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="relative group w-[480px] hidden md:block">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="text"
                  placeholder="Search Loads, Teams, or Data (Ctrl+K)"
                  className="w-full bg-[#020617] border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-[12px] text-white outline-none focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 transition-all placeholder:text-slate-500"
                  onFocus={(e) => {
                    e.target.blur();
                    handleNavigate("operations-hub");
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => handleNavigate("operations-hub")}
                className={`px-6 py-3 rounded-2xl border transition-all flex items-center gap-4 group ${activeTab === "operations-hub" ? "bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-500/40" : "bg-slate-900 border-white/5 text-slate-500 hover:border-blue-500/30 hover:text-blue-400"}`}
              >
                <Zap
                  className={`w-4 h-4 ${showIntelligenceHub ? "fill-white" : "group-hover:fill-blue-400"}`}
                />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden lg:block">
                  Operations Center
                </span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden p-4 md:p-6 relative flex flex-col">
            <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
              {activeTab === "operations-hub" && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <IntelligenceHub
                    show={true}
                    user={user}
                    company={company || undefined}
                    loads={loads}
                    incidents={incidents}
                    users={companyUsers}
                    brokers={brokers}
                    session={session}
                    setSession={setSession}
                    onClose={() => handleNavigate("loads")}
                    onRecordAction={handleRecordAction}
                    initialTab={hubInitialTab}
                    initialShowCallForm={hubInitialShowCallForm}
                    initialCallSession={activeCallSession}
                    initialOverlayState={overlayState}
                    onNavigate={handleNavigate}
                    openRecordWorkspace={openRecordWorkspace}
                    onCloseContext={handleCloseContext}
                    onLinkSessionToRecord={handleLinkSessionToRecord}
                  />
                </Suspense>
              )}
              {activeTab === "exceptions" && (
                <Suspense
                  fallback={<LoadingSkeleton variant="list" count={3} />}
                >
                  <ExceptionConsole
                    currentUser={user}
                    initialView={activeSubTab}
                    onViewDetail={openRecordWorkspace}
                  />
                </Suspense>
              )}
              {activeTab === "quotes" && user && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <QuoteManager
                    user={user}
                    company={company}
                    onLoadCreated={() => refreshData(user)}
                  />
                </Suspense>
              )}
              {activeTab === "loads" && (
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center mb-6 shrink-0 relative z-40">
                    <h1 className="text-2xl font-bold text-white tracking-tighter uppercase">
                      Load Board
                    </h1>
                    {permissions.createLoads && (
                      <button
                        data-testid="team2-load-board-create-load"
                        onClick={() => setShowLoadSetup({})}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg"
                      >
                        <Plus className="w-5 h-5" /> Create Load
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    <Suspense
                      fallback={<LoadingSkeleton variant="list" count={5} />}
                    >
                      <LoadBoardEnhanced
                        loads={loads}
                        onView={(l) => {
                          setViewingLoad(l);
                          openRecordWorkspace("LOAD", l.id);
                        }}
                        onEdit={(load) => {
                          setEditingLoad(load);
                          setIsAdding(false);
                        }}
                        onDelete={async (id) => {
                          await deleteLoad(id);
                          await refreshData(user);
                        }}
                        canViewRates={checkCapability(
                          user,
                          "QUOTE_VIEW_MARGIN",
                          undefined,
                          company,
                        )}
                        onOpenHub={(tab, startCall) => {
                          setHubInitialTab(tab);
                          setHubInitialShowCallForm(!!startCall);
                          setShowIntelligenceHub(true);
                        }}
                        users={companyUsers}
                        brokers={brokers}
                        onCreateLoad={
                          permissions.createLoads
                            ? () => setShowLoadSetup({})
                            : undefined
                        }
                        testId="team2-load-board-shell"
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {activeTab === "calendar" && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <CalendarView
                    loads={loads}
                    onEdit={(l) => {
                      setEditingLoad(l);
                      setIsAdding(false);
                    }}
                    users={companyUsers}
                    selectedDriverId={selectedDriverId}
                    onSelectDriver={setSelectedDriverId}
                    onMoveLoad={(id, date) => {
                      const l = loads.find((x) => x.id === id);
                      if (l) handleSaveLoad({ ...l, pickupDate: date });
                    }}
                    testId="team2-schedule-shell"
                  />
                </Suspense>
              )}
              {activeTab === "network" && user && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <NetworkPortal companyId={user.companyId} />
                </Suspense>
              )}
              {activeTab === "accounting" && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <AccountingPortal
                    loads={loads}
                    users={companyUsers}
                    currentUser={user!}
                    onUserUpdate={() => refreshData(user!)}
                    initialTab={activeSubTab as AccountingPortalTab | undefined}
                    onNavigate={handleNavigate}
                  />
                </Suspense>
              )}
              {activeTab === "company" && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <CompanyProfile
                    user={user}
                    onUserRegistryChange={() => refreshData(user)}
                  />
                </Suspense>
              )}
              {activeTab === "telematics-setup" && (
                <Suspense
                  fallback={<LoadingSkeleton variant="card" count={3} />}
                >
                  <TelematicsSetup />
                </Suspense>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen overflow-hidden bg-slate-950">
        <ConnectionBanner onRetry={() => user && refreshData(user)} />
        {refreshToast && (
          <Toast
            message={refreshToast.message}
            type={refreshToast.type}
            onDismiss={() => setRefreshToast(null)}
            duration={6000}
          />
        )}
        {mainContent}
        {globalOverlays}
        {user && (
          <Suspense fallback={<LoadingSkeleton variant="card" count={2} />}>
            <CommsOverlay
              session={session}
              activeCallSession={activeCallSession}
              setActiveCallSession={setActiveCallSession}
              onRecordAction={handleRecordAction}
              openRecordWorkspace={openRecordWorkspace}
              onNavigate={(tab) => {
                handleNavigate("operations-hub");
              }}
              overlayState={overlayState}
              setOverlayState={setOverlayState}
              user={user}
              allLoads={loads}
              onLinkSessionToRecord={handleLinkSessionToRecord}
            />
          </Suspense>
        )}
        <SessionExpiredModal
          open={showSessionExpiredModal}
          onNavigateToLogin={() => {
            sessionExpiredFiredRef.current = false;
            setShowSessionExpiredModal(false);
            setUser(null);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
