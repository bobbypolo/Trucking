
import { User, Company, UserRole, AccountType, RolePermissions, PayModel, FreightType, TimeLog, PermissionCode, PermissionEffect, SubscriptionTier, OperatingMode, CapabilityPermission, Capability } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { seedDemoLoads } from "./storageService";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdToken
} from "firebase/auth";

const USERS_KEY = "loadpilot_users_v1";
const COMPANIES_KEY = "loadpilot_companies_v1";
const SESSION_KEY = "loadpilot_session_v1";
const SEED_COMPANY_ID = "iscope-authority-001";

const API_URL = 'http://localhost:5000/api';

/**
 * Global token storage for API requests
 */
let _idToken: string | null = null;

export const getIdTokenAsync = async (): Promise<string | null> => {
  if (_idToken) return _idToken;
  if (auth.currentUser) {
    _idToken = await getIdToken(auth.currentUser);
    return _idToken;
  }
  return null;
};

// Listen for auth changes to update token and session
let _userChangeListeners: ((user: User | null) => void)[] = [];

export const onUserChange = (callback: (user: User | null) => void) => {
  _userChangeListeners.push(callback);
  return () => {
    _userChangeListeners = _userChangeListeners.filter(c => c !== callback);
  };
};

const notifyUserChange = (user: User | null) => {
  _userChangeListeners.forEach(c => c(user));
};

onAuthStateChanged(auth, async (fbUser) => {
  if (fbUser) {
    _idToken = await getIdToken(fbUser);
    let localUser = getCurrentUser();

    if (!localUser || localUser.email.toLowerCase() !== fbUser.email?.toLowerCase()) {
      const users = getStoredUsers();
      localUser = users.find(u => u.email.toLowerCase() === fbUser.email?.toLowerCase()) || null;
      if (localUser) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(localUser));
      }
    }
    notifyUserChange(localUser);
  } else {
    _idToken = null;
    localStorage.removeItem(SESSION_KEY);
    notifyUserChange(null);
  }
});

export const getAuthHeaders = async () => {
  const token = await getIdTokenAsync();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export const PERMISSION_PRESETS: Partial<Record<UserRole, PermissionCode[]>> = {
  // ENTERPRISE PACK (Full Segregation)
  'ORG_OWNER_SUPER_ADMIN': [
    'ORG_SETTINGS_VIEW', 'ORG_SETTINGS_EDIT', 'USER_ROLE_MANAGE', 'AUDIT_LOG_VIEW', 'EXPORT_DATA',
    'LOAD_CREATE', 'LOAD_EDIT', 'LOAD_DISPATCH', 'LOAD_CLOSE', 'ACCESSORIAL_REQUEST', 'ACCESSORIAL_APPROVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE', 'SAFETY_EVENT_VIEW', 'SAFETY_EVENT_EDIT',
    'MAINT_TICKET_VIEW', 'MAINT_TICKET_EDIT', 'MAINT_APPROVE', 'LOAD_RATE_VIEW', 'LOAD_MARGIN_VIEW',
    'INVOICE_CREATE', 'INVOICE_EDIT', 'INVOICE_APPROVE', 'INVOICE_VOID', 'SETTLEMENT_VIEW', 'SETTLEMENT_EDIT', 'SETTLEMENT_APPROVE'
  ],
  'OPS_MANAGER': [
    'ORG_SETTINGS_VIEW', 'AUDIT_LOG_VIEW', 'EXPORT_DATA',
    'LOAD_CREATE', 'LOAD_EDIT', 'LOAD_DISPATCH', 'LOAD_CLOSE', 'ACCESSORIAL_REQUEST', 'ACCESSORIAL_APPROVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE', 'SAFETY_EVENT_VIEW', 'SAFETY_EVENT_EDIT',
    'MAINT_TICKET_VIEW', 'MAINT_TICKET_EDIT', 'MAINT_APPROVE', 'LOAD_RATE_VIEW', 'LOAD_MARGIN_VIEW',
    'INVOICE_CREATE', 'INVOICE_EDIT', 'INVOICE_APPROVE'
  ],
  'DISPATCHER': [
    'EXPORT_DATA', 'LOAD_CREATE', 'LOAD_EDIT', 'LOAD_DISPATCH', 'LOAD_CLOSE', 'ACCESSORIAL_REQUEST',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'LOAD_RATE_VIEW'
  ],
  'SAFETY_COMPLIANCE': [
    'EXPORT_DATA', 'AUDIT_LOG_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE',
    'SAFETY_EVENT_VIEW', 'SAFETY_EVENT_EDIT'
  ],
  'MAINTENANCE_MANAGER': [
    'EXPORT_DATA', 'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE',
    'MAINT_TICKET_VIEW', 'MAINT_TICKET_EDIT', 'MAINT_APPROVE'
  ],
  'ACCOUNTING_AR': [
    'EXPORT_DATA', 'AUDIT_LOG_VIEW', 'DOCUMENT_VIEW', 'LOAD_RATE_VIEW', 'LOAD_MARGIN_VIEW',
    'INVOICE_CREATE', 'INVOICE_EDIT', 'INVOICE_APPROVE', 'INVOICE_VOID'
  ],
  'ACCOUNTING_AP': [
    'EXPORT_DATA', 'AUDIT_LOG_VIEW', 'DOCUMENT_VIEW'
  ],
  'PAYROLL_SETTLEMENTS': [
    'EXPORT_DATA', 'AUDIT_LOG_VIEW', 'DOCUMENT_VIEW',
    'SETTLEMENT_VIEW', 'SETTLEMENT_EDIT', 'SETTLEMENT_APPROVE'
  ],

  // SMALL TEAM PACK (Fused Roles)
  'OWNER_ADMIN': [
    'ORG_SETTINGS_VIEW', 'ORG_SETTINGS_EDIT', 'USER_ROLE_MANAGE', 'AUDIT_LOG_VIEW', 'EXPORT_DATA',
    'LOAD_CREATE', 'LOAD_EDIT', 'LOAD_DISPATCH', 'LOAD_CLOSE', 'ACCESSORIAL_REQUEST', 'ACCESSORIAL_APPROVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE', 'SAFETY_EVENT_VIEW', 'SAFETY_EVENT_EDIT',
    'MAINT_TICKET_VIEW', 'MAINT_TICKET_EDIT', 'MAINT_APPROVE', 'LOAD_RATE_VIEW', 'LOAD_MARGIN_VIEW',
    'INVOICE_CREATE', 'INVOICE_EDIT', 'INVOICE_APPROVE', 'INVOICE_VOID', 'SETTLEMENT_VIEW', 'SETTLEMENT_EDIT', 'SETTLEMENT_APPROVE'
  ],
  'OPS': [
    'EXPORT_DATA', 'LOAD_CREATE', 'LOAD_EDIT', 'LOAD_DISPATCH', 'LOAD_CLOSE', 'ACCESSORIAL_REQUEST', 'ACCESSORIAL_APPROVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'LOAD_RATE_VIEW'
  ],
  'SAFETY_MAINT': [
    'EXPORT_DATA', 'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'SAFETY_EVENT_VIEW', 'SAFETY_EVENT_EDIT',
    'MAINT_TICKET_VIEW', 'MAINT_TICKET_EDIT', 'MAINT_APPROVE'
  ],
  'FINANCE': [
    'EXPORT_DATA', 'AUDIT_LOG_VIEW', 'DOCUMENT_VIEW', 'LOAD_RATE_VIEW', 'LOAD_MARGIN_VIEW',
    'INVOICE_CREATE', 'INVOICE_EDIT', 'INVOICE_APPROVE', 'INVOICE_VOID',
    'SETTLEMENT_VIEW', 'SETTLEMENT_EDIT', 'SETTLEMENT_APPROVE'
  ],
  'DRIVER_PORTAL': [
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'ACCESSORIAL_REQUEST'
  ]
};

export const CAPABILITY_PRESETS: Record<OperatingMode, Record<string, CapabilityPermission[]>> = {
  'Small Team': {
    'admin': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Allow' },
      { capability: 'QUOTE_VIEW_MARGIN', level: 'Allow' }, { capability: 'QUOTE_SEND', level: 'Allow' },
      { capability: 'QUOTE_CONVERT', level: 'Allow' }, { capability: 'LOAD_ASSIGN', level: 'Allow' },
      { capability: 'LOAD_UPDATE_STATUS', level: 'Allow' }, { capability: 'LOAD_CLOSE', level: 'Allow' }
    ],
    'dispatcher': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Limited', limitAmount: 200 },
      { capability: 'QUOTE_SEND', level: 'Allow' }, { capability: 'QUOTE_CONVERT', level: 'Allow' },
      { capability: 'LOAD_ASSIGN', level: 'Allow' }, { capability: 'LOAD_UPDATE_STATUS', level: 'Allow' },
      { capability: 'LOAD_TRACK', level: 'Allow' }
    ],
    'OWNER_ADMIN': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Allow' },
      { capability: 'QUOTE_VIEW_MARGIN', level: 'Allow' }, { capability: 'QUOTE_SEND', level: 'Allow' },
      { capability: 'QUOTE_CONVERT', level: 'Allow' }, { capability: 'LOAD_ASSIGN', level: 'Allow' }
    ],
    'OPS': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Limited', limitAmount: 150 },
      { capability: 'QUOTE_CONVERT', level: 'Allow' }, { capability: 'LOAD_ASSIGN', level: 'Allow' }
    ]
  },
  'Split Roles': {
    'SALES_CUSTOMER_SERVICE': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Allow' },
      { capability: 'QUOTE_VIEW_MARGIN', level: 'Allow' }, { capability: 'QUOTE_SEND', level: 'Allow' },
      { capability: 'QUOTE_CONVERT', level: 'Allow' }
    ],
    'DISPATCHER': [
      { capability: 'QUOTE_CREATE', level: 'Deny' }, { capability: 'QUOTE_VIEW_MARGIN', level: 'Deny' },
      { capability: 'LOAD_ASSIGN', level: 'Allow' }, { capability: 'LOAD_UPDATE_STATUS', level: 'Allow' },
      { capability: 'LOAD_CLOSE', level: 'Allow' }, { capability: 'LOAD_TRACK', level: 'Allow' }
    ],
    'SALES_CS': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Allow' },
      { capability: 'QUOTE_SEND', level: 'Allow' }, { capability: 'QUOTE_CONVERT', level: 'Allow' }
    ]
  },
  'Enterprise': {
    'SALES_CUSTOMER_SERVICE': [
      { capability: 'QUOTE_CREATE', level: 'Allow' }, { capability: 'QUOTE_EDIT', level: 'Approval Required' },
      { capability: 'QUOTE_SEND', level: 'Allow' }
    ],
    'OPS_MANAGER': [
      { capability: 'QUOTE_APPROVE', level: 'Allow' }, { capability: 'QUOTE_CONVERT', level: 'Allow' },
      { capability: 'LOAD_ASSIGN', level: 'Allow' }
    ],
    'DISPATCHER': [
      { capability: 'LOAD_ASSIGN', level: 'Allow' }, { capability: 'LOAD_UPDATE_STATUS', level: 'Allow' },
      { capability: 'LOAD_TRACK', level: 'Allow' }
    ]
  }
};

const safeParse = <T>(key: string, fallback: T): T => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
};

export const getStoredUsers = (): User[] => safeParse(USERS_KEY, []);
const getStoredCompanies = (): Company[] => safeParse(COMPANIES_KEY, []);

export const getCurrentUser = (): User | null => safeParse(SESSION_KEY, null);

export const getCompany = async (companyId: string): Promise<Company | undefined> => {
  try {
    const res = await fetch(`${API_URL}/companies/${companyId}`);
    if (res.ok) return await res.json();
  } catch (e) { }
  return getStoredCompanies().find(c => c.id === companyId);
};

export const updateCompany = async (company: Company) => {
  try {
    await fetch(`${API_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company)
    });
  } catch (e) { }

  const companies = getStoredCompanies();
  const idx = companies.findIndex(c => c.id === company.id);
  if (idx >= 0) {
    companies[idx] = company;
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
  } else {
    companies.push(company);
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
  }
};

export const updateUser = async (user: User) => {
  try {
    await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
  } catch (e) { }

  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const session = getCurrentUser();
  if (session?.id === user.id) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
};

export const login = async (email: string, password?: string): Promise<User | null> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password || '');
    const fbUser = userCredential.user;
    _idToken = await getIdToken(fbUser);

    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    // Fallback: If not in local storage, we might need to fetch from server
    if (!user) {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firebaseUid: fbUser.uid })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        return data.user;
      }
    }

    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    }
  } catch (error) {
    console.error("Firebase Login Error:", error);
    // Legacy fallback for development before Firebase is fully configured
    const users = getStoredUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && (password === 'admin123' || password === '12345' || user.password === password)) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    }
  }
  return null;
};

export const logout = async () => {
  await signOut(auth);
  _idToken = null;
  localStorage.removeItem(SESSION_KEY);
};

export const registerCompany = async (
  companyName: string,
  adminEmail: string,
  adminName: string,
  accountType: AccountType,
  password?: string,
  maxUsers?: number,
  supportedFreightTypes: FreightType[] = ['Dry Van', 'Intermodal'],
  defaultFreightType: FreightType = 'Dry Van',
  subscriptionTier: SubscriptionTier = 'Records Vault'
): Promise<{ user: User, company: Company }> => {
  const companies = getStoredCompanies();
  const users = getStoredUsers();

  const newCompany: Company = {
    id: companyName === "LoadPilot Logistics" ? SEED_COMPANY_ID : uuidv4(),
    name: companyName,
    accountType,
    email: adminEmail,
    address: '100 Carrier Way',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    taxId: '',
    phone: '',
    mcNumber: '',
    dotNumber: '',
    subscriptionStatus: 'active',
    subscriptionTier,

    maxUsers: maxUsers || 100, supportedFreightTypes, defaultFreightType,
    driverVisibilitySettings: {
      hideRates: true,
      hideBrokerContacts: true,
      maskCustomerName: false,
      showDriverPay: false,
      allowRateCon: false,
      enableDriverSafePack: true,
      autoRedactDocs: true
    },
    equipmentRegistry: [],
    driverPermissions: { showRates: false, showDriverPay: true, viewSettlements: true, viewSafety: true, viewClients: true, manageLegs: false },
    ownerOpPermissions: { showRates: true, showDriverPay: true, viewSettlements: true, viewSafety: true, viewIntelligence: true, createBrokers: true, createLoads: true, manageLegs: true },
    dispatcherPermissions: { showRates: true, createLoads: true, editLoads: true, viewClients: true, manageSafety: true, viewIntelligence: true, manageLegs: true },
    scoringConfig: { enabled: true, minimumDispatchScore: 75, weights: { safety: 0.5, onTime: 0.3, paperwork: 0.2 } },
    accessorialRates: { detentionPerHour: 50, stopCharge: 50, chassisPerDay: 35, layoverPerDay: 150, lumperDefault: 0, performanceBonus: 100 },
    loadNumberingConfig: {
      enabled: true, prefix: 'LD', suffix: '', nextSequence: 1000, separator: '-',
      includeClientTag: false, clientTagPosition: 'after_prefix', clientTagFormat: 'first_3'
    },
    governance: {
      autoLockCompliance: true,
      requireQuizPass: true,
      requireMaintenancePass: true,
      maxLoadsPerDriverPerWeek: 5,
      preferredCurrency: 'USD'
    },
    operatingMode: 'Small Team',
    capabilityMatrix: CAPABILITY_PRESETS['Small Team']
  };

  const newUser: User = {
    id: uuidv4(),
    companyId: newCompany.id,
    email: adminEmail,
    name: adminName,
    role: 'admin',
    payModel: 'salary',
    payRate: 100000,
    password: password || 'admin123',
    onboardingStatus: 'Completed',
    safetyScore: 100,
    restricted: false,
    overrideActive: false,
    auditHistory: []
  };

  try {
    // Create Firebase User
    await createUserWithEmailAndPassword(auth, adminEmail, password || 'admin123');
  } catch (error) {
    console.error("Firebase Registration Error:", error);
    // Continue for now to allow local storage fallback if Firebase fails/not configured
  }

  await updateCompany(newCompany);
  await updateUser(newUser);

  return { user: newUser, company: newCompany };
};

export const getEffectivePermissions = (user: User, company?: Company): RolePermissions => {
  // 1. Check for modern PermissionCode list
  const presetPermissions = PERMISSION_PRESETS[user.role];
  if (presetPermissions) {
    return {
      permissions: presetPermissions,
      // Map legacy flags from the preset list for backward compatibility
      showRates: presetPermissions.includes('LOAD_RATE_VIEW'),
      showDriverPay: presetPermissions.includes('SETTLEMENT_VIEW'),
      viewSettlements: presetPermissions.includes('SETTLEMENT_VIEW'),
      createLoads: presetPermissions.includes('LOAD_CREATE'),
      editLoads: presetPermissions.includes('LOAD_EDIT'),
      manageLegs: presetPermissions.includes('LOAD_DISPATCH'),
      viewSafety: presetPermissions.includes('SAFETY_EVENT_VIEW'),
      manageSafety: presetPermissions.includes('SAFETY_EVENT_EDIT'),
      viewClients: presetPermissions.includes('LOAD_CREATE'), // Simplified
      manageDrivers: presetPermissions.includes('USER_ROLE_MANAGE')
    };
  }

  // 2. Legacy fallback logic
  if (user.role === 'admin') return {
    permissions: PERMISSION_PRESETS['OWNER_ADMIN'],
    showRates: true, showDriverPay: true, viewSettlements: true, showBrokerDetails: true,
    createBrokers: true, createLoads: true, editLoads: true, manageLegs: true,
    manageSafety: true, editCompletedLoads: true, viewSafety: true, viewIntelligence: true,
    viewClients: true, canAutoCreateClientFromScan: true, manageDrivers: true
  };

  if (user.role === 'dispatcher') return {
    permissions: PERMISSION_PRESETS['DISPATCHER'],
    showRates: true, showDriverPay: true, viewSettlements: true, showBrokerDetails: true,
    createBrokers: true, createLoads: true, editLoads: true, manageLegs: true,
    manageSafety: true, editCompletedLoads: true, viewSafety: true, viewIntelligence: true,
    viewClients: true, canAutoCreateClientFromScan: true, manageDrivers: true
  };

  if (user.role === 'payroll_manager') return {
    permissions: PERMISSION_PRESETS['PAYROLL_SETTLEMENTS'],
    viewSettlements: true, manageDrivers: true, showRates: true, showDriverPay: true, viewClients: true, editCompletedLoads: true
  };

  if (user.role === 'safety_manager') return {
    permissions: PERMISSION_PRESETS['SAFETY_COMPLIANCE'],
    viewSafety: true, manageSafety: true, viewClients: true
  };

  if (user.role === 'owner_operator' || user.role === 'FLEET_OO_ADMIN_PORTAL') {
    const perms = company?.ownerOpPermissions || { viewSettlements: true, viewSafety: true, manageLegs: true };
    return {
      ...perms,
      permissions: PERMISSION_PRESETS['FLEET_OO_ADMIN_PORTAL'] || [],
      manageLegs: perms.manageLegs ?? true
    };
  }

  // Employee Driver logic
  const perms = company?.driverPermissions || { viewSafety: true, viewSettlements: true, manageLegs: false };
  return {
    ...perms,
    permissions: PERMISSION_PRESETS['DRIVER_PORTAL'] || [],
    manageLegs: perms.manageLegs ?? false
  };
};

/**
 * Modern Permission Check Utility
 */
export const checkPermission = (user: User, code: PermissionCode, company?: Company): boolean => {
  const perms = getEffectivePermissions(user, company);
  if (!perms.permissions) return false;
  return perms.permissions.includes(code);
};

/**
 * Agile Capability Check
 */
export const checkCapability = (user: User, capability: Capability, amount?: number, company?: Company): boolean => {
  if (user.role === 'admin' || user.role === 'ORG_OWNER_SUPER_ADMIN' || user.role === 'OWNER_ADMIN') return true;

  // 1. Check user-specific overrides
  const userPerm = user.assignedCapabilities?.find(c => c.capability === capability);

  // 2. Check Role Matrix from Company
  const rolePerm = company?.capabilityMatrix?.[user.role]?.find(c => c.capability === capability);

  const effectivePerm = userPerm || rolePerm;

  // 3. Fallback: Grant LOAD_TRACK to dispatchers for backward compatibility
  if (!effectivePerm && capability === 'LOAD_TRACK' && (user.role === 'dispatcher' || user.role === 'DISPATCHER' || user.role === 'OPS')) {
    return true;
  }

  if (!effectivePerm) return false;

  switch (effectivePerm.level) {
    case 'Allow': return true;
    case 'Deny': return false;
    case 'Limited':
      if (amount !== undefined && effectivePerm.limitAmount !== undefined) {
        return Math.abs(amount) <= effectivePerm.limitAmount;
      }
      return true; // If no amount specified, we assume the action itself is allowed but value-gated
    case 'Approval Required':
      // In this case, we return true but the UI should trigger an approval workflow
      // For now, we'll return false to force the "Request Approval" path if amount is high
      if (amount !== undefined && effectivePerm.approvalThreshold !== undefined) {
        return amount < effectivePerm.approvalThreshold;
      }
      return false; // Requires explicit approval step
    case 'Scoped':
      return true; // Logic for region/customer scoping would go here
    default: return false;
  }
};

export const addDriver = async (companyId: string, name: string, email: string, role: UserRole, payModel?: PayModel, payRate?: number, managedByUserId?: string, password?: string) => {
  const newUser: User = {
    id: uuidv4(), companyId, email, name, role,
    payModel: payModel || (role === 'admin' ? 'salary' : 'percent'),
    payRate: payRate || (role === 'admin' ? 100000 : 25),
    managedByUserId,
    password: password || 'admin123', onboardingStatus: 'Completed', safetyScore: 100, restricted: false, overrideActive: false, auditHistory: []
  };

  try {
    // Create Firebase User
    await createUserWithEmailAndPassword(auth, email, password || 'admin123');
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`User ${email} already exists in Firebase Auth. Skipping creation.`);
    } else {
      console.error("Firebase Add Driver Error:", error);
    }
  }

  await updateUser(newUser);
  return newUser;
};

export const getCompanyUsers = async (companyId: string): Promise<User[]> => {
  try {
    const res = await fetch(`${API_URL}/users/${companyId}`, {
      headers: await getAuthHeaders()
    });
    if (res.ok) return await res.json();
  } catch (e) { }
  return getStoredUsers().filter(u => u.companyId === companyId);
};

export const seedDatabase = async () => {
  const users = getStoredUsers();
  const targetEmail = "admin@loadpilot.com";

  if (!users.find(u => u.email === targetEmail)) {
    const { user } = await registerCompany("LoadPilot Logistics", targetEmail, "Authority Admin", "fleet", "admin123");
    seedDemoLoads(user);
  }

  const currentUsers = getStoredUsers();
  const companyId = currentUsers.find(u => u.email === targetEmail)?.companyId || SEED_COMPANY_ID;

  const ensureUser = async (email: string, name: string, role: UserRole, password?: string, managedById?: string) => {
    if (!currentUsers.find(u => u.email === email)) {
      await addDriver(companyId, name, email, role, 'percent', 25, managedById, password);
    }
  };

  await ensureUser('dispatch@loadpilot.com', 'Dispatch Lead', 'DISPATCHER', 'dispatch123');
  await ensureUser('opsmanager@loadpilot.com', 'Operations Manager', 'OPS_MANAGER', 'admin123');
  await ensureUser('ar@loadpilot.com', 'AR Specialist', 'ACCOUNTING_AR', 'admin123');
  await ensureUser('ap@loadpilot.com', 'AP Clerk', 'ACCOUNTING_AP', 'admin123');
  await ensureUser('payroll@loadpilot.com', 'Payroll Controller', 'PAYROLL_SETTLEMENTS', 'payroll123');
  await ensureUser('safety@loadpilot.com', 'Safety Director', 'SAFETY_COMPLIANCE', 'safety123');
  await ensureUser('maint@loadpilot.com', 'Maintenance Lead', 'MAINTENANCE_MANAGER', 'admin123');

  // Small Team Roles
  await ensureUser('smallbiz@kci.com', 'Small Team Owner', 'OWNER_ADMIN', 'admin123');
  await ensureUser('fused_ops@kci.com', 'Fused Operations', 'OPS', 'admin123');
  await ensureUser('fused_finance@kci.com', 'Fused Finance', 'FINANCE', 'admin123');

  const fleetOwnerEmail = 'fleetowner@kci.com';
  await ensureUser(fleetOwnerEmail, 'Master Fleet Owner', 'FLEET_OO_ADMIN_PORTAL', 'fleet123');
  const allUsers = getStoredUsers();
  const fleetOwner = allUsers.find(u => u.email === fleetOwnerEmail);

  await ensureUser('operator1@gmail.com', 'Owner Op 1', 'owner_operator', 'admin123', fleetOwner?.id);
  await ensureUser('operator2@gmail.com', 'Owner Op 2', 'owner_operator', 'admin123', fleetOwner?.id);

  // MOCK DATA REQUEST: 5 Specific Drivers via requested profiles
  const mockDrivers = [
    { email: 'driver1@loadpilot.com', name: 'Marcus Rodriguez', state: 'IL', password: 'driver123' },
    { email: 'driver2@loadpilot.com', name: 'Sarah Chen', state: 'IN', password: 'driver123' },
    { email: 'driver3@loadpilot.com', name: 'David Thompson', state: 'OH', password: 'driver123' },
    { email: 'driver4@loadpilot.com', name: 'Elena Garcia', state: 'TX', password: 'driver123' },
    { email: 'driver5@loadpilot.com', name: 'James Wilson', state: 'GA', password: 'driver123' },
  ];

  for (const d of mockDrivers) {
    if (!currentUsers.find(u => u.email === d.email)) {
      await addDriver(companyId, d.name, d.email, 'driver', 'percent', 25, undefined, d.password);
      // Inject pseudo-profile data (State/Score)
      const u = getStoredUsers().find(user => user.email === d.email);
      if (u) {
        (u as any).state = d.state;
        (u as any).safetyScore = 85 + Math.floor(Math.random() * 15);
        (u as any).onboardingStatus = 'Completed';
        await updateUser(u);
      }
    }
  }

  await ensureUser('customer@gmail.com', 'Global Logistics Partner', 'customer', 'admin123');

  // ARCHITECT / SUPER-ADMIN (Bypasses Subscription Gates)
  await ensureUser('architect@loadpilot.com', 'System Architect', 'ORG_OWNER_SUPER_ADMIN', 'admin123');
};
