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
      contactPhone: "312-555-0199",
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
