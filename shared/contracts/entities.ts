/**
 * Shared Entity Domain Contracts — FROZEN
 *
 * These types define the cross-team contract for entities, issues,
 * and company configuration.
 * Any team may read these types; changes require cross-team agreement.
 *
 * Derived from types.ts canonical definitions.
 */

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

export type ExceptionSeverity = 1 | 2 | 3 | 4; // 1=Low, 2=Med, 3=High, 4=Critical

export interface EntitySummary {
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

export interface IssueSummary {
  id: string;
  category: IssueCategory;
  description: string;
  reportedAt: string;
  reportedBy: string;
  status: IssueStatus;
  actionNeeded?: boolean;
  requiresApproval?: boolean;
  loadId?: string;
  severity?: string;
}

export type OnboardingStatus =
  | "Draft"
  | "Invited"
  | "In_Review"
  | "Approved"
  | "On_Hold"
  | "Inactive";

export type PartyType =
  | "Shipper"
  | "Broker"
  | "Carrier"
  | "Vendor"
  | "Vendor_Service"
  | "Vendor_Equipment"
  | "Facility"
  | "Vendor_Product";

export interface CompanyConfig {
  id: string;
  name: string;
  accountType: "fleet" | "owner_operator" | "independent_driver";
  mcNumber?: string;
  dotNumber?: string;
  subscriptionTier?:
    | "Records Vault"
    | "Automation Pro"
    | "Fleet Core"
    | "Fleet Command";
  operatingMode?: "Small Team" | "Split Roles" | "Enterprise";
  supportedFreightTypes: string[];
  defaultFreightType: string;
}
