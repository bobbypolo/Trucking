import React, { useState, useEffect } from "react";
import { API_URL } from "../services/config";
import {
  Truck,
  User,
  Building,
  LogIn,
  CheckCircle,
  Lock,
  Briefcase,
  FileText,
  ArrowRight,
  Eye,
  EyeOff,
  CreditCard,
  ShieldCheck,
  Check,
  Loader2,
  ArrowLeft,
  Users,
  Plus,
  Minus,
  Container,
  ThermometerSnowflake,
  Construction,
  Box,
  MapPin,
  Globe,
  Scale,
  X,
  Zap,
} from "lucide-react";
import { login, registerCompany, updateCompany } from "../services/authService";
import { InputDialog } from "./ui/InputDialog";
import {
  User as UserType,
  AccountType,
  FreightType,
  Company,
  SubscriptionTier,
} from "../types";
import { v4 as uuidv4 } from "uuid";

const WIZARD_STORAGE_KEY = "loadpilot_signup_wizard";

type WizardView =
  | "login"
  | "signup"
  | "tier_selection"
  | "regulatory"
  | "equipment"
  | "money"
  | "ifta"
  | "templates"
  | "invites"
  | "payment";

interface WizardState {
  view: WizardView;
  email: string;
  name: string;
  companyName: string;
  signupType: AccountType;
  tier: SubscriptionTier;
  mcNumber: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

function loadWizardState(): Partial<WizardState> {
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<WizardState>;
  } catch (error) {
    console.warn("Failed to read wizard state from sessionStorage:", error);
    return {};
  }
}

function saveWizardState(state: Partial<WizardState>): void {
  try {
    // Write full wizard state snapshot
    sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
    // Write a lightweight step-only key for quick recovery checks
    sessionStorage.setItem(WIZARD_STORAGE_KEY + "_step", state.view ?? "login");
  } catch (error) {
    // sessionStorage unavailable — proceed without persistence
    console.warn("Failed to save wizard state to sessionStorage:", error);
  }
}

function loadWizardStep(): string {
  try {
    return sessionStorage.getItem(WIZARD_STORAGE_KEY + "_step") ?? "login";
  } catch (error) {
    console.warn("Failed to read wizard step from sessionStorage:", error);
    return "login";
  }
}

function clearWizardState(): void {
  try {
    sessionStorage.removeItem(WIZARD_STORAGE_KEY);
    sessionStorage.removeItem(WIZARD_STORAGE_KEY + "_step");
  } catch (error) {
    // best-effort cleanup
    console.warn("Failed to clear wizard state from sessionStorage:", error);
  }
}

interface Props {
  onLogin: (user: UserType) => void;
}

export const Auth: React.FC<Props> = ({ onLogin }) => {
  // Restore wizard state from sessionStorage on mount
  const _saved = loadWizardState();

  const [view, setView] = useState<WizardView>(
    _saved.view && _saved.view !== "login" ? _saved.view : "login",
  );
  const [signupType, setSignupType] = useState<AccountType>(
    _saved.signupType ?? "owner_operator",
  );
  const [tier, setTier] = useState<SubscriptionTier>(
    _saved.tier ?? "Records Vault",
  );

  // Identity States
  const [email, setEmail] = useState(_saved.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(_saved.name ?? "");
  const [companyName, setCompanyName] = useState(_saved.companyName ?? "");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  // Regulatory & Address States
  const [mcNumber, setMcNumber] = useState(_saved.mcNumber ?? "");
  const [taxId, setTaxId] = useState(_saved.taxId ?? "");
  const [address, setAddress] = useState(_saved.address ?? "");
  const [city, setCity] = useState(_saved.city ?? "");
  const [state, setState] = useState(_saved.state ?? "");
  const [zip, setZip] = useState(_saved.zip ?? "");

  // Equipment States
  const [truckUnitId, setTruckUnitId] = useState("");
  const [trailerUnitId, setTrailerUnitId] = useState("");
  const [selectedFreightTypes, setSelectedFreightTypes] = useState<
    FreightType[]
  >(["Dry Van"]);
  const [primaryFreightType, setPrimaryFreightType] =
    useState<FreightType>("Dry Van");

  // Payment States
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [additionalSeats, setAdditionalSeats] = useState(0);

  const [showPassword, setShowPassword] = useState(false);

  // Forgot password dialog state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");

  // Automation Pro (Tier 2) Specific States
  const [expenseCategories, setExpenseCategories] = useState<string[]>([
    "Fuel",
    "Maintenance",
    "Tolls",
    "Insurance",
    "Scale",
  ]);
  const [reimbursementRules, setReimbursementRules] =
    useState("Standard 14-day");
  const [baseJurisdiction, setBaseJurisdiction] = useState("IL");
  const [docNamingRules, setDocNamingRules] = useState(
    "{Date}_{Type}_{LoadNumber}",
  );
  const [accountantEmail, setAccountantEmail] = useState("");
  const [auditMode, setAuditMode] = useState(true);

  // Persist wizard state to sessionStorage whenever step or key fields change
  useEffect(() => {
    if (view === "login") return; // Don't persist login view — only wizard steps
    saveWizardState({
      view,
      email,
      name,
      companyName,
      signupType,
      tier,
      mcNumber,
      taxId,
      address,
      city,
      state,
      zip,
    });
  }, [
    view,
    email,
    name,
    companyName,
    signupType,
    tier,
    mcNumber,
    taxId,
    address,
    city,
    state,
    zip,
  ]);

  const validateEmail = (val: string) => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setEmailError(ok || val === "" ? "" : "Enter a valid email address.");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsProcessing(true);
    try {
      const user = await login(email, password);
      if (user) {
        onLogin(user);
      } else {
        setError("Invalid credentials.");
        setPassword("");
      }
    } catch {
      setError("Sign in failed. Please try again.");
      setPassword("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForgotPassword = async (emailInput: string) => {
    setForgotPasswordOpen(false);
    try {
      await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
    } catch (_err) {
      // Ignore network errors — server always returns 200
    }
    setForgotPasswordMessage(
      "If an account exists for this email, a reset link has been sent.",
    );
  };

  const handleSignupIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !companyName || !email || !password) {
      setError("Fill all fields.");
      return;
    }
    if (signupType === "owner_operator") {
      setView("tier_selection");
    } else {
      setTier(signupType === "fleet" ? "Fleet Core" : "Records Vault");
      setView("regulatory");
    }
  };

  const handleTierSelection = (e: React.FormEvent) => {
    e.preventDefault();
    setView("regulatory");
  };

  const handleRegulatoryDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxId || !address || !city || !state || !zip) {
      setError("Tax ID and full address required.");
      return;
    }
    setView("equipment");
  };

  const handleEquipmentSelection = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFreightTypes.length === 0) {
      setError("Select one equipment type.");
      return;
    }
    if (signupType === "owner_operator" && tier === "Automation Pro") {
      setView("money");
    } else {
      setView("payment");
    }
  };

  const handleMoneySettings = (e: React.FormEvent) => {
    e.preventDefault();
    setView("ifta");
  };

  const handleIftaSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setView("templates");
  };

  const handleTemplateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setView("invites");
  };

  const handleInvites = (e: React.FormEvent) => {
    e.preventDefault();
    setView("payment");
  };

  const processSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const { user, company } = await registerCompany(
        companyName,
        email,
        name,
        signupType,
        password,
        1 + additionalSeats,
        selectedFreightTypes,
        primaryFreightType,
        tier,
      );

      // Patch Company with full robust data
      const updatedCompany: Company = {
        ...company,
        subscriptionTier: tier,
        mcNumber,
        taxId,
        address,
        city,
        state,
        zip,
        equipmentRegistry: [
          ...(truckUnitId
            ? [
                {
                  id: truckUnitId,
                  type: "Truck" as const,
                  status: "Active" as const,
                  ownershipType: "Company Owned" as const,
                  providerName: "Internal",
                  dailyCost: 45,
                },
              ]
            : []),
          ...(trailerUnitId
            ? [
                {
                  id: trailerUnitId,
                  type: (primaryFreightType === "Intermodal"
                    ? "Chassis"
                    : "Trailer") as any,
                  status: "Active" as const,
                  ownershipType: "Company Owned" as const,
                  providerName: "Internal",
                  dailyCost: 20,
                },
              ]
            : []),
          ...company.equipmentRegistry,
        ],
        automationSettings:
          tier === "Automation Pro"
            ? {
                rules: [
                  {
                    id: uuidv4(),
                    name: "RateCon Auto-Intake",
                    enabled: true,
                    trigger: "doc_upload",
                    docType: "RateCon",
                    action: "create_load",
                    configuration: {
                      autoApprove: false,
                      extractFields: ["rate", "broker", "pickup", "delivery"],
                    },
                  },
                  {
                    id: uuidv4(),
                    name: "Fuel Receipt Scan",
                    enabled: true,
                    trigger: "photo_scan",
                    docType: "FuelReceipt",
                    action: "create_expense",
                    configuration: { tagAs: ["Fuel"] },
                  },
                ],
                docNamingRules,
              }
            : undefined,
        iftaSettings:
          tier === "Automation Pro"
            ? {
                baseJurisdiction,
                quarters: ["Q1", "Q2", "Q3", "Q4"],
                mileageSource: "Manual",
              }
            : undefined,
        moneySettings:
          tier === "Automation Pro"
            ? {
                defaultExpenseCategories: expenseCategories,
                reimbursementRules,
                payStructure: "Independent",
              }
            : undefined,
      };

      await updateCompany(updatedCompany);
      clearWizardState(); // Clear persisted wizard state on successful completion
      onLogin(user);
    } catch (e) {
      setError("Signup failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const accountTypes = [
    {
      id: "owner_operator",
      icon: User,
      title: "Owner Operator",
      desc: "Manage your own operations and equipment.",
    },
    {
      id: "fleet",
      icon: Building,
      title: "Fleet Carrier",
      desc: "Multiple trucks and drivers.",
    },
    {
      id: "independent_driver",
      icon: FileText,
      title: "Company Driver",
      desc: "Audit records while driving for a carrier.",
    },
  ];

  const freightOptions: { id: FreightType; label: string; icon: any }[] = [
    { id: "Dry Van", label: "Dry Van", icon: Box },
    { id: "Reefer", label: "Reefer", icon: ThermometerSnowflake },
    { id: "Flatbed", label: "Flatbed", icon: Construction },
    { id: "Intermodal", label: "Intermodal", icon: Container },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-700 overflow-hidden flex flex-col md:flex-row">
        {/* Left Visual Panel */}
        <div className="md:w-5/12 bg-slate-950 p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/40 mb-10">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter mb-4 uppercase">
              LoadPilot
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed font-bold">
              Dispatch management for trucking operations.
            </p>
          </div>
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-slate-300 text-xs font-black uppercase tracking-widest">
              <ShieldCheck className="w-5 h-5 text-blue-500" /> Regulatory
              Compliance
            </div>
            <div className="flex items-center gap-4 text-slate-300 text-xs font-black uppercase tracking-widest">
              <Scale className="w-5 h-5 text-blue-500" /> Granular Control
            </div>
            <div className="flex items-center gap-4 text-slate-300 text-xs font-black uppercase tracking-widest">
              <Globe className="w-5 h-5 text-blue-500" /> Fleet Intelligence
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="md:w-7/12 p-10 bg-slate-900/50 relative">
          <InputDialog
            open={forgotPasswordOpen}
            title="Reset Password"
            message="Enter your email address. If an account exists, you will receive a reset link."
            placeholder="you@company.com"
            inputType="email"
            submitLabel="Send Reset Link"
            cancelLabel="Cancel"
            onSubmit={handleForgotPassword}
            onCancel={() => setForgotPasswordOpen(false)}
          />

          {view === "login" && (
            <form
              onSubmit={handleLogin}
              className="space-y-8 animate-fade-in h-full flex flex-col justify-center"
            >
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                  Sign In
                </h2>
                <p className="text-slate-500 text-sm font-bold mt-1">
                  Sign in to your hub.
                </p>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-600" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    onBlur={(e) => validateEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white font-black"
                    placeholder="you@company.com"
                    autoComplete="email"
                    disabled={isProcessing}
                  />
                  {emailError && (
                    <p className="text-red-400 text-xs font-bold mt-1 ml-1">
                      {emailError}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-600" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white font-black"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isProcessing}
                  />
                </div>
              </div>
              {error && (
                <p className="text-red-400 text-xs font-black uppercase tracking-widest">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing In...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordMessage("");
                  setForgotPasswordOpen(true);
                }}
                className="w-full text-blue-400 text-xs font-black uppercase tracking-widest hover:text-blue-300 transition-colors"
                data-testid="forgot-password-link"
              >
                Forgot Password?
              </button>
              {forgotPasswordMessage && (
                <p className="text-green-400 text-xs font-bold text-center">
                  {forgotPasswordMessage}
                </p>
              )}
              <button
                type="button"
                onClick={() => setView("signup")}
                className="w-full text-slate-500 text-xs font-black uppercase tracking-widest hover:text-white transition-colors"
              >
                Create Account
              </button>
            </form>
          )}

          {view === "signup" && (
            <form
              onSubmit={handleSignupIdentity}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 1: Identity
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Select structure and basic details
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {accountTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSignupType(t.id as AccountType)}
                    className={`p-4 rounded-2xl border text-left flex gap-4 transition-all ${signupType === t.id ? "bg-blue-900/20 border-blue-500" : "bg-slate-800 border-slate-700"}`}
                  >
                    <t.icon
                      className={`w-6 h-6 ${signupType === t.id ? "text-blue-400" : "text-slate-600"}`}
                    />
                    <div>
                      <div className="text-sm font-black text-white uppercase">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        {t.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="Legal Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="Company Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-black"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => validateEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-black"
                    autoComplete="email"
                  />
                  {emailError && (
                    <p className="text-red-400 text-xs font-bold ml-1">
                      {emailError}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-black"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Continue Registry <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "tier_selection" && (
            <form
              onSubmit={handleTierSelection}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("signup")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Choose Your Tier
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Select the level of automation
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <button
                  type="button"
                  onClick={() => setTier("Records Vault")}
                  className={`p-6 rounded-3xl border text-left transition-all ${tier === "Records Vault" ? "bg-blue-900/20 border-blue-500 shadow-xl" : "bg-slate-800 border-slate-700"}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-lg font-black text-white uppercase tracking-tight">
                      Records Vault
                    </div>
                    <div className="text-blue-400 font-mono font-black">
                      $19/mo
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                    Best for manual entry + scan-first organization. Included: 1
                    truck, 1 user, 10 GB storage.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setTier("Automation Pro")}
                  className={`p-6 rounded-3xl border text-left transition-all relative overflow-hidden ${tier === "Automation Pro" ? "bg-blue-900/20 border-blue-500 shadow-xl" : "bg-slate-800 border-slate-700"}`}
                >
                  {tier === "Automation Pro" && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                      Selected
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-lg font-black text-white uppercase tracking-tight">
                      Automation Pro
                    </div>
                    <div className="text-blue-400 font-mono font-black">
                      $69/mo
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                    95% automation + deep analytics + tax/IFTA prep. Included: 1
                    truck, 2 users, 50 GB storage.
                  </p>
                </button>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl mt-4"
              >
                Confirm Tier <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "regulatory" && (
            <form
              onSubmit={handleRegulatoryDetails}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("signup")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 2: Company Details
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Verify legal and tax credentials
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    MC Number (Optional)
                  </label>
                  <input
                    placeholder="e.g., MC-123456"
                    value={mcNumber}
                    onChange={(e) => setMcNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Tax ID / EIN *
                  </label>
                  <input
                    required
                    placeholder="00-0000000"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                  Billing Street Address *
                </label>
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-black"
                  placeholder="123 Carrier Way"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <input
                  required
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
                <input
                  required
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
                <input
                  required
                  placeholder="ZIP"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Verify & Next <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "equipment" && (
            <form
              onSubmit={handleEquipmentSelection}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("regulatory")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 3: Initial Registry
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Onboard your first physical units
                  </p>
                </div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <input
                    placeholder="Power Unit # (Truck ID)"
                    value={truckUnitId}
                    onChange={(e) => setTruckUnitId(e.target.value)}
                    className="flex-1 bg-transparent border-b border-slate-800 py-2 outline-none font-black text-white"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-600 rounded-xl">
                    <Container className="w-6 h-6 text-white" />
                  </div>
                  <input
                    placeholder="Trailing Unit # (Trailer/Chassis)"
                    value={trailerUnitId}
                    onChange={(e) => setTrailerUnitId(e.target.value)}
                    className="flex-1 bg-transparent border-b border-slate-800 py-2 outline-none font-black text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {freightOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedFreightTypes([opt.id])}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${selectedFreightTypes.includes(opt.id) ? "bg-blue-900/20 border-blue-500" : "bg-slate-800 border-slate-700"}`}
                  >
                    <opt.icon
                      className={`w-8 h-8 ${selectedFreightTypes.includes(opt.id) ? "text-blue-400" : "text-slate-600"}`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Complete Registry <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "money" && (
            <form
              onSubmit={handleMoneySettings}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("equipment")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 4: Money Settings
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Expense and reimbursement rules
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Default Expense Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {expenseCategories.map((cat) => (
                      <span
                        key={cat}
                        className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black text-blue-400 flex items-center gap-2 uppercase"
                      >
                        {cat}
                        <button
                          type="button"
                          onClick={() =>
                            setExpenseCategories((prev) =>
                              prev.filter((c) => c !== cat),
                            )
                          }
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="bg-slate-900 border border-slate-800 border-dashed px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-500 hover:text-white uppercase"
                    >
                      + Add Category
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Reimbursement Rules
                  </label>
                  <input
                    value={reimbursementRules}
                    onChange={(e) => setReimbursementRules(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-black text-sm"
                    placeholder="e.g. Standard 14-day"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Continue <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "ifta" && (
            <form
              onSubmit={handleIftaSettings}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("money")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 5: IFTA + Mileage
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Base jurisdiction and capture mode
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Base Jurisdiction (State)
                  </label>
                  <input
                    required
                    value={baseJurisdiction}
                    onChange={(e) => setBaseJurisdiction(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-black text-sm"
                    placeholder="IL"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Mileage Capture Mode
                  </label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-black text-sm outline-none appearance-none">
                    <option value="Manual">Manual Entry</option>
                    <option value="CSV">CSV Import</option>
                    <option value="ELD">ELD Integration</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Save & Next <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "templates" && (
            <form
              onSubmit={handleTemplateSettings}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("ifta")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 6: Templates
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Automation and file naming rules
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Document Naming Rule
                  </label>
                  <input
                    value={docNamingRules}
                    onChange={(e) => setDocNamingRules(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs"
                  />
                  <p className="text-[8px] text-slate-600 font-bold ml-1">
                    Current: {new Date().toISOString().split("T")[0]}
                    _FuelReceipt_1234.pdf
                  </p>
                </div>
                <div className="bg-blue-600/5 border border-blue-500/20 p-4 rounded-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-black text-white uppercase">
                      Automation Active
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">
                    95% automation mode enabled. PDF parsing and OCR will
                    auto-create loads and link expenses to IFTA.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Continue <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "invites" && (
            <form
              onSubmit={handleInvites}
              className="space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setView("templates")}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase">
                    Step 7: Collaborators
                  </h2>
                  <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest">
                    Invite your team
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-black uppercase ml-1">
                    Accountant Seat (Optional)
                  </label>
                  <div className="relative">
                    <Users className="absolute left-4 top-3.5 w-5 h-5 text-slate-600" />
                    <input
                      type="email"
                      value={accountantEmail}
                      onChange={(e) => setAccountantEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white font-black text-sm"
                      placeholder="accountant@firm.com"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div>
                    <div className="text-[10px] font-black text-white uppercase">
                      Audit Mode
                    </div>
                    <div className="text-[8px] text-slate-600 font-bold uppercase">
                      Keep immutable trails for 7 years
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuditMode(!auditMode)}
                    className={`w-12 h-6 rounded-full transition-all relative ${auditMode ? "bg-blue-600" : "bg-slate-800"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${auditMode ? "right-1" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"
              >
                Complete Setup <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </form>
          )}

          {view === "payment" && (
            <form
              onSubmit={processSignup}
              className="space-y-8 animate-fade-in h-full flex flex-col justify-center"
            >
              <div className="text-center relative">
                <button
                  type="button"
                  onClick={() => setView("equipment")}
                  className="absolute left-0 top-0 p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-green-900/40">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white uppercase">
                  Secure Hub
                </h2>
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                  Complete Setup
                </p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-black text-white uppercase tracking-widest">
                    Subscription Plan
                  </span>
                  <span className="text-2xl font-black text-blue-400 font-mono">
                    $49.00<span className="text-xs text-slate-600">/mo</span>
                  </span>
                </div>
                <div className="space-y-4">
                  <input
                    placeholder="Card Number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="MM/YY"
                      className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
                    />
                    <input
                      placeholder="CVC"
                      className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
                    />
                  </div>
                </div>
              </div>
              <button
                disabled={isProcessing}
                type="submit"
                className="w-full bg-green-600 py-5 rounded-3xl text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl active:scale-95 flex items-center justify-center gap-4"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}{" "}
                Get Started
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
