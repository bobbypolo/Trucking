import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Shield,
  FileText,
  Upload,
  Filter,
  Search,
  Lock,
  Unlock,
  History,
  MoreVertical,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  User,
  Truck,
  Package,
  HardDrive,
  Clock,
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";
import {
  VaultDoc,
  VaultDocType,
  VaultDocStatus,
  User as UserType,
  LoadData,
} from "../types";
import {
  getDocuments,
  updateDocumentStatus,
  validateFileType,
  validateFileSize,
  uploadVaultDoc,
  downloadVaultDoc,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "../services/storage/vault";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  currentUser: UserType;
  loads: LoadData[];
}

export const FileVault: React.FC<Props> = ({ currentUser, loads }) => {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<VaultDocType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<VaultDocStatus | "all">(
    "all",
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<VaultDocType>("BOL");
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetUploadState = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploading(false);
    setUploadError(null);
    setUploadSuccess(false);
    setValidationError(null);
    setSelectedDocType("BOL");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // R-W6-02c: Download handler -- calls download endpoint via vault service
  const handleDownload = useCallback(async (doc: VaultDoc) => {
    try {
      await downloadVaultDoc(doc.id, doc.filename);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Download failed. Please try again.";
      setLoadError(message);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUploadError(null);
      setValidationError(null);
      setUploadSuccess(false);

      const file = e.target.files?.[0];
      if (!file) {
        setSelectedFile(null);
        return;
      }

      // R-W5-03b: File type validation before upload attempt
      const typeCheck = validateFileType(file);
      if (!typeCheck.valid) {
        setValidationError(typeCheck.error ?? "Invalid file type");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // R-W5-03c: File size limit enforced with user-visible error
      const sizeCheck = validateFileSize(file);
      if (!sizeCheck.valid) {
        setValidationError(sizeCheck.error ?? "File too large");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setSelectedFile(file);
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // R-W5-02a: Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const doc = await uploadVaultDoc(
        selectedFile,
        selectedDocType,
        currentUser?.companyId ?? "",
        {},
      );

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadSuccess(true);
      setDocs((prev) => [doc, ...prev]);

      // Reset after brief success display
      setTimeout(() => {
        setShowUploadModal(false);
        resetUploadState();
      }, 1500);
    } catch (err: unknown) {
      // R-W5-03a: Error message shown when upload fails
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setUploadError(message);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }, [selectedFile, selectedDocType, currentUser, resetUploadState]);

  const loadVault = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDocuments({});
      setDocs(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load vault documents. Please try again.",
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVault();
  }, []);

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const matchesSearch =
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.loadId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.vendorName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || doc.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [docs, searchQuery, typeFilter, statusFilter]);

  const getDocIcon = (type: VaultDocType) => {
    switch (type) {
      case "BOL":
      case "POD":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "Fuel":
        return <FileText className="w-5 h-5 text-emerald-500" />;
      case "Repair":
        return <FileText className="w-5 h-5 text-orange-500" />;
      case "Insurance":
      case "Permit":
        return <Shield className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusStyle = (status: VaultDocStatus) => {
    switch (status) {
      case "Approved":
      case "Locked":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "Draft":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "Submitted":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col space-y-6 p-8">
        <LoadingSkeleton variant="table" count={6} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col">
        <ErrorState message={loadError} onRetry={loadVault} />
      </div>
    );
  }

  if (
    docs.length === 0 &&
    !searchQuery &&
    typeFilter === "all" &&
    statusFilter === "all"
  ) {
    return (
      <div className="h-full flex flex-col">
        <EmptyState
          icon={<HardDrive className="w-16 h-16" />}
          title="No Documents in Vault"
          description="Upload your first compliance document to get started. BOLs, PODs, fuel receipts, and more."
          action={{
            label: "Upload Document",
            onClick: () => setShowUploadModal(true),
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <HardDrive className="w-7 h-7 text-blue-500" />
            Audit-Ready File Vault
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
            Locked Compliance Records • Load-Linked Metadata • Immutable History
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Secure Upload
          </button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-3xl border border-white/5">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="SEARCH BY LOAD #, VENDOR, FILENAME..."
            aria-label="Search documents by load number, vendor, or filename"
            className="w-full bg-slate-950 border border-white/5 rounded-xl pl-12 pr-6 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-blue-500/50 transition-all font-mono"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          aria-label="Filter by document type"
          className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-blue-500/50"
        >
          <option value="all">DOCUMENT TYPES</option>
          <option value="BOL">BOL</option>
          <option value="POD">POD</option>
          <option value="Fuel">FUEL RECEIPT</option>
          <option value="Repair">REPAIR BILL</option>
          <option value="Insurance">INSURANCE</option>
          <option value="Permit">PERMIT</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          aria-label="Filter by document status"
          className="bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none focus:border-blue-500/50"
        >
          <option value="all">ALL STATUSES</option>
          <option value="Draft">DRAFT</option>
          <option value="Submitted">SUBMITTED</option>
          <option value="Approved">APPROVED</option>
          <option value="Locked">LOCKED</option>
        </select>
      </div>

      {/* GRID / TABLE */}
      <div className="flex-1 overflow-auto bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] backdrop-blur-md">
        <table className="w-full text-left">
          <thead className="bg-black/20 border-b border-white/5">
            <tr>
              <th className="px-8 py-5 text-[11px] font-black text-slate-600 uppercase">
                Document
              </th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-600 uppercase">
                Linked Reference
              </th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-600 uppercase">
                Meta / Amount
              </th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-600 uppercase">
                Auditor / Date
              </th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-600 uppercase">
                Status
              </th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-600 uppercase text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-white/[0.02] transition-all group"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-900 rounded-2xl border border-white/5">
                        {getDocIcon(doc.type)}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-white uppercase tracking-tighter truncate max-w-[200px]">
                          {doc.filename}
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold uppercase">
                          {doc.type} • v{doc.version}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      {doc.loadId && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase">
                          <Package className="w-3 h-3" /> Load #{doc.loadId}
                        </div>
                      )}
                      {doc.truckId && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-purple-400 uppercase">
                          <Truck className="w-3 h-3" /> Truck #{doc.truckId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-[11px] font-black text-emerald-500">
                      {doc.amount ? `$${doc.amount.toLocaleString()}` : "--"}
                    </div>
                    <div className="text-[11px] text-slate-500 font-bold uppercase">
                      {doc.vendorName || "Not Specified"}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-[10px] font-black text-white">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <User className="w-2 h-2" /> {doc.createdBy}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${getStatusStyle(doc.status)}`}
                      >
                        {doc.status}
                      </span>
                      {doc.isLocked && (
                        <Lock className="w-3 h-3 text-emerald-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 transition-all"
                          aria-label="Download file"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/5 transition-all" aria-label="View file history">
                        <History className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        aria-label="Delete file"
                        className="p-2 bg-slate-800 hover:bg-red-500/20 rounded-lg border border-white/5 transition-all group/del"
                        disabled={doc.isLocked}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover/del:text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-8 py-32 text-center">
                  <div className="flex flex-col items-center justify-center opacity-20">
                    <HardDrive className="w-16 h-16 mb-4" />
                    <div className="text-xl font-black uppercase tracking-widest">
                      No matching records found
                    </div>
                    <div className="text-[10px] uppercase font-bold mt-2 tracking-widest">
                      Adjust filters or search criteria
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SUMMARY BAR */}
      <div className="flex justify-between items-center bg-slate-900/30 border border-white/5 p-6 rounded-[2rem] px-10">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="text-[12px] font-black text-white uppercase tracking-tighter">
                {docs.filter((d) => d.isLocked).length} Locked
              </div>
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                Post-Approval Secure
              </div>
            </div>
          </div>
          <div className="w-px h-8 bg-white/5" />
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-blue-500" />
            <div>
              <div className="text-[12px] font-black text-white uppercase tracking-tighter">
                {docs.filter((d) => d.status === "Submitted").length} Pending
              </div>
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                Awaiting Review
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 justify-end">
            <Shield className="w-3 h-3" /> SOC2 Compliance Verified
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">
            Audit Log Coverage: 100% Transactions
          </div>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          data-testid="upload-modal"
        >
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-8 relative">
            <button
              onClick={() => {
                setShowUploadModal(false);
                resetUploadState();
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Close upload modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-500" />
              Secure Document Upload
            </h3>

            {/* Document Type Selector */}
            <div className="mb-4">
              <label
                htmlFor="upload-doc-type"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
              >
                Document Type
              </label>
              <select
                id="upload-doc-type"
                value={selectedDocType}
                onChange={(e) =>
                  setSelectedDocType(e.target.value as VaultDocType)
                }
                disabled={uploading}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
              >
                <option value="BOL">Bill of Lading (BOL)</option>
                <option value="POD">Proof of Delivery (POD)</option>
                <option value="Fuel">Fuel Receipt</option>
                <option value="Repair">Repair Bill</option>
                <option value="Insurance">Insurance Document</option>
                <option value="Permit">Permit</option>
              </select>
            </div>

            {/* File Input */}
            <div className="mb-4">
              <label
                htmlFor="upload-file-input"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
              >
                Select File
              </label>
              <input
                id="upload-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                onChange={handleFileSelect}
                disabled={uploading}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-blue-500/50 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-600 file:text-white file:cursor-pointer"
                data-testid="file-input"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-widest">
                Accepted: PDF, JPEG, PNG, TIFF (max 10 MB)
              </p>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div
                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2"
                data-testid="validation-error"
              >
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-[10px] font-bold text-red-400">
                  {validationError}
                </span>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div
                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2"
                data-testid="upload-error"
              >
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-[10px] font-bold text-red-400">
                  {uploadError}
                </span>
              </div>
            )}

            {/* Progress Bar (R-W5-02a) */}
            {uploading && (
              <div className="mb-4" data-testid="upload-progress">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading...
                  </span>
                  <span className="text-[10px] font-black text-blue-400">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                    role="progressbar"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div
                className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2"
                data-testid="upload-success"
              >
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-400">
                  Upload complete! Document added to vault.
                </span>
              </div>
            )}

            {/* Selected File Info */}
            {selectedFile && !uploading && !uploadSuccess && (
              <div className="mb-4 p-3 bg-slate-800/50 border border-white/5 rounded-xl">
                <div className="text-[11px] font-bold text-white truncate">
                  {selectedFile.name}
                </div>
                <div className="text-[11px] text-slate-500 font-bold uppercase mt-1">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading || uploadSuccess}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
              data-testid="upload-submit-btn"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </>
              ) : uploadSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Uploaded
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Upload Document
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
