import React from "react";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

interface NotificationStatusBadgeProps {
  status: NotificationStatus;
  syncError?: string | null;
}

const STATUS_CONFIG: Record<
  NotificationStatus,
  {
    label: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  PENDING: {
    label: "Pending",
    colorClass: "text-yellow-400",
    bgClass: "bg-yellow-900/20",
    borderClass: "border-yellow-900/50",
    Icon: Clock,
  },
  SENT: {
    label: "Sent",
    colorClass: "text-green-400",
    bgClass: "bg-green-900/20",
    borderClass: "border-green-900/50",
    Icon: CheckCircle,
  },
  FAILED: {
    label: "Failed",
    colorClass: "text-red-400",
    bgClass: "bg-red-900/20",
    borderClass: "border-red-900/50",
    Icon: AlertTriangle,
  },
};

/**
 * Renders a notification delivery status badge.
 *
 * Colors: green=SENT, yellow=PENDING, red=FAILED.
 * When status is FAILED and syncError is provided, displays the error reason.
 */
export const NotificationStatusBadge: React.FC<
  NotificationStatusBadgeProps
> = ({ status, syncError }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const { label, colorClass, bgClass, borderClass, Icon } = config;

  return (
    <span
      data-testid={`notification-badge-${status}`}
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${colorClass} ${bgClass} ${borderClass}`}
      title={
        status === "FAILED" && syncError
          ? `Delivery failed: ${syncError}`
          : label
      }
    >
      <Icon className="w-3 h-3" />
      {label}
      {status === "FAILED" && syncError && (
        <span className="ml-1 text-[10px] opacity-75 normal-case tracking-normal">
          ({syncError})
        </span>
      )}
    </span>
  );
};
