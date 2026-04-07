import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  User,
  LoadData,
  LoadStatus,
  Company,
  ChangeRequest,
  VaultDoc,
  DriverSettlement,
  LOAD_STATUS,
} from "../types";
import {
  Truck,
  MapPin,
  CheckCircle2,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Clock,
  Calendar,
  Info,
  FileText,
  Camera,
  AlertTriangle,
  Plus,
  ChevronRight,
  Shield,
  DollarSign,
  Settings,
  X,
  Zap,
  ArrowLeft,
  Map as MapIcon,
  Navigation,
  Phone,
  ScanLine,
  Wallet,
  Fuel,
} from "lucide-react";
import { GlobalMapViewEnhanced } from "./GlobalMapViewEnhanced";
import { Scanner, IntakeAccumulatedData } from "./Scanner";
import { Toast } from "./Toast";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { InputDialog } from "./ui/InputDialog";
import { v4 as uuidv4 } from "uuid";
import { api } from "../services/api";
import { createException } from "../services/exceptionService";
import { getSettlements, saveFuelReceipt } from "../services/financialService";
import { patchLoadApi } from "../services/loadService";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  user: User;
  company?: Company;
  loads: LoadData[];
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  onLogout: () => void;
  onSaveLoad: (load: LoadData) => Promise<void>;
  onOpenHub?: (tab?: "feed" | "messaging" | "intelligence" | "reports") => void;
}

type ActiveTab =
  | "today"
  | "loads"
  | "documents"
  | "changes"
  | "profile"
  | "map"
  | "pay";

interface ToastState {
  message: string;
  type: "success" | "error" | "info" | "warning";
}

type ScannerIntent = "document" | "pickup" | "fuel";

const extensionForMimeType = (mimeType: string): string => {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("tiff")) return "tiff";
  return "bin";
};

const base64ToFile = (
  base64: string,
  mimeType: string,
  fileName: string,
): File => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
};

export const DriverMobileHome: React.FC<Props> = ({
  user,
  company,
  loads,
  isLoading,
  loadError,
  onRetry,
  onLogout,
  onSaveLoad,
  onOpenHub,
}) => {
  // --- localStorage persistence (R-P4-09, R-P4-10) ---
  const tabKey = `driver_${user.id}_activeTab`;
  const loadKey = `driver_${user.id}_selectedLoadId`;

  const getStoredTab = (): ActiveTab => {
    try {
      const val = localStorage.getItem(tabKey);
      if (
        val === "today" ||
        val === "loads" ||
        val === "documents" ||
        val === "changes" ||
        val === "profile" ||
        val === "map"
      ) {
        return val;
      }
    } catch {
      // quota or security error — fall through
    }
    return "today";
  };

  const getStoredLoadId = (): string | null => {
    try {
      return localStorage.getItem(loadKey);
    } catch {
      return null;
    }
  };

  const [activeTab, setActiveTabState] = useState<ActiveTab>(getStoredTab);
  const [selectedLoadId, setSelectedLoadIdState] = useState<string | null>(
    getStoredLoadId,
  );
  const [scannerIntent, setScannerIntent] = useState<ScannerIntent | null>(
    null,
  );
  const [isCreatingChange, setIsCreatingChange] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loadOverrides, setLoadOverrides] = useState<
    Record<string, Partial<LoadData>>
  >({});
  // Breakdown modal flow state
  const [breakdownStep, setBreakdownStep] = useState<
    "idle" | "notes" | "tow" | "cargo"
  >("idle");
  const [breakdownNotes, setBreakdownNotes] = useState("");
  const [breakdownNeedsTow, setBreakdownNeedsTow] = useState(false);

  // Driver intake flow state
  const [intakeStep, setIntakeStep] = useState<"idle" | "scanning" | "review">(
    "idle",
  );
  const [intakeFormData, setIntakeFormData] = useState<{
    pickupCity: string;
    pickupState: string;
    pickupFacility: string;
    dropoffCity: string;
    dropoffState: string;
    dropoffFacility: string;
    pickupDate: string;
    commodity: string;
    weight: string;
    referenceNumber: string;
    specialInstructions: string;
    scannedDocTypes: string[];
    scannedDocImages: Array<{
      base64: string;
      mimeType: string;
      docType: string;
    }>;
  }>({
    pickupCity: "",
    pickupState: "",
    pickupFacility: "",
    dropoffCity: "",
    dropoffState: "",
    dropoffFacility: "",
    pickupDate: "",
    commodity: "",
    weight: "",
    referenceNumber: "",
    specialInstructions: "",
    scannedDocTypes: [],
    scannedDocImages: [],
  });
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  // Fuel receipt scanning state
  const [fuelReviewData, setFuelReviewData] = useState<{
    vendorName: string;
    gallons: string;
    pricePerGallon: string;
    totalCost: string;
    transactionDate: string;
    stateCode: string;
    truckId: string;
  } | null>(null);
  const [fuelSubmitting, setFuelSubmitting] = useState(false);

  // Driver pay / settlement state
  const [mySettlements, setMySettlements] = useState<DriverSettlement[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);

  // Wrap setters to persist to localStorage (R-P4-10)
  const setActiveTab = (tab: ActiveTab) => {
    try {
      localStorage.setItem(tabKey, tab);
    } catch {
      // quota error — ignore
    }
    setActiveTabState(tab);
  };

  const setSelectedLoadId = (id: string | null) => {
    try {
      if (id === null) {
        localStorage.removeItem(loadKey);
      } else {
        localStorage.setItem(loadKey, id);
      }
    } catch {
      // quota error — ignore
    }
    setSelectedLoadIdState(id);
  };

  // API-backed change requests and documents
  const [changeRequests, setChangeRequests] = useState<
    Array<{
      id: string;
      label: string;
      status: string;
      created_at: string;
      entity_id: string;
    }>
  >([]);
  const [loadDocuments, setLoadDocuments] = useState<
    Array<{
      id: string;
      document_type: string;
      original_name: string;
      status: string;
      created_at: string;
    }>
  >([]);

  const mergedLoads = useMemo(
    () =>
      loads.map((load) => ({
        ...load,
        ...(loadOverrides[load.id] || {}),
      })),
    [loads, loadOverrides],
  );
  const activeLoads = useMemo(
    () =>
      mergedLoads.filter(
        (l) =>
          l.driverId === user.id &&
          !["delivered", "completed"].includes(l.status),
      ),
    [mergedLoads, user.id],
  );
  const selectedLoad = useMemo(
    () => mergedLoads.find((l) => l.id === selectedLoadId),
    [mergedLoads, selectedLoadId],
  );

  // Stable list of driver load IDs for useEffect dependency
  const driverLoadIds = useMemo(
    () =>
      loads
        .filter((l) => l.driverId === user.id)
        .map((l) => l.id)
        .join(","),
    [loads, user.id],
  );

  // Fetch change requests only when on "changes" tab
  useEffect(() => {
    if (activeTab !== "changes") return;
    if (!driverLoadIds) return;
    const controller = new AbortController();
    const ids = driverLoadIds.split(",");

    Promise.all(
      ids.map((loadId) =>
        api
          .get(`/loads/${loadId}/change-requests`, { signal: controller.signal })
          .then((data: any) => data?.changeRequests || [])
          .catch(() => []),
      ),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        const allRequests = results.flat();
        allRequests.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setChangeRequests(allRequests);
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      controller.abort();
    };
  }, [driverLoadIds, activeTab]);

  // Fetch driver's own settlements when on "pay" tab
  useEffect(() => {
    if (activeTab !== "pay") return;
    const controller = new AbortController();
    setSettlementsLoading(true);
    getSettlements(user.id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setMySettlements(data || []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMySettlements([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettlementsLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [activeTab, user.id]);

  // Fetch documents for the selected load
  useEffect(() => {
    if (!selectedLoadId) return;
    const controller = new AbortController();
    api
      .get(`/documents?load_id=${selectedLoadId}`, { signal: controller.signal })
      .then((data: any) => {
        if (!controller.signal.aborted && data?.documents) {
          setLoadDocuments(data.documents);
        }
      })
      .catch(() => {
        /* ignore fetch errors silently */
      });
    return () => {
      controller.abort();
    };
  }, [selectedLoadId]);

  // Visibility Logic
  const v = {
    rate: !company?.driverVisibilitySettings?.hideRates,
    brokerContacts: !company?.driverVisibilitySettings?.hideBrokerContacts,
    customerName: !company?.driverVisibilitySettings?.maskCustomerName,
    pay: company?.driverVisibilitySettings?.showDriverPay,
    rateCon: company?.driverVisibilitySettings?.allowRateCon,
  };

  // Status update with toast feedback (R-P4-05, R-P4-06)
  const handleStatusUpdate = async (newStatus: LoadStatus) => {
    if (!selectedLoad) return;
    try {
      await onSaveLoad({ ...selectedLoad, status: newStatus });
      setToast({
        message: `Status updated to ${newStatus}`,
        type: "success",
      });
    } catch {
      setToast({ message: "Failed to update status", type: "error" });
    }
  };

  // Scanner data extracted handler (R-P4-03)
  const closeScanner = () => {
    setScannerIntent(null);
  };

  const handleDocumentDataExtracted = (data: unknown) => {
    if (!selectedLoad) return;
    // Attach extracted document metadata to the load
    const docMeta = data as { docType?: string; confidence?: number };
    const updatedLoad: LoadData = {
      ...selectedLoad,
      bolUrls: [
        ...(selectedLoad.bolUrls || []),
        ...(docMeta.docType === "BOL" ? [`scanned_${Date.now()}`] : []),
      ],
      podUrls: [
        ...(selectedLoad.podUrls || []),
        ...(docMeta.docType === "POD" ? [`scanned_${Date.now()}`] : []),
      ],
    };
    onSaveLoad(updatedLoad).catch(() => {
      setToast({ message: "Failed to save document", type: "error" });
    });
    closeScanner();
  };

  const handlePickupScanExtracted = async (data: unknown) => {
    if (!selectedLoad) return;

    const extracted = data as {
      weight?: number | string;
      commodity?: string;
      bolNumber?: string;
      bol_number?: string;
      referenceNumber?: string;
      referenceNumbers?: string[];
      pickupDate?: string;
      specialInstructions?: string;
      notes?: string;
    };

    const normalizedWeight =
      extracted.weight !== undefined && extracted.weight !== ""
        ? Number(extracted.weight)
        : undefined;
    const normalizedCommodity = extracted.commodity?.trim() || undefined;
    const normalizedReference =
      extracted.referenceNumber?.trim() ||
      extracted.referenceNumbers?.find(
        (value) => typeof value === "string" && value.trim().length > 0,
      );
    const normalizedBolNumber =
      extracted.bolNumber?.trim() ||
      extracted.bol_number?.trim() ||
      normalizedReference;
    const normalizedPickupDate = extracted.pickupDate?.trim() || undefined;
    const normalizedNotes =
      extracted.specialInstructions?.trim() || extracted.notes?.trim() || undefined;

    if (
      normalizedWeight === undefined &&
      normalizedCommodity === undefined &&
      normalizedBolNumber === undefined &&
      normalizedPickupDate === undefined &&
      normalizedNotes === undefined
    ) {
      setToast({
        message: "Scan did not return any pickup fields to update.",
        type: "warning",
      });
      closeScanner();
      return;
    }

    try {
      const updatedLoad = await patchLoadApi(selectedLoad.id, {
        weight:
          normalizedWeight !== undefined && Number.isFinite(normalizedWeight)
            ? normalizedWeight
            : undefined,
        commodity: normalizedCommodity,
        bolNumber: normalizedBolNumber,
        referenceNumber: normalizedReference,
        pickupDate: normalizedPickupDate,
        notes: normalizedNotes,
      });

      const changedFields = [
        normalizedWeight !== undefined ? "weight" : null,
        normalizedCommodity ? "commodity" : null,
        normalizedBolNumber ? "BOL" : null,
        normalizedPickupDate ? "pickup date" : null,
        normalizedNotes ? "notes" : null,
      ].filter(Boolean) as string[];

      setLoadOverrides((prev) => ({
        ...prev,
        [selectedLoad.id]: {
          ...updatedLoad,
          specialInstructions:
            normalizedNotes || updatedLoad.specialInstructions,
        },
      }));

      setToast({
        message: `Pickup scan updated ${changedFields.join(", ")}.`,
        type: "success",
      });
    } catch {
      setToast({
        message: "Failed to update load from pickup scan.",
        type: "error",
      });
    } finally {
      closeScanner();
    }
  };

  const createChangeRequest = async (type: ChangeRequest["type"]) => {
    const loadId = selectedLoadId || "GENERAL";
    try {
      const result: any = await api.post(`/loads/${loadId}/change-requests`, {
        type,
        notes: "",
        isUrgent: false,
      });
      if (result) {
        setChangeRequests((prev) => [result, ...prev]);
      }
      setIsCreatingChange(false);
      setToast({ message: `${type} request submitted`, type: "success" });
    } catch {
      setToast({ message: "Failed to submit change request", type: "error" });
      setIsCreatingChange(false);
    }
  };

  // --- Driver Intake Handlers ---

  /** Open the scanner in intake mode */
  const startIntake = useCallback(() => {
    setIntakeStep("scanning");
  }, []);

  /** Handle data extracted from Scanner in intake mode */
  const handleIntakeDataExtracted = useCallback(
    (data: IntakeAccumulatedData) => {
      setIntakeFormData({
        pickupCity: data.pickupCity || "",
        pickupState: data.pickupState || "",
        pickupFacility: data.pickupFacility || "",
        dropoffCity: data.dropoffCity || "",
        dropoffState: data.dropoffState || "",
        dropoffFacility: data.dropoffFacility || "",
        pickupDate: data.pickupDate || "",
        commodity: data.commodity || "",
        weight: data.weight || "",
        referenceNumber: (data.referenceNumbers || []).join(", "),
        specialInstructions: data.specialInstructions || "",
        scannedDocTypes: data.scannedDocTypes || [],
        scannedDocImages: data.scannedDocImages || [],
      });
      setIntakeStep("review");
    },
    [],
  );

  /** Submit the intake review form to create a new pending load */
  const submitIntake = useCallback(async () => {
    // Validate required fields
    if (!intakeFormData.pickupCity && !intakeFormData.pickupFacility) {
      setToast({ message: "Pickup location is required", type: "error" });
      return;
    }
    if (!intakeFormData.dropoffCity && !intakeFormData.dropoffFacility) {
      setToast({ message: "Dropoff location is required", type: "error" });
      return;
    }
    if (!intakeFormData.pickupDate) {
      setToast({ message: "Pickup date is required", type: "error" });
      return;
    }
    if (!intakeFormData.commodity) {
      setToast({ message: "Commodity description is required", type: "error" });
      return;
    }

    setIntakeSubmitting(true);
    try {
      // Build canonical LoadData WITH legs — the canonical source of
      // route/location truth.  Without legs the load loses its pickup/dropoff
      // after a server round-trip because mapRowToLoadData derives
      // pickup/dropoff from the legs array.
      const loadId = uuidv4();
      const pickupLegId = uuidv4();
      const dropoffLegId = uuidv4();
      const loadNumber = `INT-${Date.now().toString(36).toUpperCase()}`;

      const pickupLeg = {
        id: pickupLegId,
        type: "Pickup" as const,
        location: {
          city: intakeFormData.pickupCity,
          state: intakeFormData.pickupState,
          facilityName: intakeFormData.pickupFacility || "",
        },
        date: intakeFormData.pickupDate,
        appointmentTime: "",
        completed: false,
      };

      const dropoffLeg = {
        id: dropoffLegId,
        type: "Dropoff" as const,
        location: {
          city: intakeFormData.dropoffCity,
          state: intakeFormData.dropoffState,
          facilityName: intakeFormData.dropoffFacility || "",
        },
        date: "",
        appointmentTime: "",
        completed: false,
      };

      const newLoad: LoadData = {
        id: loadId,
        companyId: user.companyId || "",
        driverId: user.id,
        loadNumber,
        status: LOAD_STATUS.Draft as LoadStatus,
        carrierRate: 0,
        driverPay: 0,
        pickupDate: intakeFormData.pickupDate,
        pickup: {
          city: intakeFormData.pickupCity,
          state: intakeFormData.pickupState,
          facilityName: intakeFormData.pickupFacility || undefined,
        },
        dropoff: {
          city: intakeFormData.dropoffCity,
          state: intakeFormData.dropoffState,
          facilityName: intakeFormData.dropoffFacility || undefined,
        },
        legs: [pickupLeg, dropoffLeg],
        commodity: intakeFormData.commodity || undefined,
        weight: intakeFormData.weight
          ? parseFloat(intakeFormData.weight) || undefined
          : undefined,
        bolNumber: intakeFormData.referenceNumber || undefined,
        specialInstructions: intakeFormData.specialInstructions || undefined,
        dispatchNotes: `Driver intake via document scan. Docs: ${intakeFormData.scannedDocTypes.join(", ")}`,
      };

      // Save via the canonical onSaveLoad path (storageService.saveLoad ->
      // loadService.createLoad -> POST /api/loads) which calls
      // mapLoadDataToPayload and writes legs to load_legs table.  The
      // handleSaveLoad wrapper in App.tsx then calls refreshData() to reload
      // from server truth so the load board, schedule, and this component all
      // see the same canonical shape.
      await onSaveLoad(newLoad);

      // Upload scanned document artifacts to the canonical document domain
      // (POST /api/documents).  Uses the same loadId so documents are linked.
      let uploadFailures = 0;
      const totalDocs = intakeFormData.scannedDocImages?.length ?? 0;
      if (totalDocs > 0) {
        for (const [index, doc] of intakeFormData.scannedDocImages!.entries()) {
          try {
            const documentType = doc.docType || "BOL";
            const fileName = `driver-intake-${documentType.toLowerCase()}-${index + 1}.${extensionForMimeType(doc.mimeType)}`;
            const formData = new FormData();
            formData.append(
              "file",
              base64ToFile(doc.base64, doc.mimeType, fileName),
            );
            formData.append("document_type", documentType);
            formData.append("load_id", loadId);
            formData.append(
              "description",
              `Driver intake upload (${documentType}) for ${loadNumber}`,
            );
            await api.postFormData("/documents", formData);
          } catch {
            // Non-blocking: load is saved, document upload failures are recoverable
            uploadFailures++;
          }
        }
      }

      setIntakeStep("idle");
      setIntakeFormData({
        pickupCity: "",
        pickupState: "",
        pickupFacility: "",
        dropoffCity: "",
        dropoffState: "",
        dropoffFacility: "",
        pickupDate: "",
        commodity: "",
        weight: "",
        referenceNumber: "",
        specialInstructions: "",
        scannedDocTypes: [],
        scannedDocImages: [],
      });

      let toastMessage: string;
      if (totalDocs === 0) {
        toastMessage = "Intake submitted";
      } else if (uploadFailures > 0) {
        toastMessage = `Intake submitted. ${uploadFailures} of ${totalDocs} document(s) failed to upload — please retry from load detail.`;
      } else {
        toastMessage = "Intake submitted and documents uploaded";
      }
      setToast({
        message: toastMessage,
        type: uploadFailures > 0 ? "warning" : "success",
      });
    } catch {
      setToast({ message: "Failed to submit intake", type: "error" });
    } finally {
      setIntakeSubmitting(false);
    }
  }, [intakeFormData, user.id, user.companyId, onSaveLoad]);

  /** Handle data extracted from Scanner in fuel mode — show review step */
  const handleFuelDataExtracted = useCallback((data: any) => {
    setFuelReviewData({
      vendorName: data?.vendorName || "",
      gallons: data?.gallons?.toString() || "",
      pricePerGallon: data?.pricePerGallon?.toString() || "",
      totalCost: data?.totalCost?.toString() || "",
      transactionDate: data?.transactionDate || new Date().toISOString().split("T")[0],
      stateCode: data?.stateCode || "",
      truckId: data?.truckId || "",
    });
    setScannerIntent(null);
  }, []);

  /** Submit reviewed fuel receipt data */
  const submitFuelReceipt = useCallback(async () => {
    if (!fuelReviewData) return;
    if (!fuelReviewData.vendorName || !fuelReviewData.gallons || !fuelReviewData.totalCost || !fuelReviewData.stateCode) {
      setToast({ message: "Vendor, gallons, total cost, and state are required", type: "error" });
      return;
    }
    setFuelSubmitting(true);
    try {
      await saveFuelReceipt({
        vendorName: fuelReviewData.vendorName,
        gallons: parseFloat(fuelReviewData.gallons) || 0,
        pricePerGallon: parseFloat(fuelReviewData.pricePerGallon) || 0,
        totalCost: parseFloat(fuelReviewData.totalCost) || 0,
        transactionDate: fuelReviewData.transactionDate,
        stateCode: fuelReviewData.stateCode.toUpperCase(),
        truckId: fuelReviewData.truckId || undefined,
      });
      setToast({ message: "Fuel receipt saved successfully", type: "success" });
      setFuelReviewData(null);
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to save fuel receipt", type: "error" });
    } finally {
      setFuelSubmitting(false);
    }
  }, [fuelReviewData]);

  /** Cancel the intake flow */
  const cancelIntake = useCallback(() => {
    setIntakeStep("idle");
    setIntakeFormData({
      pickupCity: "",
      pickupState: "",
      pickupFacility: "",
      dropoffCity: "",
      dropoffState: "",
      dropoffFacility: "",
      pickupDate: "",
      commodity: "",
      weight: "",
      referenceNumber: "",
      specialInstructions: "",
      scannedDocTypes: [],
      scannedDocImages: [],
    });
  }, []);

  // Sub-components
  const LoadCard: React.FC<{ load: LoadData }> = ({ load }) => (
    <div
      key={load.id}
      onClick={() => {
        setSelectedLoadId(load.id);
        setActiveTab("today");
      }}
      className="bg-[#0a0f1e] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl active:scale-95 transition-all"
    >
      <div className="flex justify-between items-start">
        <span className="bg-blue-600/10 text-blue-500 text-xs font-black px-2 py-0.5 rounded border border-blue-500/20 uppercase">
          ID: {load.loadNumber}
        </span>
        <div className="text-right">
          <div className="text-xs font-black text-slate-500 uppercase">
            Status
          </div>
          <div className="text-xs font-black text-blue-400 uppercase">
            {load.status}
          </div>
        </div>
      </div>
      <h3 className="text-lg font-black text-white uppercase tracking-tight">
        {load.pickup?.city ?? ""} → {load.dropoff?.city ?? ""}
      </h3>
      <div className="flex items-center gap-4 py-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
          <Calendar className="w-3 h-3" /> {load.pickupDate}
        </div>
        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
          <Truck className="w-3 h-3" /> {load.freightType}
        </div>
      </div>
    </div>
  );

  // --- MAIN RENDER LOGIC ---

  if (isLoading) {
    return (
      <div
        className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter p-6"
        data-testid="team2-driver-mobile-home-loading"
      >
        <LoadingSkeleton variant="list" count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter"
        data-testid="team2-driver-mobile-home-error"
      >
        <ErrorState message={loadError} onRetry={onRetry ?? (() => {})} />
      </div>
    );
  }

  if (selectedLoad) {
    return (
      <div
        className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter"
        data-testid="team2-driver-mobile-home"
      >
        <header className="p-4 bg-[#0a0f1e] border-b border-white/5 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSelectedLoadId(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">
              Back
            </span>
          </button>
          <h1 className="text-lg font-black tracking-tighter uppercase">
            Job Detail
          </h1>
          <button
            onClick={() => onOpenHub?.("messaging")}
            aria-label="Open messages"
            className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
          {/* Header Info */}
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                {v.customerName
                  ? selectedLoad.pickup?.facilityName || "N/A"
                  : "Confidential Facility"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase">
              {selectedLoad.pickup?.city ?? ""},{" "}
              {selectedLoad.pickup?.state ?? ""}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0a0f1e] p-4 rounded-3xl border border-white/5">
              <div className="text-xs font-black text-slate-500 uppercase mb-1">
                Appointment
              </div>
              <div className="text-xs font-black text-white">
                {selectedLoad.pickupDate}
              </div>
            </div>
            <div className="bg-[#0a0f1e] p-4 rounded-3xl border border-white/5">
              <div className="text-xs font-black text-slate-500 uppercase mb-1">
                Unit #
              </div>
              <div className="text-xs font-black text-white">
                {selectedLoad.truckNumber || "Unassigned"}
              </div>
            </div>
          </div>

          {/* Stops Timeline */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Stop Route
            </h3>
            <div className="relative pl-6 space-y-12">
              <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-800" />
              {/* Pickup */}
              <div className="relative">
                <div className="absolute -left-[1.35rem] top-1.5 w-4 h-4 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)] border-4 border-[#020617]" />
                <div className="space-y-4">
                  <div className="text-sm font-black text-white uppercase flex justify-between">
                    Pickup
                    <span className="text-xs text-blue-500">
                      Scheduled: {selectedLoad.pickupDate}
                    </span>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      Load #: {selectedLoad.loadNumber}
                    </div>
                    {selectedLoad.specialInstructions && (
                      <div className="text-xs font-bold text-slate-400 uppercase">
                        Instructions: {selectedLoad.specialInstructions}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Dropoff */}
              <div className="relative">
                <div className="absolute -left-[1.35rem] top-1.5 w-4 h-4 rounded-full bg-slate-700 border-4 border-[#020617]" />
                <div className="space-y-4">
                  <div className="text-sm font-black text-white uppercase flex justify-between">
                    Dropoff
                    <span className="text-xs text-slate-600">
                      ETA: {selectedLoad.pickupDate}
                    </span>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      Destination: {selectedLoad.dropoff?.city ?? ""},{" "}
                      {selectedLoad.dropoff?.state ?? ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Checklist */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3" /> Documents
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setScannerIntent("fuel")}
                  aria-label="Scan Fuel Receipt"
                  className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase"
                >
                  <Fuel className="w-3 h-3" /> Fuel
                </button>
                <button
                  onClick={() => setScannerIntent("pickup")}
                  aria-label="Scan at Pickup"
                  className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase"
                >
                  <ScanLine className="w-3 h-3" /> Scan at Pickup
                </button>
                <button
                  onClick={() => setScannerIntent("document")}
                  aria-label="Upload document"
                  className="flex items-center gap-2 text-xs font-black text-blue-500 uppercase"
                >
                  <Plus className="w-3 h-3" /> Upload
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {loadDocuments.length > 0
                ? loadDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-[#0a0f1e] p-4 rounded-2xl border border-white/5 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-300 uppercase">
                          {doc.document_type}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {doc.original_name}
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-500/50" />
                    </div>
                  ))
                : ["BOL (Pickup)", "Weight Scale", "POD (Delivery)"].map(
                    (doc) => (
                      <div
                        key={doc}
                        className="bg-[#0a0f1e] p-4 rounded-2xl border border-white/5 flex justify-between items-center"
                      >
                        <div className="text-xs font-bold text-slate-300 uppercase">
                          {doc}
                        </div>
                        <AlertTriangle className="w-4 h-4 text-orange-500/50" />
                      </div>
                    ),
                  )}
            </div>
          </section>

          {/* Financial Visibility (Masked) */}
          {v.pay && (
            <section className="bg-emerald-600/5 rounded-3xl p-6 border border-emerald-500/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">
                  Est. Trip Pay
                </h3>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-white">
                ${selectedLoad.driverPay || "0.00"}
              </div>
              <p className="text-xs text-emerald-700 font-bold uppercase mt-2">
                Calculated by {user.payModel || "Percentage"}
              </p>
            </section>
          )}
        </main>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex gap-4">
          <button
            onClick={() => setIsCreatingChange(true)}
            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all"
          >
            Report Issue
          </button>
          {selectedLoad.status === "planned" && (
            <button
              onClick={() => handleStatusUpdate(LOAD_STATUS.Active)}
              className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 transition-all"
            >
              Start Trip
            </button>
          )}
          {selectedLoad.status === "in_transit" && (
            <button
              onClick={() => handleStatusUpdate(LOAD_STATUS.Arrived)}
              className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-green-900/40 transition-all"
            >
              Arrived At Stop
            </button>
          )}
        </div>

        {/* Toast notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}

        {/* Breakdown flow — step 1: describe issue */}
        <InputDialog
          open={breakdownStep === "notes"}
          title="Report Breakdown"
          message="Describe the breakdown (Engine, Tire, Reefer, etc):"
          placeholder="e.g. Right rear tire blow-out on I-40"
          onSubmit={(notes) => {
            setBreakdownNotes(notes);
            setBreakdownStep("tow");
          }}
          onCancel={() => setBreakdownStep("idle")}
          submitLabel="Next"
        />
        {/* Breakdown flow — step 2: tow needed? */}
        <ConfirmDialog
          open={breakdownStep === "tow"}
          title="Tow Truck Required?"
          message="Is a TOW TRUCK required immediately?"
          confirmLabel="Yes — Tow Needed"
          cancelLabel="No Tow"
          danger
          onConfirm={() => {
            setBreakdownNeedsTow(true);
            setBreakdownStep("cargo");
          }}
          onCancel={() => {
            setBreakdownNeedsTow(false);
            setBreakdownStep("cargo");
          }}
        />
        {/* Breakdown flow — step 3: cargo at risk? */}
        <ConfirmDialog
          open={breakdownStep === "cargo"}
          title="Cargo at Risk?"
          message="Is the CARGO at risk (Temp/Security)?"
          confirmLabel="Yes — High Risk"
          cancelLabel="No Risk"
          danger
          onConfirm={() => {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              isActionRequired: true,
            });
            createException({
              type: "SAFETY",
              severity: 4,
              status: "OPEN",
              description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: HIGH`,
              entityType: "LOAD",
              entityId: selectedLoad.id,
            });
            setIsCreatingChange(false);
            setBreakdownStep("idle");
            setToast({
              message:
                "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
              type: "error",
            });
          }}
          onCancel={() => {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              isActionRequired: true,
            });
            createException({
              type: "SAFETY",
              severity: 2,
              status: "OPEN",
              description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: LOW`,
              entityType: "LOAD",
              entityId: selectedLoad.id,
            });
            setIsCreatingChange(false);
            setBreakdownStep("idle");
            setToast({
              message:
                "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
              type: "error",
            });
          }}
        />

        {/* Scanner Modal Overlay (R-P4-02) */}
        {scannerIntent && (
          <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-[#0a0f1e] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-white/5">
                <h2 className="text-base font-black text-white uppercase tracking-tight">
                  {scannerIntent === "pickup"
                    ? "Scan at Pickup"
                    : scannerIntent === "fuel"
                      ? "Scan Fuel Receipt"
                      : "Scan Document"}
                </h2>
                <button
                  onClick={closeScanner}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Scanner
                onDataExtracted={
                  scannerIntent === "fuel"
                    ? handleFuelDataExtracted
                    : scannerIntent === "pickup"
                      ? handlePickupScanExtracted
                      : handleDocumentDataExtracted
                }
                onCancel={closeScanner}
                onDismiss={closeScanner}
                mode={scannerIntent === "fuel" ? "fuel" : "load"}
              />
            </div>
          </div>
        )}

        {/* Fuel Receipt Review */}
        {fuelReviewData && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <div className="bg-[#020617] border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                  Review Fuel Receipt
                </h3>
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                  Verify extracted data before saving
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">Vendor *</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                    value={fuelReviewData.vendorName}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, vendorName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">Gallons *</label>
                  <input
                    type="number"
                    step="0.001"
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                    value={fuelReviewData.gallons}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, gallons: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">Price/Gal</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                    value={fuelReviewData.pricePerGallon}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, pricePerGallon: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">Total Cost *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                    value={fuelReviewData.totalCost}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, totalCost: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">State *</label>
                  <input
                    type="text"
                    maxLength={2}
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white uppercase outline-none"
                    value={fuelReviewData.stateCode}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, stateCode: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">Date *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                    value={fuelReviewData.transactionDate}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, transactionDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-black text-slate-600 uppercase">Truck ID</label>
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white uppercase outline-none"
                    value={fuelReviewData.truckId}
                    onChange={(e) => setFuelReviewData({ ...fuelReviewData, truckId: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setFuelReviewData(null)}
                  className="flex-1 py-3 bg-white/5 text-white border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={submitFuelReceipt}
                  disabled={fuelSubmitting}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
                >
                  {fuelSubmitting ? "Saving..." : "Save Fuel Entry"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Request Modal */}
        {isCreatingChange && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-6">
            <div className="w-full max-w-sm bg-[#0a0f1e] rounded-[2.5rem] p-8 space-y-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  Request Extra
                </h2>
                <button onClick={() => setIsCreatingChange(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["DETENTION", "LUMPER", "LAYOVER", "TONU"].map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      createChangeRequest(type as ChangeRequest["type"])
                    }
                    className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-black text-slate-300 hover:bg-blue-600 hover:text-white transition-all uppercase"
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">
                  Emergency / Breakdown
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setBreakdownStep("notes")}
                    className="w-full p-4 bg-red-600/10 border border-red-500/20 rounded-2xl text-xs font-black text-red-500 hover:bg-red-600 hover:text-white transition-all uppercase flex items-center justify-between"
                  >
                    Report Breakdown
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter"
      data-testid="team2-driver-mobile-home"
    >
      {/* Standard Header */}
      <header className="p-4 bg-[#0a0f1e] border-b border-white/5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none">
              LoadPilot
            </h1>
            <p className="text-xs text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
              Driver
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          {/* Phone link (R-P4-08) */}
          {company?.phone && (
            <a
              href={`tel:${company.phone}`}
              aria-label="Call Dispatch"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600/10 text-emerald-500 border border-emerald-500/20"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => onOpenHub?.("messaging")}
            aria-label="Open messages"
            className="relative"
          >
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0a0f1e]" />
          </button>
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sub-Views Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-24">
        {activeTab === "today" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Today Status Bar */}
            <div className="bg-[#0a0f1e] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Active Dispatch
                </h2>
                <p className="text-lg font-black text-white uppercase mt-1">
                  {activeLoads.length > 0
                    ? `${activeLoads.length} Load(s) In Queue`
                    : "No Assignments"}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            </div>

            {/* New Load Intake CTA */}
            <button
              data-testid="new-intake-today"
              onClick={startIntake}
              className="w-full py-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-2xl text-xs font-black uppercase tracking-widest border border-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <ScanLine className="w-5 h-5" />
              New Load Intake — Scan Documents
            </button>

            {/* Scan Fuel Receipt CTA */}
            <button
              onClick={() => setScannerIntent("fuel")}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
            >
              <Fuel className="w-4 h-4" />
              Scan Fuel Receipt
            </button>

            {/* Message Dispatch button (R-P4-07) */}
            {activeLoads.length > 0 && (
              <button
                onClick={() => onOpenHub?.("messaging")}
                className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 rounded-2xl text-xs font-black uppercase tracking-widest border border-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Message Dispatch
              </button>
            )}

            {/* Active Load List */}
            <div className="space-y-4">
              {activeLoads.map((load) => (
                <LoadCard key={load.id} load={load} />
              ))}
              {activeLoads.length === 0 && (
                <EmptyState
                  icon={<Truck className="w-12 h-12" />}
                  title="No Active Loads"
                  description="You have no loads currently assigned. Check back soon for new dispatch assignments."
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "loads" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Load History
              </h2>
              <button
                data-testid="new-intake-loads"
                onClick={startIntake}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
              >
                <ScanLine className="w-4 h-4" />
                New Intake
              </button>
            </div>
            {loads.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-12 h-12" />}
                title="No Load History"
                description="Your completed and past loads will appear here."
              />
            ) : (
              <div className="space-y-4">
                {loads.map((load) => (
                  <LoadCard key={load.id} load={load} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              My Documents
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="h-32 bg-[#0a0f1e] border border-blue-500/20 rounded-[2rem] flex flex-col items-center justify-center gap-3">
                <Camera className="w-6 h-6 text-blue-500" />
                <span className="text-xs font-black text-white uppercase">
                  Scan New
                </span>
              </button>
              <button className="h-32 bg-slate-900 border border-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-3">
                <FileText className="w-6 h-6 text-slate-500" />
                <span className="text-xs font-black text-white uppercase">
                  Vault Access
                </span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "changes" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Change Requests
              </h2>
              <button
                onClick={() => setIsCreatingChange(true)}
                className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"
              >
                <Plus />
              </button>
            </div>
            <div className="space-y-4">
              {changeRequests.map((req) => {
                const statusColors: Record<string, string> = {
                  PENDING: "bg-orange-500/10 text-orange-500",
                  APPROVED: "bg-green-500/10 text-green-500",
                  REJECTED: "bg-red-500/10 text-red-500",
                };
                const badgeClass =
                  statusColors[req.status] || "bg-slate-500/10 text-slate-500";
                return (
                  <div
                    key={req.id}
                    className="bg-[#0a0f1e] p-5 rounded-2xl border border-white/5 flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs font-black text-white uppercase tracking-tight">
                        {req.label}
                      </div>
                      <div className="text-xs text-slate-500 font-bold uppercase mt-1">
                        {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-black uppercase ${badgeClass}`}
                    >
                      {req.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "pay" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <Wallet className="w-8 h-8 text-emerald-500" />
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  My Pay
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase">
                  Settlement History
                </p>
              </div>
            </div>

            {settlementsLoading && <LoadingSkeleton variant="card" count={3} />}

            {!settlementsLoading && mySettlements.length === 0 && (
              <div className="text-center py-16">
                <DollarSign className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                <div className="text-sm font-black text-slate-600 uppercase tracking-widest">
                  No settlements yet
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Your pay settlements will appear here once processed.
                </p>
              </div>
            )}

            {!settlementsLoading && mySettlements.length > 0 && (
              <div className="space-y-4">
                {mySettlements.map((s) => (
                  <div
                    key={s.id}
                    className="bg-slate-900/50 border border-white/10 rounded-2xl p-5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-black text-white uppercase">
                          {s.periodStart} — {s.periodEnd}
                        </div>
                        <div className="text-xs text-slate-500 font-bold uppercase mt-1">
                          Settled {s.settlementDate}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-black uppercase border ${
                          s.status === "Paid"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : s.status === "Approved"
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-slate-600 font-black uppercase">
                          Earnings
                        </div>
                        <div className="text-lg font-black text-emerald-500">
                          ${(s.totalEarnings || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600 font-black uppercase">
                          Deductions
                        </div>
                        <div className="text-lg font-black text-red-500">
                          -${(s.totalDeductions || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600 font-black uppercase">
                          Net Pay
                        </div>
                        <div className="text-lg font-black text-white">
                          ${(s.netPay || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-900/40">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase">
                  {user.name}
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                  {user.role.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0a0f1e] p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">
                      Assigned Truck
                    </div>
                    <div className="text-xs text-slate-600 font-bold uppercase">
                      {activeLoads.length > 0 && activeLoads[0].truckNumber
                        ? `Unit: ${activeLoads[0].truckNumber}`
                        : "No truck assigned"}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-800" />
              </div>
              <div className="bg-[#0a0f1e] p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">
                      Compliance Tasks
                    </div>
                    <div className="text-xs text-emerald-500 font-bold uppercase">
                      Issues tracked via exceptions queue
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-800" />
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full py-5 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 rounded-3xl text-xs font-black uppercase tracking-[0.2em] border border-red-500/20 transition-all"
            >
              Sign Out
            </button>
          </div>
        )}

        {activeTab === "map" && (
          <div className="h-full -mx-6 -my-8 animate-in fade-in duration-300 relative border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <GlobalMapViewEnhanced
              loads={loads.filter((l) => l.driverId === user.id)}
              users={[user]}
            />
            <div className="absolute top-4 left-4 right-4 p-4 bg-[#0a0f1e]/80 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">
                  Fleet Tracking
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-slate-400" />
                  {selectedLoad?.gpsHistory?.length ||
                  selectedLoad?.telemetry?.length
                    ? "Tracking feed synced"
                    : "Tracking setup pending hardware integration"}
                </p>
              </div>
              <Navigation className="w-5 h-5 text-blue-500 animate-pulse" />
            </div>
          </div>
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Breakdown flow modals (used from overlay too) */}
      <InputDialog
        open={breakdownStep === "notes"}
        title="Report Breakdown"
        message="Describe the breakdown (Engine, Tire, Reefer, etc):"
        placeholder="e.g. Right rear tire blow-out on I-40"
        onSubmit={(notes) => {
          setBreakdownNotes(notes);
          setBreakdownStep("tow");
        }}
        onCancel={() => setBreakdownStep("idle")}
        submitLabel="Next"
      />
      <ConfirmDialog
        open={breakdownStep === "tow"}
        title="Tow Truck Required?"
        message="Is a TOW TRUCK required immediately?"
        confirmLabel="Yes — Tow Needed"
        cancelLabel="No Tow"
        danger
        onConfirm={() => {
          setBreakdownNeedsTow(true);
          setBreakdownStep("cargo");
        }}
        onCancel={() => {
          setBreakdownNeedsTow(false);
          setBreakdownStep("cargo");
        }}
      />
      <ConfirmDialog
        open={breakdownStep === "cargo"}
        title="Cargo at Risk?"
        message="Is the CARGO at risk (Temp/Security)?"
        confirmLabel="Yes — High Risk"
        cancelLabel="No Risk"
        danger
        onConfirm={() => {
          if (selectedLoad) {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              isActionRequired: true,
            });
            createException({
              type: "SAFETY",
              severity: 4,
              status: "OPEN",
              description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: HIGH`,
              entityType: "LOAD",
              entityId: selectedLoad.id,
            });
          }
          setIsCreatingChange(false);
          setBreakdownStep("idle");
          setToast({
            message:
              "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
            type: "error",
          });
        }}
        onCancel={() => {
          if (selectedLoad) {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              isActionRequired: true,
            });
            createException({
              type: "SAFETY",
              severity: 2,
              status: "OPEN",
              description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: LOW`,
              entityType: "LOAD",
              entityId: selectedLoad.id,
            });
          }
          setIsCreatingChange(false);
          setBreakdownStep("idle");
          setToast({
            message:
              "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
            type: "error",
          });
        }}
      />

      {/* Intake Scanner Overlay */}
      {intakeStep === "scanning" && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#0a0f1e] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="text-base font-black text-white uppercase tracking-tight">
                New Load Intake
              </h2>
              <button
                onClick={cancelIntake}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Scanner
              onDataExtracted={handleIntakeDataExtracted}
              onCancel={cancelIntake}
              onDismiss={cancelIntake}
              mode="intake"
            />
          </div>
        </div>
      )}

      {/* Intake Review Form Overlay */}
      {intakeStep === "review" && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div
            data-testid="intake-review-form"
            className="w-full max-w-md bg-[#0a0f1e] rounded-[2rem] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#0a0f1e] p-6 border-b border-white/5 flex justify-between items-center z-10 rounded-t-[2rem]">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                Review Intake
              </h2>
              <button
                onClick={cancelIntake}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Pickup */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-blue-500" /> Pickup Location *
                </label>
                <input
                  data-testid="intake-pickup-city"
                  type="text"
                  value={intakeFormData.pickupCity}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      pickupCity: e.target.value,
                    }))
                  }
                  placeholder="City"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  data-testid="intake-pickup-state"
                  type="text"
                  value={intakeFormData.pickupState}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      pickupState: e.target.value,
                    }))
                  }
                  placeholder="State"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Dropoff */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-emerald-500" /> Dropoff
                  Location *
                </label>
                <input
                  data-testid="intake-dropoff-city"
                  type="text"
                  value={intakeFormData.dropoffCity}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      dropoffCity: e.target.value,
                    }))
                  }
                  placeholder="City"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  data-testid="intake-dropoff-state"
                  type="text"
                  value={intakeFormData.dropoffState}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      dropoffState: e.target.value,
                    }))
                  }
                  placeholder="State"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-blue-500" /> Pickup Date *
                </label>
                <input
                  data-testid="intake-pickup-date"
                  type="date"
                  value={intakeFormData.pickupDate}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      pickupDate: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Commodity */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Truck className="w-3 h-3 text-blue-500" /> Commodity *
                </label>
                <input
                  data-testid="intake-commodity"
                  type="text"
                  value={intakeFormData.commodity}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      commodity: e.target.value,
                    }))
                  }
                  placeholder="e.g. Dry Goods, Refrigerated Produce"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Reference Number (optional) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-3 h-3 text-slate-500" /> Reference /
                  BOL #
                </label>
                <input
                  data-testid="intake-reference"
                  type="text"
                  value={intakeFormData.referenceNumber}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      referenceNumber: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Weight (optional) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Weight (lbs)
                </label>
                <input
                  data-testid="intake-weight"
                  type="text"
                  value={intakeFormData.weight}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      weight: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Special Instructions (optional) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Special Instructions
                </label>
                <textarea
                  data-testid="intake-instructions"
                  value={intakeFormData.specialInstructions}
                  onChange={(e) =>
                    setIntakeFormData((prev) => ({
                      ...prev,
                      specialInstructions: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                  rows={2}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {/* Scanned Documents Badge */}
              {intakeFormData.scannedDocTypes.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Documents: {intakeFormData.scannedDocTypes.join(", ")}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  data-testid="intake-cancel"
                  onClick={cancelIntake}
                  className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  data-testid="intake-submit"
                  onClick={submitIntake}
                  disabled={intakeSubmitting}
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all flex items-center justify-center gap-2"
                >
                  {intakeSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Intake"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fuel Scanner Overlay */}
      {scannerIntent === "fuel" && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#0a0f1e] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="text-base font-black text-white uppercase tracking-tight">
                Scan Fuel Receipt
              </h2>
              <button
                onClick={closeScanner}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Scanner
              onDataExtracted={handleFuelDataExtracted}
              onCancel={closeScanner}
              onDismiss={closeScanner}
              mode="fuel"
            />
          </div>
        </div>
      )}

      {/* Fuel Receipt Review */}
      {fuelReviewData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-[#020617] border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                Review Fuel Receipt
              </h3>
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                Verify extracted data before saving
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">Vendor *</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                  value={fuelReviewData.vendorName}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, vendorName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">Gallons *</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                  value={fuelReviewData.gallons}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, gallons: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">Price/Gal</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                  value={fuelReviewData.pricePerGallon}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, pricePerGallon: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">Total Cost *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                  value={fuelReviewData.totalCost}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, totalCost: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">State *</label>
                <input
                  type="text"
                  maxLength={2}
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white uppercase outline-none"
                  value={fuelReviewData.stateCode}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, stateCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">Date *</label>
                <input
                  type="date"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                  value={fuelReviewData.transactionDate}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, transactionDate: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-black text-slate-600 uppercase">Truck ID</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs font-bold text-white uppercase outline-none"
                  value={fuelReviewData.truckId}
                  onChange={(e) => setFuelReviewData({ ...fuelReviewData, truckId: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setFuelReviewData(null)}
                className="flex-1 py-3 bg-white/5 text-white border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={submitFuelReceipt}
                disabled={fuelSubmitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                {fuelSubmitting ? "Saving..." : "Save Fuel Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Sticky Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0a0f1e]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4">
        <button
          data-testid="driver-nav-today"
          onClick={() => {
            setActiveTab("today");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "today" ? "text-blue-500" : "text-slate-500"}`}
        >
          <Clock className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Today
          </span>
        </button>
        <button
          data-testid="driver-nav-loads"
          onClick={() => {
            setActiveTab("loads");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "loads" ? "text-blue-500" : "text-slate-500"}`}
        >
          <Truck className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Loads
          </span>
        </button>
        <button
          data-testid="driver-nav-map"
          onClick={() => {
            setActiveTab("map");
            setSelectedLoadId(null);
          }}
          className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === "map" ? "text-blue-500" : "text-slate-500"}`}
        >
          <div
            className={`p-2 rounded-2xl ${activeTab === "map" ? "bg-blue-600/20" : ""}`}
          >
            <MapIcon className="w-6 h-6" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">
            Live Map
          </span>
        </button>
        <button
          data-testid="driver-nav-pay"
          onClick={() => {
            setActiveTab("pay");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "pay" ? "text-emerald-500" : "text-slate-500"}`}
        >
          <Wallet className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Pay
          </span>
        </button>
        <button
          data-testid="driver-nav-changes"
          onClick={() => {
            setActiveTab("changes");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "changes" ? "text-blue-500" : "text-slate-500"}`}
        >
          <Zap className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Alerts
          </span>
        </button>
        <button
          data-testid="driver-nav-profile"
          onClick={() => {
            setActiveTab("profile");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "profile" ? "text-blue-500" : "text-slate-500"}`}
        >
          <UserIcon className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Me
          </span>
        </button>
      </nav>
    </div>
  );
};
