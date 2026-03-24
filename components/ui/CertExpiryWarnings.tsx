import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";
import { AlertTriangle, ShieldAlert, RefreshCw, Loader2 } from "lucide-react";

export interface ExpiringCert {
  driverId: string;
  certType: string;
  expiryDate: string;
  daysRemaining: number;
}

interface CertExpiryWarningsProps {
  companyId: string;
  daysAhead?: number;
}

/**
 * Fetches and displays real certificate expiry warnings from
 * GET /api/safety/expiring-certs.
 *
 * Shows urgency levels: EXPIRED (red), URGENT <=7 days (orange), WARNING (yellow).
 */
export const CertExpiryWarnings: React.FC<CertExpiryWarningsProps> = ({
  companyId,
  daysAhead = 30,
}) => {
  const [certs, setCerts] = useState<ExpiringCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/safety/expiring-certs?days=${daysAhead}`);
      setCerts((data as ExpiringCert[]) ?? []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch cert expiry data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [daysAhead]);

  useEffect(() => {
    if (companyId) {
      fetchCerts();
    }
  }, [companyId, fetchCerts]);

  const getUrgencyConfig = (daysRemaining: number) => {
    if (daysRemaining <= 0) {
      return {
        level: "EXPIRED",
        colorClass: "text-red-400",
        bgClass: "bg-red-900/20",
        borderClass: "border-red-900/50",
        badgeColor: "text-red-400 bg-red-900/30 border-red-900/50",
      };
    }
    if (daysRemaining <= 7) {
      return {
        level: "URGENT",
        colorClass: "text-orange-400",
        bgClass: "bg-orange-900/20",
        borderClass: "border-orange-900/50",
        badgeColor: "text-orange-400 bg-orange-900/30 border-orange-900/50",
      };
    }
    return {
      level: "WARNING",
      colorClass: "text-yellow-400",
      bgClass: "bg-yellow-900/20",
      borderClass: "border-yellow-900/50",
      badgeColor: "text-yellow-400 bg-yellow-900/30 border-yellow-900/50",
    };
  };

  if (loading) {
    return (
      <div
        data-testid="cert-expiry-loading"
        className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-center gap-3"
      >
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Checking certificate expiry...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="cert-expiry-error"
        className="bg-slate-900 p-6 rounded-xl border border-red-900/50 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-400">
            Failed to load cert expiry data: {error}
          </span>
        </div>
        <button
          onClick={fetchCerts}
          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (certs.length === 0) {
    return (
      <div
        data-testid="cert-expiry-empty"
        className="bg-slate-900 p-6 rounded-xl border border-slate-800"
      >
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="w-5 h-5 text-green-500" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Certificate Expiry Status
          </h4>
        </div>
        <p className="text-[10px] text-slate-500 font-medium">
          No certificates expiring within {daysAhead} days.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="cert-expiry-warnings"
      className="bg-slate-900 p-6 rounded-xl border border-slate-800"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-500" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Certificate Expiry Warnings
          </h4>
          <span className="text-[9px] font-bold text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-900/50">
            {certs.length} alert{certs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={fetchCerts}
          className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest flex items-center gap-1"
          title="Refresh cert expiry data"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
        {certs.map((cert, idx) => {
          const urgency = getUrgencyConfig(cert.daysRemaining);
          const expiryStr =
            typeof cert.expiryDate === "string"
              ? cert.expiryDate.split("T")[0]
              : new Date(cert.expiryDate).toISOString().split("T")[0];

          return (
            <div
              key={`${cert.driverId}-${cert.certType}-${idx}`}
              data-testid="cert-expiry-item"
              className={`flex items-center justify-between p-3 rounded-lg border ${urgency.bgClass} ${urgency.borderClass}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${urgency.badgeColor}`}
                  >
                    {urgency.level}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {cert.certType}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Driver: {cert.driverId} &middot; Expires: {expiryStr}
                </div>
              </div>
              <div className={`text-right ${urgency.colorClass}`}>
                <div className="text-lg font-bold leading-none">
                  {cert.daysRemaining <= 0 ? "0" : cert.daysRemaining}
                </div>
                <div className="text-[8px] font-bold uppercase">
                  {cert.daysRemaining <= 0 ? "Expired" : "Days Left"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
