import { v4 as uuidv4 } from "uuid";
import {
  LoadData,
  User,
  Broker,
  FleetEquipment,
  Incident,
  KCIRequest,
  OperationalEvent,
  CallSession,
  OperationalTask,
  WorkItem,
  Provider,
  Contact,
  ServiceTicket,
  AccountType,
  UserRole,
} from "../types";
import {
  saveLoad,
  saveIncident,
  saveRequest,
  saveCallSession,
  saveTask,
  saveProvider,
  saveContact,
  saveServiceTicket,
  saveWorkItem,
} from "./storageService";

const COMPANY_ID = "iscope-authority-001";

/**
 * Dev-only seed fixtures for local development and demo mode.
 * These credentials are used by seedDatabase() in authService.ts via dynamic
 * import, ensuring they are tree-shaken from the production bundle.
 *
 * SECURITY: These are NOT real credentials. They exist only for local dev.
 * Production builds must not contain these values — verified by build-time
 * grep (R-P4-06, R-P4-07).
 */
export const DEV_DEFAULT_PASSWORD = "User123";

export const seedFixtures = {
  admin: {
    email: "admin@loadpilot.com",
    name: "LoadPilot Admin",
    companyName: "LoadPilot Logistics",
    accountType: "fleet" as AccountType,
    password: DEV_DEFAULT_PASSWORD,
  },
  dispatcher: {
    email: "dispatcher@loadpilot.com",
    name: "Dispatcher One",
    role: "dispatcher" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  opsManager: {
    email: "opsmanager@loadpilot.com",
    name: "Operations Manager",
    role: "OPS_MANAGER" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  arSpecialist: {
    email: "ar@loadpilot.com",
    name: "AR Specialist",
    role: "ACCOUNTING_AR" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  apClerk: {
    email: "ap@loadpilot.com",
    name: "AP Clerk",
    role: "ACCOUNTING_AP" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  payroll: {
    email: "payroll@loadpilot.com",
    name: "Payroll",
    role: "PAYROLL_SETTLEMENTS" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  safety: {
    email: "safety@loadpilot.com",
    name: "Safety",
    role: "SAFETY_COMPLIANCE" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  maintenance: {
    email: "maint@loadpilot.com",
    name: "Maintenance",
    role: "MAINTENANCE_MANAGER" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  smallBiz: {
    email: "smallbiz@kci.com",
    name: "Small Biz Carrier",
    role: "owner_operator" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  fusedOps: {
    email: "fused_ops@kci.com",
    name: "Fused Ops",
    role: "OPS" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  fusedFinance: {
    email: "fused_finance@kci.com",
    name: "Fused Finance",
    role: "FINANCE" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  fleetOwner: {
    email: "fleetowner@kci.com",
    name: "Fleet Owner",
    role: "OWNER_ADMIN" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  operator1: {
    email: "operator1@gmail.com",
    name: "Operator One",
    role: "owner_operator" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  operator2: {
    email: "operator2@gmail.com",
    name: "Operator Two",
    role: "owner_operator" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  customer: {
    email: "customer@gmail.com",
    name: "Customer User",
    role: "customer" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  architect: {
    email: "architect@loadpilot.com",
    name: "Platform Architect",
    role: "ORG_OWNER_SUPER_ADMIN" as UserRole,
    password: DEV_DEFAULT_PASSWORD,
  },
  drivers: [
    {
      email: "driver1@loadpilot.com",
      name: "Driver One",
      role: "driver" as UserRole,
      state: "IL",
      password: DEV_DEFAULT_PASSWORD,
    },
    {
      email: "driver2@loadpilot.com",
      name: "Driver Two",
      role: "driver" as UserRole,
      state: "IL",
      password: DEV_DEFAULT_PASSWORD,
    },
    {
      email: "driver3@loadpilot.com",
      name: "Driver Three",
      role: "driver" as UserRole,
      state: "IL",
      password: DEV_DEFAULT_PASSWORD,
    },
    {
      email: "driver4@loadpilot.com",
      name: "Driver Four",
      role: "driver" as UserRole,
      state: "IL",
      password: DEV_DEFAULT_PASSWORD,
    },
    {
      email: "driver5@loadpilot.com",
      name: "Driver Five",
      role: "driver" as UserRole,
      state: "IL",
      password: DEV_DEFAULT_PASSWORD,
    },
  ],
} as const;

const _seedMockDataImpl = async (user: User) => {
  const now = new Date();

  // 1. Mock Customers & Partners (Providers/Contacts)
  const mockProviders: Provider[] = [
    {
      id: "P-9901",
      name: "Titan Logistics Group",
      type: "Broker",
      status: "Preferred",
      location: "Chicago, IL",
      contactPhone: "312-555-0100",
      rating: 4.8,
    },
    {
      id: "P-9902",
      name: "Swift-Link Transport",
      type: "Carrier",
      status: "Active",
      location: "Atlanta, GA",
      contactPhone: "404-555-0212",
      rating: 4.5,
    },
    {
      id: "P-9904",
      name: "Rapid Rescue Towing",
      type: "Roadside",
      status: "Pre-Approved",
      location: "Gary, IN",
      contactPhone: "219-555-9111",
      rating: 5.0,
    },
  ];

  const mockContacts: Contact[] = [
    {
      id: "C-801",
      name: "Sarah Miller",
      type: "Customer_Support",
      title: "Senior Broker",
      phone: "312-555-0200",
      email: "sarah@titan.com",
      notes: "Key contact for Amazon loads",
    },
  ];

  for (const p of mockProviders) await saveProvider(p);
  for (const c of mockContacts) await saveContact(c);

  // 2. Mock Employees (Drivers)
  // Elena is stationary in Gary, IN (near our breakdown) to test the Repower matching flow.
  const mockDrivers: User[] = [
    {
      id: "DRV-7001",
      companyId: COMPANY_ID,
      email: "tom@loadpilot.com",
      name: 'Tom "Trucker" Thompson',
      role: "driver",
      onboardingStatus: "Completed",
      safetyScore: 98,
      complianceStatus: "Eligible",
      phone: "800-555-7001",
    },
    {
      id: "DRV-7003",
      companyId: COMPANY_ID,
      email: "elena@loadpilot.com",
      name: "Elena Petrova",
      role: "driver",
      onboardingStatus: "Completed",
      safetyScore: 75,
      complianceStatus: "Restricted",
      restrictionReason: "HOS Violation Pending",
      phone: "800-555-7003",
      defaultEquipmentType: "Dry Van",
    },
  ];
  // These would typically be saved in the users collection.

  // 3. Mock Equipment (Utility Trailers/Trucks)
  const mockEquipment: FleetEquipment[] = [
    {
      id: "TRK-501",
      type: "Truck",
      status: "Active",
      ownershipType: "Company Owned",
      providerName: "KCI Fleet",
      dailyCost: 150,
      location: "Chicago, IL",
    },
    {
      id: "TRL-401",
      type: "Trailer",
      status: "Active",
      ownershipType: "Company Owned",
      providerName: "Utility Trailers Inc",
      dailyCost: 45,
      location: "Gary, IN",
    },
    {
      id: "TRL-405",
      type: "Trailer",
      status: "Out of Service",
      ownershipType: "Rental",
      providerName: "Utility Trailers Inc",
      dailyCost: 65,
      location: "Gary, IN",
    }, // Failed inspection
  ];

  // 4. Mock "Perfect Storm" Loads
  const mockLoads: LoadData[] = [
    {
      id: "LD-8801",
      loadNumber: "KCI-8801",
      status: "in_transit",
      carrierRate: 3500,
      driverPay: 850,
      pickup: { city: "Chicago", state: "IL", facilityName: "Mars Wrigley" },
      dropoff: { city: "Denver", state: "CO", facilityName: "Safeway DC" },
      pickupDate: now.toISOString(),
      companyId: COMPANY_ID,
      driverId: "DRV-7001",
      truckNumber: "TRK-501",
      trailerNumber: "TRL-401",
      isActionRequired: true,
      actionSummary: "CRITICAL: Mechanical Failure on I-80",
      customerContact: { name: "Sarah Miller", phone: "312-555-0200" },
      telemetry: [
        {
          timestamp: new Date(now.getTime() - 7200000).toISOString(),
          event: "ENGINE_FAULT",
          lat: 41.58,
          lng: -87.31,
          speed: 0,
        },
        {
          timestamp: new Date(now.getTime() - 10000000).toISOString(),
          event: "LOCATION_UPDATE",
          lat: 41.6,
          lng: -87.4,
          speed: 65,
        },
        {
          timestamp: new Date(now.getTime() - 12000000).toISOString(),
          event: "LOCATION_UPDATE",
          lat: 41.7,
          lng: -87.6,
          speed: 68,
        },
      ],
    },
  ];
  for (const l of mockLoads) await saveLoad(l, user);

  // 5. Mock Incidents (Breakdown)
  const mockIncidentState: Incident = {
    id: "INC-7701",
    loadId: "LD-8801",
    type: "Breakdown",
    status: "Open",
    severity: "Critical",
    reportedAt: new Date(now.getTime() - 7200000).toISOString(),
    description:
      "Turbocharger failure - Unit stationary on highway shoulder I-80 EB MM 14.",
    location: { lat: 41.58, lng: -87.31, address: "I-80 EB MM 14, Gary, IN" },
    timeline: [
      {
        id: uuidv4(),
        timestamp: new Date(now.getTime() - 7200000).toISOString(),
        actorName: "System",
        action: "ALERT_TRIGGERED",
        notes: "Engine Fault Detected: P0300",
      },
      {
        id: uuidv4(),
        timestamp: new Date(now.getTime() - 6000000).toISOString(),
        actorName: "Tom Thompson",
        action: "STATUS_UPDATE",
        notes: "Vehicle lost power, pulled over",
      },
    ],
    billingItems: [],
  };
  await saveIncident(mockIncidentState);

  // 6. Mock Financial Requests
  const mockRequests: KCIRequest[] = [
    {
      id: "REQ-5501",
      type: "TOW",
      status: "PENDING_APPROVAL",
      priority: "HIGH",
      requestedAmount: 1450,
      currency: "USD",
      requiresDocs: false,
      loadId: "LD-8801",
      links: [
        {
          id: uuidv4(),
          entityType: "LOAD",
          entityId: "LD-8801",
          isPrimary: true,
          createdAt: now.toISOString(),
          createdBy: "Dispatcher",
        },
      ],
      source: "DISPATCH",
      createdBy: "Dispatcher John",
      requestedAt: now.toISOString(),
      createdAt: now.toISOString(),
      dueAt: new Date(now.getTime() + 1800000).toISOString(),
      decisionLog: [],
    },
  ];
  for (const r of mockRequests) await saveRequest(r);

  // 7. Mock Maintenance (Service Tickets for Utility Trailers)
  const mockTicket: ServiceTicket = {
    id: "TKT-9901",
    unitId: "TRL-405",
    type: "DOT_Corrective",
    status: "Assigned",
    priority: "High",
    description:
      "Brake drum replacement required. Failed inspection at Gary, IN scale house.",
    estimatedCost: 850,
    vendorId: "P-9904",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await saveServiceTicket(mockTicket);

  // 8. Mock Operational Tasks
  const mockTasks: OperationalTask[] = [
    {
      id: "TSK-2201",
      companyId: COMPANY_ID,
      title: "Verify HOS Compliance: Elena",
      description:
        "Driver Elena Petrova has pending violation. Clear before dispatching as repower candidate.",
      priority: "CRITICAL",
      status: "OPEN",
      assignedToUserIds: [user.id],
      entityType: "DRIVER",
      entityId: "DRV-7003",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
  for (const t of mockTasks) await saveTask(t);

  // 9. Mock Triage Work Items
  const mockWorkItems: WorkItem[] = [
    {
      id: "WI-7001",
      companyId: COMPANY_ID,
      type: "Detention_Review",
      label: "Detention Review: KCI-8801",
      description:
        "Receiver (Safeway DC) exceeding 2-hour window. Validate GPS telemetry.",
      priority: "High",
      status: "Pending",
      entityType: "LOAD",
      entityId: "LD-8801",
      createdAt: now.toISOString(),
    },
  ];
  for (const wi of mockWorkItems) await saveWorkItem(wi);

  // 10. Mock Active Comm Session (The "Hot" Queue)
  const mockSessions: CallSession[] = [
    {
      id: "CS-4401",
      startTime: now.toISOString(),
      status: "ACTIVE",
      participants: [{ id: "DRV-7001", name: "Tom Thompson", role: "DRIVER" }],
      lastActivityAt: now.toISOString(),
      links: [
        {
          id: uuidv4(),
          entityType: "LOAD",
          entityId: "LD-8801",
          isPrimary: true,
          createdAt: now.toISOString(),
          createdBy: "System",
        },
      ],
      team: "SAFETY",
    },
  ];
  for (const s of mockSessions) await saveCallSession(s);
};

/**
 * seedMockData is only available in development builds.
 * Production builds tree-shake this to a no-op.
 */
export const seedMockData: typeof _seedMockDataImpl = import.meta.env.DEV
  ? _seedMockDataImpl
  : async () => {
    };
