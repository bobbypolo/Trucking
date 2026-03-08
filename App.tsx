import React, { useState, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
  seedIncidents,
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
import { getBrokers, saveBroker } from "./services/brokerService";
import {
  User,
  LoadData,
  Broker,
  RolePermissions,
  FreightType,
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
import { Auth } from "./components/Auth";
import { Dashboard } from "./components/Dashboard";
import { LoadList } from "./components/LoadList";
import { LoadBoardEnhanced } from "./components/LoadBoardEnhanced";
import { EditLoadForm } from "./components/EditLoadForm";
import { CalendarView } from "./components/CalendarView";
import { CompanyProfile } from "./components/CompanyProfile";
import { BrokerManager } from "./components/BrokerManager";
import { SafetyView } from "./components/SafetyView";
import { Intelligence } from "./components/Intelligence";
import { Settlements } from "./components/Settlements";
import { LoadDetailView } from "./components/LoadDetailView";
import { LoadSetupModal } from "./components/LoadSetupModal";
import { QuoteManager } from "./components/QuoteManager";
import { IssueSidebar } from "./components/IssueSidebar";
import {
  LayoutDashboard,
  Calendar,
  Users,
  ShieldCheck,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
  Truck,
  AlertTriangle,
  Home,
  Building2,
  ClipboardList,
  FileText,
  Map as MapIcon,
  MessageSquare,
  ShieldAlert,
  Zap,
  Phone,
  Search,
  Globe,
  DollarSign,
  ChevronLeft,
} from "lucide-react";
import { seedSafetyData } from "./services/safetyService";
import { v4 as uuidv4 } from "uuid";
import { Scanner } from "./components/Scanner";
import { DriverMobileHome } from "./components/DriverMobileHome";
import { CustomerPortalView } from "./components/CustomerPortalView";
import { GlobalMapViewEnhanced } from "./components/GlobalMapViewEnhanced";
import { AuditLogs } from "./components/AuditLogs";
import AccountingPortal from "./components/AccountingPortal";
import IntelligenceHub from "./components/IntelligenceHub";
import { ExceptionConsole } from "./components/ExceptionConsole";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { CommsOverlay } from "./components/CommsOverlay";
import { NetworkPortal } from "./components/NetworkPortal";
import { getRecord360Data } from "./services/storageService";
import { GoogleMapsAPITester } from "./components/GoogleMapsAPITester";
import { CommandCenterView } from "./components/CommandCenterView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loads, setLoads] = useState<LoadData[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [dispatchEvents, setDispatchEvents] = useState<DispatchEvent[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const [activeTab, setActiveTab] = useState("operations-hub");
  const [activeSubTab, setActiveSubTab] = useState<string | undefined>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isIssueSidebarOpen, setIsIssueSidebarOpen] = useState(false);

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
    "messaging" | "safety" | "command" | "directory"
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

  useEffect(() => {
    if (import.meta.env.DEV) {
      await seedDatabase();
      seedSafetyData(true);
    }

    const unsubscribe = onUserChange(async (updatedUser) => {
      setUser(updatedUser);
      if (updatedUser) {
        await refreshData(updatedUser);
        const l = await getLoads(updatedUser);
        if (l.length > 0) await seedIncidents(l);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowIntelligenceHub((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const refreshData = async (currentUser: User) => {
    const [
      fetchedLoads,
      fetchedBrokers,
      fetchedUsers,
      fetchedCompany,
      fetchedEvents,
      fetchedLogs,
      fetchedIncidents,
    ] = await Promise.all([
      getLoads(currentUser),
      getBrokers(currentUser.companyId),
      getCompanyUsers(currentUser.companyId),
      getCompany(currentUser.companyId),
      getDispatchEvents(currentUser.companyId),
      getTimeLogs(currentUser.companyId, true),
      getIncidents(),
    ]);

    setLoads(fetchedLoads);
    setBrokers(fetchedBrokers);
    setCompany(fetchedCompany || null);
    setDispatchEvents(fetchedEvents);
    setTimeLogs(fetchedLogs);
    setIncidents(fetchedIncidents);
    if (
      ["admin", "dispatcher", "safety_manager", "payroll_manager"].includes(
        currentUser.role,
      )
    ) {
      setCompanyUsers(fetchedUsers);
    } else {
      setCompanyUsers([currentUser]);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    refreshData(loggedInUser);

    // Support Agile Workspace Entry
    if (loggedInUser.primaryWorkspace === "Quotes") {
      setActiveTab("quotes");
    } else if (loggedInUser.primaryWorkspace === "Dispatch") {
      setActiveTab("loads");
    } else {
      setActiveTab("dashboard");
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setLoads([]);
    setActiveTab("dashboard");
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
    setActiveTab(tab);
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
        type: (event.payload as any)?.type || "Operational",
        category: (event.payload as any)?.category || "Update",
        entityId: event.loadId || "GLOBAL",
        notes: (event.payload as any)?.notes || event.message,
        recordedBy: event.actorName,
      });
    } else if (event.type === "ISSUE") {
      await saveIssue(
        {
          id: event.id,
          category: (event.payload as any)?.category || "Dispatch",
          description: (event.payload as any)?.description || event.message,
          reportedAt: event.timestamp,
          reportedBy: event.actorName,
          status: "Open",
        },
        event.loadId,
      );
    } else if (event.type === "INCIDENT") {
      const incidentPayload = event.payload || (event as any).incident;
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

  if (!user) return <Auth onLogin={handleLogin} />;

  const categories = [
    {
      title: "OPERATIONS",
      items: [
        {
          id: "operations-hub",
          label: "Unified Command Center",
          icon: Zap,
          permission: "LOAD_DISPATCH",
        },
        { id: "dashboard", label: "Management Console", icon: LayoutDashboard },
        { id: "exceptions", label: "Exception Triage", icon: AlertTriangle },
        { id: "analytics", label: "Strategy & Analytics", icon: BarChart3 },
        {
          id: "loads",
          label: "Dispatch Board",
          icon: Truck,
          permission: "LOAD_DISPATCH",
          capability: "LOAD_TRACK",
        },
        {
          id: "quotes",
          label: "Intake & Quotes",
          icon: ClipboardList,
          permission: "LOAD_CREATE",
          capability: "QUOTE_CREATE",
        },
        {
          id: "map",
          label: "Live Map",
          icon: MapIcon,
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
      ],
    },
    {
      title: "NETWORK",
      items: [{ id: "network", label: "Partner Network Hub", icon: Globe }],
    },
    {
      title: "FINANCIALS",
      items: [
        {
          id: "finance",
          label: "Settlements",
          icon: Wallet,
          permission: "SETTLEMENT_VIEW",
        },
        {
          id: "accounting",
          label: "Accounting",
          icon: Building2,
          permission: "INVOICE_CREATE",
        },
      ],
    },
    {
      title: "COMPLIANCE",
      items: [
        {
          id: "safety",
          label: "Safety / Fleet",
          icon: ShieldCheck,
          permission: "SAFETY_EVENT_VIEW",
        },
        {
          id: "audit",
          label: "Audit Logs",
          icon: FileText,
          permission: "AUDIT_LOG_VIEW",
        },
      ],
    },
    {
      title: "ENTERPRISE",
      items: [
        {
          id: "company",
          label: "Organization",
          icon: Building2,
          permission: "ORG_SETTINGS_VIEW",
        },
        { id: "api-tester", label: "API Tester", icon: Zap },
      ],
    },
  ];

  // Filter categories and items based on permissions (Legacy + Agile)
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (user?.role === "admin") return true;

        // Check Agile Capability
        if (
          (item as any).capability &&
          !checkCapability(user!, (item as any).capability, undefined, company)
        )
          return false;

        // Check Legacy Permission
        if (
          item.permission &&
          !permissions.permissions?.includes(item.permission as any)
        )
          return false;

        return true;
      }),
    }))
    .filter((cat) => cat.items.length > 0);

  // 4. Global Overlay Elements (Accessible everywhere)
  const globalOverlays = (
    <>
      <IssueSidebar
        isOpen={isIssueSidebarOpen}
        onClose={() => setIsIssueSidebarOpen(false)}
        loads={loads}
        currentUser={user}
        onViewLoad={(load) => {
          setViewingLoad(null);
          setEditingLoad(load);
          setIsAdding(false);
          setIsIssueSidebarOpen(false);
        }}
        onRefresh={() => refreshData(user)}
      />

      {showLoadSetup && (
        <LoadSetupModal
          currentUser={user!}
          preSelectedBrokerId={showLoadSetup.brokerId}
          onContinue={(bid, did, ln, cn, oft, imd) => {
            setShowLoadSetup(null);
            setEditingLoad({
              brokerId: bid,
              driverId: did,
              loadNumber: ln,
              phoneCallNotes: cn as any,
              freightType: oft,
              ...imd,
            });
            setIsAdding(true);
            setScanMode(!ln);
          }}
          onCancel={() => setShowLoadSetup(null)}
        />
      )}

      {(isAdding || editingLoad) && scanMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-lg relative">
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
                (editingLoad?.status === "Delivered" ||
                  editingLoad?.status === "Invoiced")
              }
              potentialBroker={potentialBroker}
              onOpenHub={(tab, call) => {
                setHubInitialTab(tab);
                setHubInitialShowCallForm(!!call);
                setShowIntelligenceHub(true);
              }}
            />
          </div>
        </div>
      )}

      {viewingLoad && (
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
            setHubInitialTab(tab as any);
            setShowIntelligenceHub(true);
          }}
        />
      )}
    </>
  );

  // ROLE-GATE ROUTING (4-Apps-in-One Logic)
  let mainContent;

  // 1. Driver Mobile Experience
  if (user.role === "driver") {
    mainContent = (
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
    );
  }

  // 2. Customer Portal Experience
  else if (user.role === "customer") {
    mainContent = (
      <CustomerPortalView
        user={user}
        loads={loads}
        onOpenHub={(tab) => {
          if (tab) setHubInitialTab(tab);
          setShowIntelligenceHub(true);
        }}
      />
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
              className={`hidden md:flex p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-all ${sidebarCollapsed ? "mx-auto rotate-180" : ""}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-3 space-y-8 flex-1 overflow-y-auto no-scrollbar py-8">
            {filteredCategories.map((cat) => (
              <div key={cat.title} className="space-y-2">
                <h4 className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-3 opacity-80">
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
                          className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-500" : "text-slate-700"}`}
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
                  <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">
                    {user.role?.replace("_", " ") || "USER"}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 hover:bg-red-950/20 rounded-md transition-all ${sidebarCollapsed ? "justify-center px-0" : ""}`}
            >
              <LogOut className="w-3 h-3 shrink-0" />
              {!sidebarCollapsed && <span>Emergency Sign Out</span>}
            </button>
          </div>
        </aside>
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-950">
          {/* GLOBAL OPERATIONAL HEADER */}
          <header className="h-20 bg-[#0a0f18] border-b border-white/5 flex items-center justify-between px-10 shrink-0 z-30">
            <div className="flex items-center gap-10">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden text-slate-400 p-2 hover:bg-slate-800 rounded-xl"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="relative group w-[480px] hidden md:block">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="text"
                  placeholder="Unified Command Center: Search Loads, Teams, or Data (Ctrl+K)"
                  className="w-full bg-[#020617] border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-[12px] text-white outline-none focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
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
                  Unified Command Center
                </span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden p-4 md:p-6 relative flex flex-col">
            <div className="hidden md:flex absolute top-6 right-6 z-20">
              <button
                onClick={() => setIsIssueSidebarOpen(true)}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-bold transition-all"
              >
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Issues
                {loads.reduce(
                  (acc, l) =>
                    acc +
                    (l.issues?.filter((i) => i.status === "Open")?.length || 0),
                  0,
                ) > 0 && (
                  <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px] animate-pulse">
                    {loads.reduce(
                      (acc, l) =>
                        acc +
                        (l.issues?.filter((i) => i.status === "Open")?.length ||
                          0),
                      0,
                    )}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
              {activeTab === "operations-hub" && (
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
                  onClose={() => handleNavigate("dashboard")}
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
              )}
              {activeTab === "dashboard" && (
                <Dashboard
                  user={user}
                  loads={loads}
                  brokers={brokers}
                  onViewLoad={(load) => {
                    setEditingLoad(load);
                    handleNavigate("loads");
                  }}
                  onNavigate={handleNavigate}
                  users={companyUsers}
                  onOpenIssues={() => setIsIssueSidebarOpen(true)}
                />
              )}
              {activeTab === "exceptions" && (
                <ExceptionConsole
                  currentUser={user}
                  initialView={activeSubTab}
                  onViewDetail={openRecordWorkspace}
                />
              )}
              {activeTab === "analytics" && (
                <AnalyticsDashboard
                  user={user}
                  loads={loads}
                  brokers={brokers}
                  onNavigate={handleNavigate}
                />
              )}
              {activeTab === "quotes" && user && (
                <QuoteManager user={user} company={company} />
              )}
              {activeTab === "loads" && (
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                    <h1 className="text-2xl font-bold text-white tracking-tighter uppercase">
                      Dispatch Board
                    </h1>
                    {permissions.createLoads && (
                      <button
                        onClick={() => handleNavigate("quotes")}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg"
                      >
                        <Plus className="w-5 h-5" /> New Intake
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
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
                    />
                  </div>
                </div>
              )}
              {activeTab === "map" && (
                <GlobalMapViewEnhanced
                  loads={loads}
                  users={companyUsers}
                  incidents={incidents}
                  onViewLoad={(l) => {
                    setViewingLoad(l);
                    openRecordWorkspace("LOAD", l.id);
                  }}
                  onSelectIncident={(incId) =>
                    openRecordWorkspace("INCIDENT", incId)
                  }
                />
              )}
              {activeTab === "calendar" && (
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
                />
              )}
              {activeTab === "network" && user && (
                <NetworkPortal companyId={user.companyId} />
              )}
              {activeTab === "brokers" && (
                <BrokerManager
                  brokers={brokers}
                  onUpdate={() => refreshData(user)}
                  onSave={async (b) => {
                    await saveBroker(b);
                    refreshData(user);
                  }}
                  onAddLoad={(bid) => setShowLoadSetup({ brokerId: bid })}
                />
              )}
              {activeTab === "safety" && (
                <SafetyView
                  user={user}
                  loads={loads}
                  incidents={incidents}
                  onSaveIncident={async (inc) => {
                    await createIncident(inc);
                    refreshData(user);
                  }}
                  onRecordAction={handleRecordAction}
                  openRecordWorkspace={openRecordWorkspace}
                />
              )}
              {activeTab === "finance" && (
                <AccountingPortal
                  loads={loads}
                  users={companyUsers}
                  currentUser={user!}
                  onUserUpdate={() => refreshData(user!)}
                  initialTab={activeSubTab as any}
                />
              )}
              {activeTab === "accounting" && (
                <AccountingPortal
                  loads={loads}
                  users={companyUsers}
                  currentUser={user!}
                  onUserUpdate={() => refreshData(user!)}
                  initialTab={activeSubTab as any}
                />
              )}
              {activeTab === "audit" && <AuditLogs user={user} />}
              {activeTab === "company" && company && (
                <CompanyProfile
                  company={company}
                  user={user}
                  users={companyUsers}
                />
              )}
              {activeTab === "api-tester" && <GoogleMapsAPITester />}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
      {mainContent}
      {globalOverlays}
      {user && (
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
      )}
    </div>
    </ErrorBoundary>
  );
}
