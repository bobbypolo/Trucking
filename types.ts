export type QuoteStatus =
  | "Draft"
  | "Sent"
  | "Negotiating"
  | "Accepted"
  | "Declined"
  | "Expired";
export type BookingStatus =
  | "Accepted"
  | "Tendered"
  | "Pending_Docs"
  | "Ready_for_Dispatch";
export type LoadStatus =
  | "draft"
  | "planned"
  | "dispatched"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "completed"
  | "cancelled";
export type SettlementStatus =
  | "pending_generation"
  | "generated"
  | "reviewed"
  | "posted"
  | "adjusted";

export const QuoteStatus = {
  Draft: "Draft",
  Sent: "Sent",
  Negotiating: "Negotiating",
  Accepted: "Accepted",
  Declined: "Declined",
  Expired: "Expired",
} as const;

export const BookingStatus = {
  Accepted: "Accepted",
  Tendered: "Tendered",
  Pending_Docs: "Pending_Docs",
  Ready_for_Dispatch: "Ready_for_Dispatch",
} as const;

export const LOAD_STATUS = {
  Draft: "draft",
  Planned: "planned",
  Dispatched: "dispatched",
  In_Transit: "in_transit",
  Arrived: "arrived",
  Delivered: "delivered",
  Completed: "completed",
  Cancelled: "cancelled",
  // Legacy aliases (mapped to canonical values)
  Unassigned: "draft",
  Assigned: "planned",
  Active: "in_transit",
  Booked: "planned",
  At_Pickup: "arrived",
  Loaded: "in_transit",
  At_Delivery: "arrived",
  Closed: "completed",
  Settled: "completed",
} as const;

export const SETTLEMENT_STATUS = {
  PendingGeneration: "pending_generation",
  Generated: "generated",
  Reviewed: "reviewed",
  Posted: "posted",
  Adjusted: "adjusted",
} as const;

export type UserRole =
  | "admin"
  | "driver"
  | "owner_operator"
  | "safety_manager"
  | "dispatcher"
  | "payroll_manager"
  | "customer"
  // Enterprise Pack Roles
  | "OWNER_ADMIN"
  | "OPS"
  | "SAFETY_MAINT"
  | "FINANCE"
  | "SALES_CS"
  | "ORG_OWNER_SUPER_ADMIN"
  | "OPS_MANAGER"
  | "SAFETY_COMPLIANCE"
  | "MAINTENANCE_MANAGER"
  | "ACCOUNTING_AR"
  | "ACCOUNTING_AP"
  | "PAYROLL_SETTLEMENTS"
  | "DRIVER_PORTAL"
  | "FLEET_OO_ADMIN_PORTAL"
  | "SALES_CUSTOMER_SERVICE"
  // Split Roles Pack
  | "DISPATCHER";

// --- AGILE OPERATION MODELS ---
export type OperatingMode = "Small Team" | "Split Roles" | "Enterprise";

export type Capability =
  | "QUOTE_CREATE"
  | "QUOTE_EDIT"
  | "QUOTE_VIEW_MARGIN"
  | "QUOTE_SEND"
  | "QUOTE_APPROVE"
  | "QUOTE_CONVERT"
  | "LOAD_CREATE_MANUAL"
  | "LOAD_ASSIGN"
  | "LOAD_EDIT_APPTS"
  | "LOAD_UPDATE_STATUS"
  | "LOAD_TRACK"
  | "LOAD_EXCEPTION_MANAGE"
  | "LOAD_CLOSE"
  | "FINANCE_EDIT_CHARGES"
  | "FINANCE_APPROVE_ACC"
  | "FINANCE_FINALIZE_SETTLEMENT";

export type PermissionLevel =
  | "Allow"
  | "Deny"
  | "Scoped"
  | "Approval Required"
  | "Limited";

export interface CapabilityPermission {
  capability: Capability;
  level: PermissionLevel;
  limitAmount?: number;
  approvalThreshold?: number;
  scopeValue?: string; // region/customer etc
}

export type DutyMode = "Pricing" | "Dispatch" | "Both";
export type PrimaryWorkspace = "Quotes" | "Dispatch" | "Balanced";

export type WorkItemType =
  | "QUOTE_FOLLOWUP"
  | "LOAD_EXCEPTION"
  | "APPROVAL_REQUEST"
  | "SAFETY_ALARM"
  | "Detention_Review"
  | "Document_Issue";

export interface WorkItem {
  id: string;
  companyId: string;
  type: WorkItemType;
  priority: "High" | "Medium" | "Low" | "Critical";
  label: string;
  description: string;
  entityId: string;
  entityType: EntityType;
  assignedToUserIds?: string[];
  status:
    | "Open"
    | "In-Progress"
    | "Resolved"
    | "Pending"
    | "Critical"
    | "Handoff_Pending";
  createdAt: string;
  dueDate?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: {
    customerType?: string;
    lane?: string;
    isAfterHours?: boolean;
    isHazmat?: boolean;
    marginUnder?: number;
    rateOver?: number;
  };
  assignToId: string; // UserId or TeamId
  assignToName: string;
  priority: number;
}

export type PermissionCode =
  | "ORG_SETTINGS_VIEW"
  | "ORG_SETTINGS_EDIT"
  | "USER_ROLE_MANAGE"
  | "AUDIT_LOG_VIEW"
  | "EXPORT_DATA"
  | "LOAD_CREATE"
  | "LOAD_EDIT"
  | "LOAD_DISPATCH"
  | "LOAD_CLOSE"
  | "ACCESSORIAL_REQUEST"
  | "ACCESSORIAL_APPROVE"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_VIEW"
  | "DOCUMENT_DELETE"
  | "SAFETY_EVENT_VIEW"
  | "SAFETY_EVENT_EDIT"
  | "MAINT_TICKET_VIEW"
  | "MAINT_TICKET_EDIT"
  | "MAINT_APPROVE"
  | "LOAD_RATE_VIEW"
  | "LOAD_MARGIN_VIEW"
  | "INVOICE_CREATE"
  | "INVOICE_EDIT"
  | "INVOICE_APPROVE"
  | "INVOICE_VOID"
  | "SETTLEMENT_VIEW"
  | "SETTLEMENT_EDIT"
  | "SETTLEMENT_APPROVE"
  | "DRIVER_PROFILE_VIEW"
  | "DRIVER_PROFILE_EDIT"
  | "HR_DOCS_VIEW";

export type PermissionEffect = "allow" | "deny" | "scoped";
export type ScopeType =
  | "terminal"
  | "customer"
  | "fleet"
  | "assignment"
  | "record_type";

export interface ScopeRule {
  id: string;
  scopeType: ScopeType;
  scopeValue: string;
  effect: "allow" | "deny";
}
export type FreightType = "Intermodal" | "Reefer" | "Dry Van" | "Flatbed";
export type VisibilityLevel =
  | "DRIVER_SAFE"
  | "OPERATIONAL_DRIVER"
  | "COMMERCIAL_SENSITIVE"
  | "INTERNAL_ONLY";
export type SubscriptionTier =
  | "Records Vault"
  | "Automation Pro"
  | "Fleet Core"
  | "Fleet Command";

export type AccountType = "fleet" | "owner_operator" | "independent_driver";
export type PayModel = "percent" | "mileage" | "hourly" | "salary";
export type EquipmentOwnership =
  | "Company Owned"
  | "Rental"
  | "Lease-to-Own"
  | "Third-Party Provider";

export interface RolePermissions {
  // Legacy support
  showRates?: boolean;
  showDriverPay?: boolean;
  viewSettlements?: boolean;
  createLoads?: boolean;
  editLoads?: boolean;
  manageLegs?: boolean;
  editCompletedLoads?: boolean;
  viewClients?: boolean;
  createBrokers?: boolean;
  showBrokerDetails?: boolean;
  canAutoCreateClientFromScan?: boolean;
  viewSafety?: boolean;
  manageSafety?: boolean;
  viewIntelligence?: boolean;
  manageDrivers?: boolean;

  // New V1 RBAC
  permissions?: PermissionCode[];
  scopeRules?: ScopeRule[];
}

export interface LoadExpense {
  id: string;
  category: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
  isEquipmentBilling?: boolean;
}

export type IssueCategory =
  | "Safety"
  | "Maintenance"
  | "Payroll"
  | "Dispatch"
  | "Incident"
  | "Handoff";
export type IssueStatus =
  | "Open"
  | "Resolved"
  | "Action_Needed"
  | "Pending_Approval";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected";
export type IncidentSeverity = "Critical" | "High" | "Medium" | "Low";
export type IncidentType =
  | "Breakdown"
  | "Accident"
  | "Cargo Issue"
  | "Weather Shutdown"
  | "HOS Risk"
  | "Load at Risk"
  | "Reefer Temp"
  | "Theft Risk"
  | "Safety Violation"
  | "Compliance Breach"
  | "Equipment Failure"
  | "Legal Exposure"
  | "Load Recovery"
  | "Motor Breakdown"
  | "Hours of Service Risk";

export interface IncidentAction {
  id: string;
  incident_id?: string;
  timestamp: string;
  actorName: string;
  actor_name?: string; // API compatibility
  action: string;
  notes?: string;
  attachments?: string[];
  actionOutcome?:
    | "ScheduleTraining"
    | "BlockDispatch"
    | "ContractWarning"
    | "Resolution";
  linkedEntities?: {
    type: "Driver" | "Broker" | "Contract" | "Accounting";
    id: string;
  }[];
}

export interface Vendor {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface EmergencyCharge {
  id: string;
  category:
    | "Tow"
    | "Roadside"
    | "Storage"
    | "Cross-Dock"
    | "Repower"
    | "Layover"
    | "Hotel"
    | "Claim"
    | "Labor"
    | "Parts"
    | "Salvage";
  amount: number;
  providerVendor: string;
  status:
    | "Draft"
    | "Pending_Approval"
    | "Approved"
    | "Invoviced"
    | "Billed"
    | "Settled";
  approvedBy?: string;
  receiptUrl?: string;
  description?: string;
  createdAt: string;
}

export type TicketStatus =
  | "Open"
  | "Assigned"
  | "Vendor_Accepted"
  | "In_Progress"
  | "Complete"
  | "Verified"
  | "Closed";
export type TicketType =
  | "Preventive"
  | "Breakdown"
  | "Inspection_Failure"
  | "Tire"
  | "Battery"
  | "Brakes"
  | "Lights"
  | "Reefer"
  | "DOT_Corrective";

export interface ServiceTicket {
  id: string;
  unitId: string;
  type: TicketType;
  status: TicketStatus;
  priority: "Critical" | "High" | "Medium" | "Low";
  description: string;
  vendorId?: string;
  assignedVendorId?: string;
  eta?: string;
  estimatedCost: number;
  actualCost?: number;
  photos?: string[];
  diagnosticCodes?: string[];
  parts?: { name: string; cost: number; quantity: number }[];
  laborHours?: number;
  laborRate?: number;
  approvalThreshold?: number;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  loadId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status:
    | "Open"
    | "In_Progress"
    | "Recovered"
    | "Closed"
    | "Handoff_Pending"
    | "Critical";
  ownerUserId?: string;
  reportedAt: string;
  slaDeadline?: string;
  description: string;
  location?: { lat: number; lng: number; address?: string };
  timeline: IncidentAction[];
  billingItems: EmergencyCharge[];
  serviceTickets?: string[]; // IDs of ServiceTicket
  recoveryPlan?: string;
  repowerDriverId?: string;
  repowerLoadId?: string; // New load created for repower
  isAtRisk?: boolean;
  driverId?: string;
}

export interface NotificationJob {
  id: string;
  loadId?: string;
  incidentId?: string;
  recipients: { id: string; name: string; role: string; phone: string }[];
  message: string;
  channel: "SMS" | "Call" | "Push" | "Email" | "Multi";
  status: "PENDING" | "SENT" | "FAILED" | "PARTIAL";
  sentBy: string;
  sentAt: string;
  sync_error?: boolean;
}

export interface ComplianceRecord {
  id: string;
  driverId: string;
  type:
    | "CDL"
    | "Medical_Card"
    | "Drug_Test"
    | "Background_Check"
    | "Training"
    | "Policy_Acknowledgement"
    | "Insurance"
    | "Endorsement";
  expiryDate?: string;
  status: "Valid" | "Expired" | "Pending_Review" | "Failed";
  documentUrl?: string;
  isMandatory: boolean;
  lastTestedAt?: string;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  contentUrl: string; // Video or PDF link
  mandatoryRoles: UserRole[];
  quizId?: string;
  completedByCount: number;
}

export interface Issue {
  id: string;
  category: IssueCategory;
  description: string;
  reportedAt: string;
  reportedBy: string;
  status: IssueStatus;

  // Tactical Depth
  actionNeeded?: boolean;
  requiresApproval?: boolean;
  approvalStatus?: ApprovalStatus;
  reassignedTo?: string; // UserId
  actionReason?: string;

  resolvedAt?: string;
  resolvedBy?: string;
  repairType?: string;

  // Extended fields (used in load-level issue tracking)
  loadId?: string;
  type?: string;
  severity?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface ApprovedChassis {
  id: string;
  type: string;
  provider: string;
  prefixes: string[];
  unitId?: string;
}

export interface AccessorialRates {
  detentionPerHour?: number;
  stopCharge?: number;
  chassisPerDay?: number;
  layoverPerDay?: number;
  lumperDefault?: number;
  performanceBonus?: number;
  // Legacy optional aliases used in test fixtures
  detention?: number;
  layover?: number;
  TONU?: number;
  lumper?: number;
  driverAssist?: number;
  tradeShowHandling?: number;
  hazmat?: number;
  tankerEndorsement?: number;
  reefer?: number;
  residential?: number;
  liftGate?: number;
  insideDelivery?: number;
  sortAndSegregate?: number;
  markAndTag?: number;
  customsBond?: number;
}

export interface CustomExpenseScheme {
  id: string;
  label: string;
  defaultAmount: number;
}

export interface Broker {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  isShared: boolean;
  ownerId?: string;
  clientType: "Broker" | "Direct Customer";
  approvedChassis: ApprovedChassis[];
  safetyScore?: number;
  notes?: string;
  defaultFreightType?: FreightType;
  paymentTerms?: string;
  accessorialRates?: Partial<AccessorialRates>;
  customExpenseTypes?: CustomExpenseScheme[];
}

export interface LoadLeg {
  id: string;
  type: "Pickup" | "Dropoff" | "Fuel" | "Rest";
  location: {
    city: string;
    state: string;
    facilityName: string;
    address?: string;
    zip?: string;
  };
  sealNumber?: string;
  pallets?: number;
  weight?: number;
  hoursOfOp?: string;
  description?: string;
  date: string;
  appointmentTime?: string;
  completed: boolean;
  completedAt?: string;
}

export interface BolData {
  generatedAt: string;
  type: "Pickup" | "Delivery";
  driverSignature: string;
  shipperSignature?: string;
  receiverSignature?: string;
  signatoryTitle: string;
  sealNumber: string;
  timeArrived: string;
  timeLoadingStart: string;
  timeLoadingEnd: string;
  termsAccepted: boolean;
}

export interface CallLog {
  id: string;
  timestamp: string;
  type: "Driver" | "Broker" | "Operational" | "Inbound" | "Outbound";
  category?: "Update" | "Incident" | "Inquiry" | "Emergency";
  entityId?: string; // LoadId primary
  notes: string;
  recordedBy: string;
  driverId?: string;
  brokerId?: string;
  contractId?: string;
  tags?: string[];
}

export interface OperationalTrend {
  id: string;
  entityType: "Driver" | "Broker";
  entityId: string;
  trendType:
    | "Consistent_Late"
    | "Safety_Risk"
    | "Doc_Delinquency"
    | "Contract_Risk";
  severity: "Critical" | "Warning" | "Info";
  observationCount: number;
  lastOccurrence: string;
  actionTaken?: boolean;
}

export interface GlobalTag {
  id: string;
  label: string;
  color: string;
  module: "Dispatch" | "Safety" | "Accounting" | "Admin";
  actionableStep?: string;
}

export interface IFTAStateEntry {
  state: string;
  estimatedMiles: number;
}

export interface FuelPurchase {
  id: string;
  state: string;
  gallons: number;
  cost: number;
  date: string;
  vendor?: string;
  // Legacy alias used in test fixtures
  costPerGallon?: number;
  totalCost?: number;
}

export interface RevisionSnapshot {
  id: string;
  version: number;
  archivedAt: string;
  archivedBy: string;
  changeNotes?: string;
  snapshot: Partial<LoadData>;
}

export interface ActivityLogEntry {
  id: string;
  type: "Status" | "Alert" | "Notification";
  message: string;
  timestamp: string;
  user?: string;
}

export interface Lead {
  id: string;
  companyId: string;
  callerName: string;
  callerPhone?: string;
  callerEmail?: string;
  customerName: string;
  notes?: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  leadId?: string;
  companyId: string;
  status: QuoteStatus;

  // Lane & Equipment
  pickup: { city: string; state: string; facilityName?: string };
  dropoff: { city: string; state: string; facilityName?: string };
  equipmentType: FreightType;
  equipmentRequirements?: string;

  // Rates
  linehaul: number;
  fuelSurcharge: number;
  accessorials: { type: string; amount: number; notes?: string }[];
  totalRate: number;
  margin?: number;

  // Versions & Metadata
  version: number;
  validUntil: string;
  assumptions?: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
  attachments?: string[];

  // Financial Detail
  discount?: number;
  commission?: number;
  estimatedDriverPay?: number;
  companyCostFactor?: number; // Overhead/Equipment cost
}

export interface Booking {
  id: string;
  quoteId: string;
  companyId: string;
  status: BookingStatus;

  // Tender & Docs
  tenderDocUrl?: string;
  requiresAppt: boolean;
  appointmentWindow?: { start: string; end: string };
  constraints?: string;

  loadId?: string; // Linked load once created
  createdAt: string;
}

export interface LoadData {
  id: string;
  bookingId?: string; // Link to booking
  quoteId?: string; // Link to quote
  companyId: string;
  driverId: string;
  dispatcherId?: string;
  brokerId?: string;
  loadNumber: string;
  status: LoadStatus;
  carrierRate: number;
  driverPay: number;
  pickupDate: string;
  dropoffDate?: string;
  freightType?: FreightType;
  legs?: LoadLeg[];
  pickup: { city: string; state: string; facilityName?: string };
  dropoff: { city: string; state: string; facilityName?: string };
  createdAt?: number;
  version?: number;
  bolNumber?: string;
  bookingNumber?: string;
  containerNumber?: string;
  containerSize?: string;
  chassisNumber?: string;
  chassisProvider?: string;
  trailerNumber?: string;
  truckNumber?: string;
  commodity?: string;
  weight?: number;
  palletCount?: number;
  pieceCount?: number;
  reeferTemperature?: string;
  equipmentRequirements?: string;
  lfd?: string;
  issues?: Issue[];
  expenses?: LoadExpense[];
  generatedBol?: BolData;
  phoneCallNotes?: string;
  modifiedFields?: string[];
  correctionNotes?: string;
  iftaBreakdown?: IFTAStateEntry[];
  fuelPurchases?: FuelPurchase[];
  activityLog?: ActivityLogEntry[];
  revisions?: RevisionSnapshot[];
  notificationEmails?: string[];
  contractId?: string;

  // Tactical Depth & Workflow Locking
  isLocked?: boolean;
  isInvoiced?: boolean;
  profitMargin?: number;
  brokerageFee?: number;
  miles?: number;
  dispatchNotes?: string;
  specialInstructions?: string;
  isHazMat?: boolean;
  isPartial?: boolean;
  isActionRequired?: boolean;
  actionSummary?: string;
  callLogs?: CallLog[];
  customerContact?: {
    name: string;
    phone: string;
    email?: string;
  };
  gpsHistory?: { lat: number; lng: number; timestamp: string }[];
  telemetry?: {
    timestamp: string;
    event: string;
    lat: number;
    lng: number;
    speed: number;
  }[];
  podUrls?: string[];
  bolUrls?: string[];
  customerUserId?: string;

  // Unified Financial Layer
  financialStatus?: "Unbilled" | "Invoiced" | "Paid" | "Disputed" | "Bad Debt";
  settlementStatus?: "Pending" | "Calculated" | "Approved" | "Paid";
  loadProfitMargin?: number;
  totalRevenue?: number;
  totalCosts?: number;

  // IFTAManager / IFTAEvidenceReview compatibility aliases
  delivery?: { city: string; state: string; facilityName?: string };
  driver_id?: string;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  firebaseUid?: string;
  name: string;
  role: UserRole;
  password?: string;
  payModel?: PayModel;
  payRate?: number;
  salaryAmount?: number;
  onboardingStatus: "Pending" | "Completed";
  safetyScore: number;
  permissions?: RolePermissions;
  defaultEquipmentType?: FreightType;
  restricted?: boolean;
  overrideActive?: boolean;
  auditHistory?: any[];
  managedByUserId?: string;
  complianceStatus?: "Eligible" | "Restricted";
  restrictionReason?: string;
  complianceChecklist?: ComplianceRecord[];
  emergencyContact?: { name: string; phone: string; relationship: string };
  fleetOwnerContact?: { name: string; phone: string };
  preferredCommChannel?: "SMS" | "Call" | "Chat" | "Email";
  afterHoursPreference?: string;
  phone?: string;

  // Agile Workflow additions
  primaryWorkspace?: PrimaryWorkspace;
  dutyMode?: DutyMode;
  assignedCapabilities?: CapabilityPermission[];
  avatar?: string;
  company?: string;
}

export interface FleetEquipment {
  id: string;
  type: "Truck" | "Trailer" | "Chassis" | "Container";
  status: "Active" | "Out of Service" | "Removed";
  ownershipType: EquipmentOwnership;
  providerName: string;
  dailyCost: number;
  location?: string;
  addedBy?: string;
  addedAt?: string;
  maintenanceHistory?: MaintenanceRecord[];
  // Snake_case aliases for SafetyView compatibility
  unit_number?: string;
  ownership_type?: string;
  provider_name?: string;
  daily_cost?: number;
}

export interface LoadNumberingConfig {
  enabled?: boolean;
  prefix: string;
  suffix?: string;
  nextSequence?: number;
  separator?: string;
  includeClientTag?: boolean;
  clientTagPosition?: "after_prefix" | "before_prefix";
  clientTagFormat?: "first_3" | "full";
  // Legacy optional fields for backward compatibility
  zeroPad?: number;
  includeDate?: boolean;
  nextNumber?: number;
  padding?: number;
}

export interface Company {
  id: string;
  name: string;
  accountType: AccountType;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  taxId?: string;
  phone?: string;
  mcNumber?: string;
  dotNumber?: string; // Critical for DOT Compliance
  subscriptionStatus?: "active" | "trial" | "past_due";
  subscriptionTier?: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionPeriodEnd?: string;
  maxUsers?: number;
  supportedFreightTypes: FreightType[]; // Multi-selection capability
  defaultFreightType: FreightType;
  driverVisibilitySettings: {
    hideRates: boolean;
    hideBrokerContacts: boolean;
    maskCustomerName: boolean;
    showDriverPay: boolean;
    allowRateCon: boolean;
    enableDriverSafePack: boolean;
    autoRedactDocs: boolean;
  };
  loadNumberingConfig: LoadNumberingConfig;
  accessorialRates: AccessorialRates;
  driverPermissions: RolePermissions;
  ownerOpPermissions?: RolePermissions;
  dispatcherPermissions?: RolePermissions;
  scoringConfig?: {
    enabled?: boolean;
    minimumDispatchScore: number;
    weights: {
      safety?: number;
      onTime?: number;
      paperwork?: number;
      // Legacy weight fields
      violations?: number;
      accidents?: number;
      inspections?: number;
      training?: number;
    };
  };
  equipmentRegistry?: FleetEquipment[];
  defaultChassisProviders?: string[];
  autoTrackContainerPrefixes?: boolean;
  customChassisTypes?: string[];
  governance?: {
    autoLockCompliance: boolean;
    requireQuizPass: boolean;
    requireMaintenancePass: boolean;
    maxLoadsPerDriverPerWeek: number;
    preferredCurrency: string;
  };
  automationSettings?: {
    rules: AutomationRule[];
    docNamingRules?: string;
    loadIntakeRules?: string;
  };
  iftaSettings?: {
    baseJurisdiction: string;
    quarters: string[];
    mileageSource: "Manual" | "CSV" | "ELD";
  };
  moneySettings?: {
    defaultExpenseCategories: string[];
    reimbursementRules: string;
    payStructure: string;
  };

  // Agile Workflow Configuration
  operatingMode?: OperatingMode;
  capabilityMatrix?: Record<string, CapabilityPermission[]>; // Map role -> capabilities
  routingRules?: RoutingRule[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface SafetyQuiz {
  id: string;
  title: string;
  description: string;
  isMandatory: boolean;
  assignedTo: string[];
  createdAt: string;
  questions: QuizQuestion[];
}

export interface QuizResult {
  id: string;
  quizId: string;
  driverId: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  unitId: string;
  date: string;
  type: "Preventative" | "Repair" | "Inspection" | "Emergency";
  description: string;
  cost: number;
}

export interface DriverPerformance {
  driverId: string;
  totalScore: number;
  grade: "Elite" | "Standard" | "At Risk";
  status: "Ready" | "Blocked";
  metrics: {
    safetyScore: number;
    onTimeRate: number;
    paperworkScore: number;
    loadCount: number;
  };
}

export type RemovalReason = "Sale" | "Totaled" | "Return to Lease" | "Other";

export interface Contract {
  id: string;
  customerId: string;
  contractName: string;
  terms?: string;
  startDate?: string;
  expiryDate?: string;
  equipmentPreferences?: {
    allowedChassisProviders?: string[];
    defaultContainerSize?: string;
    allowedDrivers?: string[];
  };
  status: "Active" | "Expired" | "Draft";
}

export interface TimeLog {
  id: string;
  userId: string;
  loadId?: string;
  clockIn: string;
  clockOut?: string;
  activityType: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface DispatchEvent {
  id: string;
  loadId: string;
  dispatcherId: string;
  eventType: "Note" | "StatusChange" | "DriverCall" | "SystemAlert";
  message: string;
  payload?: any;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger:
    | "doc_upload"
    | "email_forward"
    | "photo_scan"
    | "load_status_change"
    | "gps_event"
    | "manual_batch";
  docType?: string;
  condition?: {
    field: string;
    operator: "equals" | "contains" | "gt" | "lt";
    value: any;
  };
  action:
    | "create_load"
    | "attach_to_load"
    | "create_expense"
    | "update_ifta"
    | "match_receipt"
    | "notify_accounting";
  configuration: {
    autoApprove?: boolean;
    extractFields?: string[];
    tagAs?: string[];
    lookbackDays?: number;
    matchTolerance?: number;
  };
}

export interface ChangeRequest {
  id: string;
  loadId: string;
  driverId: string;
  type: "DETENTION" | "LUMPER" | "LAYOVER" | "TONU" | "REWORK" | "OTHER";
  status: "PENDING" | "APPROVED" | "DENIED";
  requestedAmount?: number;
  timeIn?: string;
  timeOut?: string;
  notes: string;
  isUrgent: boolean;
  docUrl?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Message {
  id: string;
  loadId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  attachments?: { url: string; type: "image" | "document" }[];
  driverId?: string;
  brokerId?: string;
  tags?: string[];
}
export type OperationalEventType =
  | "CALL_LOG"
  | "MESSAGE"
  | "INCIDENT"
  | "ISSUE"
  | "TASK"
  | "DOCUMENT"
  | "APPROVAL"
  | "SYSTEM"
  | "REQUEST"
  | "TELEMETRY"
  | "EQUIPMENT_EVENT";

export type RequestType =
  | "DETENTION"
  | "LUMPER"
  | "LAYOVER"
  | "TONU"
  | "REPOWER"
  | "TOW"
  | "DOWNTIME"
  | "LIFT_RESTRICTION"
  | "ACCESSORIAL_PAY"
  | "CHANGE_ORDER";
export type RequestStatus =
  | "NEW"
  | "NEEDS_INFO"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "DENIED"
  | "DEFERRED"
  | "REASSIGNED"
  | "PAID"
  | "CLOSED";
export type EntityType =
  | "LOAD"
  | "JOB"
  | "CUSTOMER"
  | "BROKER"
  | "DRIVER"
  | "EQUIPMENT"
  | "DOCUMENT"
  | "OPEN_RECORD"
  | "GENERAL"
  | "REQUEST"
  | "CALL"
  | "PROVIDER"
  | "TASK"
  | "CRISIS_ACTION"
  | "INCIDENT"
  | "Quote"
  | "WORK_ITEM";

export type CallSessionStatus =
  | "WAITING"
  | "ACTIVE"
  | "WRAP_UP"
  | "CALLBACK"
  | "ESCALATED"
  | "RESOLVED"
  | "MISSED"
  | "VOICEMAIL"
  | "COMPLETED";

export interface RecordLink {
  id: string;
  entityType: EntityType;
  entityId: string;
  isPrimary: boolean;
  createdAt: string;
  createdBy: string;
}

export interface CallSession {
  id: string;
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  participants: { id: string; name: string; role: string }[];
  status: CallSessionStatus;
  assignedTo?: string;
  team?: string;
  lastActivityAt: string;
  links: RecordLink[];
  notes?: string;
}

export interface KCIRequest {
  id: string; // REQ-XXXXXX
  type: RequestType;
  status: RequestStatus;
  priority: "NORMAL" | "HIGH";

  // Money
  requestedAmount?: number;
  approvedAmount?: number;
  currency: string;
  payCode?: string;
  requiresDocs: boolean;

  // Anchors (Legacy for compatibility, but moving to links)
  loadId?: string;
  driverId?: string;
  customerId?: string;
  openRecordId?: string;
  callId?: string; // Links to CallSession

  // New Universal Linking
  links: RecordLink[];

  // Origin
  source: "DRIVER_APP" | "DISPATCH" | "SAFETY" | "ACCOUNTING";
  createdBy: string;
  requestedAt: string;
  notes?: string;
  createdAt: string;

  // Aging/SLA
  dueAt: string;

  // Audit
  approvedBy?: string;
  approvedAt?: string;
  deniedBy?: string;
  deniedAt?: string;
  denialReason?: string;
  decisionLog: {
    timestamp: string;
    actorId: string;
    actorName: string;
    action: string;
    beforeState: RequestStatus;
    afterState: RequestStatus;
    note?: string;
  }[];
}

export interface OperationalEvent {
  id: string;
  type: OperationalEventType;
  timestamp: string;
  actorId: string;
  actorName: string;
  message: string;
  payload?: any; // Specific data for the event type (e.g., call duration, message text)
  loadId?: string;
  driverId?: string;
  brokerId?: string;
  equipmentId?: string;
  requestId?: string; // Direct link to a Request object
  callSessionId?: string; // Anchor for the session
  isActionRequired?: boolean;
}

export type PrimaryContextType =
  | "Load"
  | "Driver"
  | "Customer"
  | "Equipment"
  | "Call"
  | "Global";

export interface OperationalThread {
  id: string; // The "Case" ID
  primaryContext: {
    type: PrimaryContextType;
    id: string; // The ID of the primary entity (e.g. LoadId)
    label: string; // Display label (e.g. Load #12345)
    status?: string;
  };
  linkedRecords: {
    type: PrimaryContextType;
    id: string;
    label: string;
  }[];
  events: OperationalEvent[];
  ownerId: string;
  ownerName: string;
  lastTouch: string;
  handoffNotes?: string;
  summary?: string;
  isAtRisk?: boolean;
  slaDeadline?: string;
}

export interface LoadSummary {
  id: string;
  loadNumber: string;
  status: LoadStatus;
  hasUnresolvedRequests: boolean;
  unresolvedCount: number;
  unpaidAmount: number;
  paidAmount: number;
  lastCallAt?: string;
  lastMessageAt?: string;
  safetyFlagsCount: number;
  lastEventAt?: string;
}

export interface DriverSummary {
  id: string;
  name: string;
  complianceStatus: "CLEAR" | "RESTRICTED";
  expiringDocsCount: number;
  openIncidentsCount: number;
  lastContactAt?: string;
  assignedLoadId?: string;
  phone?: string;
  emergencyContact?: { name: string; phone: string; relationship: string };
  fleetOwnerContact?: { name: string; phone: string };
  complianceState?: string;
}

export interface GlobalSearchResult {
  id: string;
  type: EntityType;
  label: string;
  subLabel?: string;
  status?: string;
  chips: {
    label: string;
    color: "blue" | "green" | "red" | "orange" | "slate";
    value?: string;
  }[];
}

export interface Provider {
  id: string;
  name: string;
  type:
    | "Tow"
    | "Mobile Mechanic"
    | "Tire"
    | "Recovery"
    | "Hazmat"
    | "Storage"
    | "Legal"
    | "Broker partner"
    | "Broker"
    | "Carrier"
    | "Roadside";
  coverage?: {
    regions?: string[];
    zipCodes?: string[];
    radius?: number;
  };
  capabilities?: string[];
  contacts?: Contact[];
  afterHoursContacts?: Contact[];
  rates?: any;
  status: "Preferred" | "Approved" | "Blocked" | "Active" | "Pre-Approved";
  location?: string;
  contactPhone?: string;
  rating?: number;
  is247?: boolean; // 24/7 Ready Flag
  notes?: string;
  documents?: { type: string; url: string; expiry?: string }[];
}

export interface Contact {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  type:
    | "Broker"
    | "Shipper"
    | "Receiver"
    | "Emergency"
    | "Provider"
    | "Internal"
    | "Customer"
    | "Customer_Support";
  preferredChannel?: "Phone" | "SMS" | "Email";
  normalizedPhone?: string; // For inbound matching
  notes?: string;
}

export interface OperationalTask {
  id: string;
  companyId?: string;
  type?: "GENERAL" | "FOLLOW_UP" | "DOCUMENTation" | "REPOWER_HANDOFF";
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedTo?: string;
  assignedToUserIds?: string[];
  entityType?: string;
  entityId?: string;
  dueDate?: string;
  links?: RecordLink[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface CrisisAction {
  id: string;
  type: "REPOWER" | "ROADSIDE" | "NOTIFICATION";
  status: "WATCH" | "EN_ROUTE" | "ARRIVED" | "COMPLETED" | "FAILED";
  loadId: string;
  providerId?: string;
  description: string;
  timeline: { timestamp: string; message: string }[];
  notificationsSent: { recipient: string; channel: string; status: string }[];
  createdAt: string;
}

export interface ContextRecord {
  id: string;
  type: EntityType;
  label: string;
  data?: any;
  timestamp: string;
  activeSubTab?: string;
}

export interface WorkspaceSession {
  primaryContext: ContextRecord | null;
  secondaryContexts: ContextRecord[];
  recentContexts: ContextRecord[];
  pinnedContexts: ContextRecord[];
  splitView: {
    enabled: boolean;
    leftId?: string;
    rightId?: string;
  };
}

export interface WorkflowStep {
  id: string;
  label: string;
  status: "PENDING" | "CURRENT" | "COMPLETED" | "BLOCKED";
  blockers?: {
    id: string;
    label: string;
    type: "REQUEST" | "DOC" | "SAFETY" | "FINANCE";
    targetPanel: string;
  }[];
}
export type PartyType =
  | "Shipper"
  | "Customer"
  | "Broker"
  | "Carrier"
  | "Vendor"
  | "Vendor_Service"
  | "Vendor_Equipment"
  | "Facility"
  | "Vendor_Product"
  | "Contractor";
export type OnboardingStatus =
  | "Draft"
  | "Invited"
  | "In_Review"
  | "Approved"
  | "On_Hold"
  | "Inactive";
export type PriceType =
  | "Flat"
  | "Per_Unit"
  | "Base_Plus_Variable"
  | "Tiered"
  | "Matrix";
export type UnitType =
  | "Mile"
  | "Hour"
  | "Day"
  | "Stop"
  | "Load"
  | "Piece"
  | "Pallet"
  | "LB"
  | "Ton"
  | "Event";
export type ConstraintRuleType =
  | "Time"
  | "Geo"
  | "Equipment"
  | "Capacity"
  | "Compliance"
  | "Operational";

export interface CatalogCategory {
  id: string;
  tenantId: string;
  parentId?: string;
  name: string;
  type: "Service" | "Equipment" | "Product" | "Accessorial" | "Facility_Fee";
}

export interface CatalogItem {
  id: string;
  tenantId: string;
  categoryId: string;
  itemCode: string;
  itemName: string;
  kind:
    | "Service"
    | "Equipment_Type"
    | "Product"
    | "Accessorial"
    | "Facility_Fee";
  active: boolean;
  attributes?: Record<string, any>;
}

export interface RateRow {
  id: string;
  tenantId: string;
  partyId: string;
  catalogItemId: string;
  variantId?: string;
  direction: "AR" | "AP";
  currency: string;
  priceType: PriceType;
  unitType?: UnitType;
  baseAmount?: number;
  unitAmount?: number;
  minCharge?: number;
  maxCharge?: number;
  freeUnits?: number;
  effectiveStart: string;
  effectiveEnd?: string;
  taxableFlag: boolean;
  roundingRule: string;
  notes?: string;
  approvalRequired: boolean;
  tiers?: RateTier[];
}

export interface RateTier {
  id: string;
  rateRowId: string;
  tierStart: number;
  tierEnd?: number;
  unitAmount: number;
  baseAmount?: number;
}

export interface ConstraintSet {
  id: string;
  tenantId: string;
  partyId: string;
  appliesTo: "Party" | "Catalog_Item" | "Equipment_Type" | "Facility" | "Lane";
  priority: number;
  status: "Active" | "Inactive";
  effectiveStart: string;
  effectiveEnd?: string;
  rules: ConstraintRule[];
}

export interface ConstraintRule {
  id: string;
  constraintSetId: string;
  type: ConstraintRuleType;
  field: string;
  operator: "=" | "!=" | "IN" | "NOT_IN" | ">=" | "<=" | "EXISTS";
  value: string;
  enforcement: "Block" | "Warn" | "Require_Approval";
  message?: string;
  action?: string;
}

export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  scope:
    | "Party"
    | "Catalog_Item"
    | "Rate_Row"
    | "Constraint_Rule"
    | "Equipment_Asset"
    | "Facility";
  fieldKey: string;
  label: string;
  dataType:
    | "Text"
    | "Number"
    | "Currency"
    | "Date"
    | "Boolean"
    | "Enum"
    | "Reference";
  required: boolean;
  defaultValue?: string;
  validationRegex?: string;
  visibleRoles?: string[];
  searchable: boolean;
}

export interface CustomFieldValue {
  id: string;
  scope: string;
  entityId: string;
  fieldDefId: string;
  value: string; // Stored as string, cast by UI
}

export interface PartyContact {
  id: string;
  partyId: string;
  name: string;
  role:
    | "Operations"
    | "Billing"
    | "After-hours"
    | "Claims"
    | "General"
    | "Account Manager";
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface PartyDocument {
  id: string;
  partyId: string;
  type: string;
  status: "Pending" | "Verified" | "Expired" | "Rejected";
  url: string;
  expiryDate?: string;
  name?: string;
}

export interface EquipmentAsset {
  id: string;
  tenantId: string;
  typeId: string;
  unitNumber: string;
  providerId: string;
  status: "Available" | "Reserved" | "Out_Of_Service";
  vin?: string;
  plate?: string;
  capabilities: string[];
}

export interface NetworkParty {
  id: string;
  companyId?: string;
  tenantId: string;
  name: string;
  type: PartyType;
  status: OnboardingStatus;
  isCustomer?: boolean;
  isVendor?: boolean;
  mcNumber?: string;
  dotNumber?: string;
  rating?: number;

  contacts: PartyContact[];
  documents?: PartyDocument[];

  // Unified Engines
  rates?: RateRow[];
  constraintSets?: ConstraintSet[];
  catalogLinks?: string[]; // IDs of CatalogItems offered/used

  createdAt?: string;
  updatedAt?: string;

  // Legacy optional fields for test fixtures
  rateTable?: unknown[];
  constraints?: unknown[];
  customFields?: unknown[];

  // Extended profile fields
  billingProfile?: {
    paymentTerms?: string;
    creditLimit?: number;
    taxId?: string;
    quickPayFee?: number;
  };
  vendorProfile?: {
    capabilities?: string[];
    serviceArea?: string[];
    taxId?: string;
    offeringTypes?: string[];
  };
  preferredPartners?: {
    id: string;
    partyId: string;
    partnerId: string;
    partnerType: string;
  }[];
}

// --- UNIFIED FINANCIAL LEDGER ---

export interface GLAccount {
  id: string;
  tenantId: string;
  accountNumber: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Income" | "Expense";
  category: string;
  subCategory?: string;
  isActive: boolean;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  entryDate: string;
  referenceNumber: string;
  description: string;
  sourceDocumentType:
    | "Invoice"
    | "Bill"
    | "Settlement"
    | "Fuel_Import"
    | "Manual";
  sourceDocumentId?: string;
  postedAt?: string;
  createdBy: string;
  lines: JournalLine[];
}

export interface JournalLine {
  id: string;
  glAccountId: string;
  debit: number;
  credit: number;
  allocationType?: "Load" | "Truck" | "Trailer" | "Driver" | "Overhead";
  allocationId?: string;
  notes?: string;
}

export interface ARInvoice {
  id: string;
  tenantId: string;
  customerId: string;
  loadId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: "Draft" | "Sent" | "Partial" | "Paid" | "Void" | "Disputed";
  totalAmount: number;
  balanceDue: number;
  lines: ARInvoiceLine[];
}

export interface ARInvoiceLine {
  id: string;
  invoiceId: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  glAccountId?: string;
}

export type APBillStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Paid"
  | "Rejected"
  | "Void";

export interface APBill {
  id: string;
  tenantId: string;
  vendorId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  status: APBillStatus;
  totalAmount: number;
  balanceDue: number;
  lines: APBillLine[];
  description?: string;
}

export type LineAllocationType =
  | "Load"
  | "Truck"
  | "Trailer"
  | "Driver"
  | "Overhead";
export type BillLineCategory =
  | "Labor"
  | "Parts"
  | "Tow"
  | "Tire"
  | "Fuel"
  | "Lumper"
  | "Toll"
  | "Repair"
  | "Other";

export interface APBillLine {
  id: string;
  billId: string;
  description: string;
  category: BillLineCategory;
  amount: number;
  allocationType: LineAllocationType;
  allocationId: string; // Linked ID (LoadId, TruckId, etc.)
  glAccountId: string;
}

export interface DriverSettlement {
  id: string;
  tenantId: string;
  driverId: string;
  settlementDate: string;
  periodStart: string;
  periodEnd: string;
  totalEarnings: number;
  totalDeductions: number;
  totalReimbursements: number;
  netPay: number;
  status: "Draft" | "Calculated" | "Approved" | "Paid";
  lines: SettlementLine[];
}

export interface SettlementLine {
  id: string;
  settlementId: string;
  type: "Earning" | "Deduction" | "Reimbursement";
  description: string;
  amount: number;
  loadId?: string;
  glAccountId?: string;
}

export interface FuelEntry {
  id: string;
  tenantId: string;
  truckId: string;
  driverId: string;
  loadId?: string;
  cardNumber?: string;
  transactionDate: string;
  stateCode: string;
  gallons: number;
  unitPrice: number;
  totalCost: number;
  vendorName: string;
  isIftaTaxable: boolean;
  isBillableToLoad: boolean;
}

// Exception Management System
export type ExceptionSeverity = 1 | 2 | 3 | 4; // 1=Low, 2=Med, 3=High, 4=Critical

export interface ExceptionStatus {
  statusCode: string;
  displayName: string;
  isTerminal: boolean;
  sortOrder: number;
}

export interface ExceptionType {
  typeCode: string;
  displayName: string;
  dashboardGroup: string;
  defaultOwnerTeam: string;
  defaultSeverity: ExceptionSeverity;
  defaultSlaHours: number;
  description?: string;
}

export interface Exception {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  severity: ExceptionSeverity;
  entityType?: "LOAD" | "DRIVER" | "TRUCK" | "TRAILER" | "BROKER" | "FACILITY";
  entityId?: string;
  ownerUserId?: string;
  team?: string;
  slaDueAt?: string;
  workflowStep?: string; // triage, request_docs, approve_pay, invoice_adjust, close
  financialImpactEst?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  links?: Record<string, string>;
}

export interface ExceptionEvent {
  id: string;
  exceptionId: string;
  timestamp: string;
  actorId?: string;
  actorName?: string;
  action: string;
  notes?: string;
  beforeState?: any;
  afterState?: any;
}

export interface DashboardCard {
  cardCode: string;
  displayName: string;
  sortOrder: number;
  iconKey?: string;
  route: string;
  filterJson: string;
}

export type VaultDocType =
  | "BOL"
  | "POD"
  | "Fuel"
  | "Lumper"
  | "Repair"
  | "Toll"
  | "Scale"
  | "Insurance"
  | "Permit"
  | "RateCon"
  | "Statement"
  | "Other";
export type VaultDocStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Locked";

export interface VaultDoc {
  id: string;
  tenantId: string;
  type: VaultDocType;
  url: string;
  filename: string;
  mimeType?: string;
  fileSize?: number;

  // Link Targets
  entityId?: string;
  loadId?: string;
  driverId?: string;
  truckId?: string;
  trailerId?: string;
  vendorId?: string;
  customerId?: string;

  // Metadata
  amount?: number;
  date?: string;
  vendorName?: string;
  stateCode?: string; // IFTA
  paymentMethod?: "Fuel Card" | "Driver Cash" | "Company CC" | "ACH" | "Check";

  status: VaultDocStatus;
  isLocked: boolean;
  version: number;
  parentDocId?: string; // For versioning history

  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface VaultVersion {
  id: string;
  docId: string;
  version: number;
  url: string;
  filename: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface VaultAuditEntry {
  id: string;
  docId: string;
  action: "Upload" | "Edit" | "StatusChange" | "Lock" | "VersionRepl";
  actorId: string;
  actorName: string;
  timestamp: string;
  details: string;
}

export interface MileageEntry {
  id: string;
  tenantId: string;
  truckId: string;
  date: string;
  stateCode: string;
  miles: number;
  type: "ELD" | "Manual";
  tripId?: string;
  notes?: string;
  state?: string;
  gallons?: number;
}

export interface IFTASummaryRow {
  stateCode: string;
  totalMiles: number;
  totalGallons: number;
  mpg: number;
  taxPaidAtPump: number;
  taxDue?: number;
}

export interface IFTASummary {
  quarter: number;
  year: number;
  rows: IFTASummaryRow[];
  totalMiles: number;
  totalGallons: number;
  netTaxDue: number;
}

export interface ImportMapping {
  sourceColumn: string;
  targetField: string;
  transform?: "string" | "number" | "date" | "boolean";
}

export interface ImportTemplate {
  id: string;
  tenantId: string;
  name: string;
  type: "Fuel" | "Bills" | "Invoices" | "CoA";
  mappings: ImportMapping[];
  skipRows: number;
}

export interface ImportDryRun {
  success: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: { row: number; field: string; message: string }[];
  preview: any[];
}

export interface IFTATripEvidence {
  id: string;
  truckId: string;
  loadId: string;
  timestamp: string;
  eventType:
    | "GPS_PING"
    | "CHECK_IN"
    | "FUEL_STOP"
    | "MANIFEST_LEG"
    | "BORDER_CROSSING";
  lat: number;
  lng: number;
  odometer?: number;
  stateCode?: string;
  source: string;
  rawPayload?: any;
}

export interface IFTATripAudit {
  id: string;
  truckId: string;
  loadId: string;
  tripDate: string;
  startTime?: string;
  endTime?: string;
  startOdometer?: number;
  endOdometer?: number;
  totalTotalMiles: number;
  method: "ACTUAL_GPS" | "HYBRID" | "RECONSTRUCTED";
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  routeMeta?: {
    encodedPolyline?: string;
    options?: any[];
  };
  jurisdictionMiles: Record<string, number>;
  attestedBy?: string;
  attestedAt?: string;
  status: "DRAFT" | "LOCKED";
}
