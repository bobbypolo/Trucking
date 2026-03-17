import React, { useEffect, useState } from "react";
import { apiHealth } from "../../services/apiHealth";

type ConnectionStatus = "connected" | "degraded" | "offline";

interface ConnectionBannerProps {
  onRetry?: () => void;
}

const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ onRetry }) => {
  const [status, setStatus] = useState<ConnectionStatus>(apiHealth.getStatus());

  useEffect(() => {
    const unsubscribe = apiHealth.onConnectionChange(setStatus);
    apiHealth.startPolling();
    return () => {
      unsubscribe();
    };
  }, []);

  if (status === "connected") return null;

  const handleRetry = async () => {
    await apiHealth.checkNow();
    onRetry?.();
  };

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        padding: "8px 16px",
        backgroundColor: status === "offline" ? "#dc2626" : "#f59e0b",
        color: status === "offline" ? "#fff" : "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      <span>
        {status === "offline"
          ? "Connection lost. Some features may be unavailable."
          : "Some features may be slow."}
      </span>
      <button
        onClick={handleRetry}
        style={{
          padding: "4px 12px",
          borderRadius: "4px",
          border: "1px solid currentColor",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontSize: "13px",
        }}
      >
        Retry
      </button>
    </div>
  );
};

export default ConnectionBanner;
