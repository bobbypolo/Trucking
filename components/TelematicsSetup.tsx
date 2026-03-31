/**
 * TelematicsSetup — Admin UI for GPS/telematics provider configuration.
 *
 * Sections:
 *  1. Provider Status Overview (summary card)
 *  2. Provider Configuration (list of supported providers + inline form)
 *  3. Connection Test (per-provider test button + result)
 *  4. Vehicle Mapping (table + add / delete mapping)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Truck,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { api } from "../services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderName = "Samsara" | "Generic Webhook";

interface ProviderConfig {
  id: string;
  providerName: string;
  providerDisplayName?: string;
  isActive: boolean;
  hasApiToken: boolean;
  hasWebhookUrl: boolean;
  createdAt: string;
}

interface VehicleMapping {
  id: string;
  vehicleId: string;
  providerConfigId: string;
  providerVehicleId: string;
  providerName: string;
  providerDisplayName?: string;
}

type TestStatus = "success" | "failed" | "no_credentials";

interface TestResult {
  status: TestStatus;
  message: string;
  latencyMs?: number;
}

interface ProviderFormState {
  apiToken: string;
  webhookUrl: string;
  webhookSecret: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_PROVIDERS: ProviderName[] = ["Samsara", "Generic Webhook"];

const DEFAULT_FORM: ProviderFormState = {
  apiToken: "",
  webhookUrl: "",
  webhookSecret: "",
  isActive: true,
};

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function ProviderIcon({ name }: { name: ProviderName }) {
  const labels: Record<ProviderName, string> = {
    Samsara: "SA",
    "Generic Webhook": "WH",
  };
  return (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700 text-slate-200 font-bold text-sm select-none">
      {labels[name]}
    </span>
  );
}

function formatProviderDisplayName(
  name: string | undefined,
): ProviderName | string {
  if (!name) return "";

  const normalized = name
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
  if (normalized === "samsara") return "Samsara";
  if (normalized === "webhook" || normalized === "generic webhook") {
    return "Generic Webhook";
  }
  return name;
}

function isSupportedProviderDisplayName(name: string): name is ProviderName {
  return name === "Samsara" || name === "Generic Webhook";
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400 text-xs font-medium">
      <Wifi size={12} /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-xs font-medium">
      <WifiOff size={12} /> Inactive
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TelematicsSetup(): React.ReactElement {
  // ---- Data state ----
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [mappings, setMappings] = useState<VehicleMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Provider form state ----
  const [expandedProvider, setExpandedProvider] = useState<ProviderName | null>(
    null,
  );
  const [formState, setFormState] = useState<ProviderFormState>(DEFAULT_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Connection test state ----
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>(
    {},
  );

  // ---- Delete state ----
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- Live tracking status ----
  const [trackingState, setTrackingState] = useState<string | null>(null);
  const [trackingProvider, setTrackingProvider] = useState<string | null>(null);

  // ---- Vehicle mapping form state ----
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    vehicleId: "",
    providerConfigId: "",
    providerVehicleId: "",
  });
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const opts = signal ? { signal } : undefined;
      const [cfgs, maps, liveStatus] = await Promise.all([
        api.get("/tracking/providers", opts) as Promise<ProviderConfig[]>,
        api.get("/tracking/vehicles/mapping", opts) as Promise<
          VehicleMapping[]
        >,
        api.get("/tracking/live", opts).catch(() => null) as Promise<{
          trackingState?: string;
          providerDisplayName?: string;
        } | null>,
      ]);
      if (signal?.aborted) return;
      setConfigs(cfgs ?? []);
      setMappings(maps ?? []);
      if (liveStatus) {
        setTrackingState(liveStatus.trackingState ?? null);
        setTrackingProvider(liveStatus.providerDisplayName ?? null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!signal?.aborted) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load telematics configuration.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Provider form handlers
  // ---------------------------------------------------------------------------

  function openProviderForm(name: ProviderName) {
    if (expandedProvider === name) {
      setExpandedProvider(null);
      return;
    }
    setExpandedProvider(name);
    setFormState(DEFAULT_FORM);
    setFormError(null);
  }

  async function handleProviderSave(name: ProviderName) {
    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.post("/tracking/providers", {
        providerName: name,
        ...(formState.apiToken ? { apiToken: formState.apiToken } : {}),
        ...(formState.webhookUrl ? { webhookUrl: formState.webhookUrl } : {}),
        ...(formState.webhookSecret
          ? { webhookSecret: formState.webhookSecret }
          : {}),
        isActive: formState.isActive,
      });
      setExpandedProvider(null);
      await fetchData();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save provider config.",
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteConfig(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/tracking/providers/${id}`);
      setTestResults((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      await fetchData();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete provider.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Connection test handler
  // ---------------------------------------------------------------------------

  async function handleTestConnection(id: string) {
    setTestingId(id);
    try {
      const result = (await api.post(
        `/tracking/providers/${id}/test`,
        {},
      )) as TestResult;
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          status: "failed",
          message:
            err instanceof Error ? err.message : "Connection test failed.",
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Vehicle mapping handlers
  // ---------------------------------------------------------------------------

  async function handleAddMapping() {
    if (
      !mappingForm.vehicleId.trim() ||
      !mappingForm.providerConfigId ||
      !mappingForm.providerVehicleId.trim()
    ) {
      setMappingError("All mapping fields are required.");
      return;
    }
    setMappingSubmitting(true);
    setMappingError(null);
    try {
      await api.post("/tracking/vehicles/mapping", mappingForm);
      setMappingForm({
        vehicleId: "",
        providerConfigId: "",
        providerVehicleId: "",
      });
      setShowMappingForm(false);
      await fetchData();
    } catch (err: unknown) {
      setMappingError(
        err instanceof Error ? err.message : "Failed to add vehicle mapping.",
      );
    } finally {
      setMappingSubmitting(false);
    }
  }

  async function handleDeleteMapping(id: string) {
    setDeletingMappingId(id);
    try {
      await api.delete(`/tracking/vehicles/mapping/${id}`);
      await fetchData();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete vehicle mapping.",
      );
    } finally {
      setDeletingMappingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderTestResult(id: string) {
    const result = testResults[id];
    if (!result) return null;

    if (result.status === "success") {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
          <CheckCircle size={14} />
          Connected
          {result.latencyMs !== undefined && (
            <span className="text-slate-400">({result.latencyMs}ms)</span>
          )}
        </span>
      );
    }
    if (result.status === "no_credentials") {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
          <AlertTriangle size={14} />
          No credentials configured
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-xs">
        <XCircle size={14} />
        {result.message}
      </span>
    );
  }

  function renderProviderForm(name: ProviderName) {
    const isWebhook = name === "Generic Webhook";
    return (
      <div
        data-testid={`provider-form-${name.replace(/\s+/g, "-").toLowerCase()}`}
        className="mt-3 p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3"
      >
        {!isWebhook && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              API Token
            </label>
            <input
              type="password"
              placeholder="Enter API token"
              value={formState.apiToken}
              onChange={(e) =>
                setFormState((s) => ({ ...s, apiToken: e.target.value }))
              }
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {!isWebhook && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Webhook URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://your-endpoint.example.com/webhook"
              value={formState.webhookUrl}
              onChange={(e) =>
                setFormState((s) => ({ ...s, webhookUrl: e.target.value }))
              }
              className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {isWebhook && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://your-endpoint.example.com/webhook"
                value={formState.webhookUrl}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, webhookUrl: e.target.value }))
                }
                className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Webhook Secret
              </label>
              <input
                type="password"
                placeholder="Shared signing secret"
                value={formState.webhookSecret}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, webhookSecret: e.target.value }))
                }
                className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <input
            id={`active-${name}`}
            type="checkbox"
            checked={formState.isActive}
            onChange={(e) =>
              setFormState((s) => ({ ...s, isActive: e.target.checked }))
            }
            className="accent-blue-500"
          />
          <label htmlFor={`active-${name}`} className="text-sm text-slate-300">
            Active
          </label>
        </div>

        {formError && <p className="text-red-400 text-xs">{formError}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => handleProviderSave(name)}
            disabled={formSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded font-medium transition-colors"
          >
            {formSubmitting && <Loader2 size={14} className="animate-spin" />}
            Save Configuration
          </button>
          <button
            onClick={() => setExpandedProvider(null)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div
        data-testid="telematics-loading"
        className="flex items-center justify-center h-48 text-slate-400"
      >
        <Loader2 size={24} className="animate-spin mr-2" />
        Loading telematics configuration...
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="telematics-error"
        role="alert"
        className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm"
      >
        <p className="font-semibold mb-1">Error loading telematics data</p>
        <p>{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-2 px-3 py-1 bg-red-800 hover:bg-red-700 text-red-100 rounded text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const lastTest = Object.values(testResults).pop() ?? null;

  return (
    <div data-testid="telematics-setup" className="space-y-6 p-4 text-white">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Status Overview Card                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Activity size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold">Telematics Overview</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900 rounded-lg p-3 text-center">
            <p
              data-testid="providers-configured-count"
              className="text-2xl font-bold text-white"
            >
              {configs.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Providers Configured</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 text-center">
            <p
              data-testid="vehicles-mapped-count"
              className="text-2xl font-bold text-white"
            >
              {mappings.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Vehicles Mapped</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 text-center">
            {trackingState === "configured-live" ? (
              <>
                <p
                  data-testid="tracking-status-value"
                  className="text-lg font-bold text-emerald-400"
                >
                  LIVE
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Tracking Status
                  {trackingProvider ? ` (${trackingProvider})` : ""}
                </p>
              </>
            ) : trackingState === "configured-idle" ? (
              <>
                <p
                  data-testid="tracking-status-value"
                  className="text-lg font-bold text-amber-400"
                >
                  IDLE
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Tracking Status — No Active Vehicles
                </p>
              </>
            ) : trackingState === "configured-no-credentials" ? (
              <>
                <p
                  data-testid="tracking-status-value"
                  className="text-lg font-bold text-amber-400"
                >
                  NO CREDS
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Provider Set Up — Credentials Missing
                </p>
              </>
            ) : trackingState === "provider-error" ? (
              <>
                <p
                  data-testid="tracking-status-value"
                  className="text-lg font-bold text-red-400"
                >
                  ERROR
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Provider Error — Retrying
                </p>
              </>
            ) : (
              <>
                <p
                  data-testid="tracking-status-value"
                  className="text-lg font-bold text-slate-500"
                >
                  —
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {configs.length === 0
                    ? "No Provider Configured"
                    : "Tracking Status"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Provider Configuration                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold">Provider Configuration</h2>
        </div>

        {configs.length === 0 && expandedProvider === null ? (
          <p
            data-testid="no-providers-message"
            className="text-slate-400 text-sm"
          >
            No telematics providers configured. Set up a provider to enable live
            GPS tracking.
          </p>
        ) : null}

        {/* Existing configs */}
        {configs.length > 0 && (
          <div data-testid="provider-list" className="space-y-3 mb-4">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                data-testid={`provider-config-${cfg.id}`}
                className="flex items-center justify-between bg-slate-900 rounded-lg p-3 border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const label = formatProviderDisplayName(
                      cfg.providerDisplayName ?? cfg.providerName,
                    );
                    return (
                      <ProviderIcon
                        name={
                          isSupportedProviderDisplayName(label)
                            ? label
                            : "Generic Webhook"
                        }
                      />
                    );
                  })()}
                  <div>
                    <p className="text-sm font-medium">
                      {formatProviderDisplayName(
                        cfg.providerDisplayName ?? cfg.providerName,
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge active={cfg.isActive} />
                      {cfg.hasApiToken && (
                        <span className="text-xs text-slate-400">
                          API token set
                        </span>
                      )}
                      {cfg.hasWebhookUrl && (
                        <span className="text-xs text-slate-400">
                          Webhook set
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Test result inline */}
                  {renderTestResult(cfg.id)}

                  {/* Test connection button */}
                  <button
                    data-testid={`test-btn-${cfg.id}`}
                    onClick={() => handleTestConnection(cfg.id)}
                    disabled={testingId === cfg.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs rounded transition-colors"
                  >
                    {testingId === cfg.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Wifi size={12} />
                    )}
                    Test
                  </button>

                  {/* Delete button */}
                  <button
                    data-testid={`delete-provider-${cfg.id}`}
                    onClick={() => handleDeleteConfig(cfg.id)}
                    disabled={deletingId === cfg.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/70 disabled:opacity-50 text-red-300 text-xs rounded transition-colors"
                  >
                    {deletingId === cfg.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Supported providers — click to configure */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
            Add Provider
          </p>
          {SUPPORTED_PROVIDERS.map((name) => (
            <div key={name}>
              <button
                data-testid={`configure-${name.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => openProviderForm(name)}
                className={`w-full flex items-center justify-between p-3 border border-slate-700 rounded-lg transition-colors ${
                  expandedProvider === name
                    ? "bg-slate-700"
                    : "bg-slate-900 hover:bg-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ProviderIcon name={name} />
                  <span className="text-sm font-medium">{name}</span>
                </div>
                {expandedProvider === name ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </button>
              {expandedProvider === name && renderProviderForm(name)}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Vehicle Mapping                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Truck size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold">Vehicle Mappings</h2>
          </div>
          <button
            data-testid="add-mapping-btn"
            onClick={() => {
              setShowMappingForm((v) => !v);
              setMappingError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium transition-colors"
          >
            <Plus size={14} />
            Add Mapping
          </button>
        </div>

        {/* Add mapping form */}
        {showMappingForm && (
          <div
            data-testid="mapping-form"
            className="mb-4 p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Vehicle ID
                </label>
                <input
                  data-testid="mapping-vehicle-id"
                  type="text"
                  placeholder="e.g. TRUCK-001"
                  value={mappingForm.vehicleId}
                  onChange={(e) =>
                    setMappingForm((s) => ({
                      ...s,
                      vehicleId: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Provider
                </label>
                <select
                  data-testid="mapping-provider-select"
                  value={mappingForm.providerConfigId}
                  onChange={(e) =>
                    setMappingForm((s) => ({
                      ...s,
                      providerConfigId: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select provider...</option>
                  {configs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {formatProviderDisplayName(
                        cfg.providerDisplayName ?? cfg.providerName,
                      )}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Provider Vehicle ID
                </label>
                <input
                  data-testid="mapping-provider-vehicle-id"
                  type="text"
                  placeholder="e.g. vh_abc123"
                  value={mappingForm.providerVehicleId}
                  onChange={(e) =>
                    setMappingForm((s) => ({
                      ...s,
                      providerVehicleId: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {mappingError && (
              <p className="text-red-400 text-xs">{mappingError}</p>
            )}

            <div className="flex gap-2">
              <button
                data-testid="mapping-submit-btn"
                onClick={handleAddMapping}
                disabled={mappingSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded font-medium transition-colors"
              >
                {mappingSubmitting && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Save Mapping
              </button>
              <button
                onClick={() => setShowMappingForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Mappings table */}
        {mappings.length === 0 ? (
          <p
            className="text-slate-400 text-sm"
            data-testid="no-mappings-message"
          >
            No vehicle mappings configured yet.
          </p>
        ) : (
          <div data-testid="mappings-table" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                  <th className="pb-2 pr-4 font-medium">Vehicle ID</th>
                  <th className="pb-2 pr-4 font-medium">Provider</th>
                  <th className="pb-2 pr-4 font-medium">Provider Vehicle ID</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {mappings.map((m) => (
                  <tr key={m.id} data-testid={`mapping-row-${m.id}`}>
                    <td className="py-2 pr-4 text-slate-200">{m.vehicleId}</td>
                    <td className="py-2 pr-4 text-slate-200">
                      {formatProviderDisplayName(
                        m.providerDisplayName ?? m.providerName,
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-400 font-mono text-xs">
                      {m.providerVehicleId}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        data-testid={`delete-mapping-${m.id}`}
                        onClick={() => handleDeleteMapping(m.id)}
                        disabled={deletingMappingId === m.id}
                        className="flex items-center gap-1 ml-auto px-2 py-1 bg-red-900/40 hover:bg-red-900/70 disabled:opacity-50 text-red-300 text-xs rounded transition-colors"
                      >
                        {deletingMappingId === m.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TelematicsSetup;
