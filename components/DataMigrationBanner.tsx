import React, { useEffect, useState } from "react";
import {
  getLocalDataSummary,
  isMigrationComplete,
  markMigrationComplete,
  importDomain,
  exportDomainAsJson,
  discardDomain,
  MigrationReport,
} from "../services/storage/migrationService";

interface DomainSummary {
  domain: string;
  count: number;
  key: string;
}

const DataMigrationBanner: React.FC = () => {
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [results, setResults] = useState<MigrationReport[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isMigrationComplete()) {
      setDismissed(true);
      return;
    }
    const summary = getLocalDataSummary();
    setDomains(summary);
  }, []);

  if (dismissed || domains.length === 0) return null;

  const totalItems = domains.reduce((sum, d) => sum + d.count, 0);

  const handleImportAll = async () => {
    const reports: MigrationReport[] = [];
    for (const domain of domains) {
      setImporting(domain.domain);
      const report = await importDomain(domain.domain, (current, total) => {
        setProgress({ current, total });
      });
      reports.push(report);
      setProgress(null);
    }
    setImporting(null);
    setResults(reports);
    // Refresh domain list (successfully imported domains should be gone)
    const updated = getLocalDataSummary();
    setDomains(updated);
    if (updated.length === 0) {
      markMigrationComplete();
    }
  };

  const handleDiscardAll = () => {
    for (const domain of domains) {
      discardDomain(domain.domain);
    }
    markMigrationComplete();
    setDismissed(true);
  };

  const handleExport = (domain: string) => {
    exportDomainAsJson(domain);
  };

  return (
    <div
      role="alert"
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "16px 20px",
        margin: "12px",
        color: "#e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "18px" }}>&#x1f4e6;</span>
        <strong style={{ fontSize: "15px" }}>
          Local Data Found ({totalItems} items)
        </strong>
      </div>
      <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 12px" }}>
        We found data saved locally that hasn&apos;t been synced to the server.
        Import it now to avoid data loss.
      </p>

      {importing && (
        <div
          style={{ fontSize: "13px", color: "#60a5fa", marginBottom: "8px" }}
        >
          Importing {importing}...{" "}
          {progress && `${progress.current}/${progress.total}`}
        </div>
      )}

      {results.length > 0 && (
        <div
          style={{ fontSize: "12px", marginBottom: "8px", color: "#94a3b8" }}
        >
          {results.map((r) => (
            <div key={r.domain}>
              {r.domain}: {r.imported} imported, {r.skipped} skipped, {r.failed}{" "}
              failed
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: "13px", marginBottom: "12px" }}>
        {domains.map((d) => (
          <div
            key={d.domain}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 0",
            }}
          >
            <span>
              {d.domain}: {d.count} items
            </span>
            <button
              onClick={() => handleExport(d.domain)}
              style={{
                fontSize: "12px",
                color: "#60a5fa",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Export JSON
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleImportAll}
          disabled={!!importing}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "#2563eb",
            color: "#fff",
            cursor: importing ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {importing ? "Importing..." : "Import All"}
        </button>
        <button
          onClick={handleDiscardAll}
          disabled={!!importing}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "1px solid #475569",
            backgroundColor: "transparent",
            color: "#94a3b8",
            cursor: importing ? "not-allowed" : "pointer",
            fontSize: "13px",
          }}
        >
          Discard All
        </button>
      </div>
    </div>
  );
};

export default DataMigrationBanner;
