/**
 * Shared Contracts — Barrel File
 *
 * Central entry point for all cross-team domain contracts.
 * Import from "shared/contracts" for any shared type.
 *
 * FROZEN: Changes require cross-team agreement.
 */

// Load domain
export type {
  LoadStatus,
  FreightType,
  LoadLeg,
  LoadExpense,
  DocumentRef,
  LoadSummary,
  LoadDetail,
  ScheduleEntry,
} from "./load";

// Tracking domain
export type {
  TrackingVehicle,
  TrackingProviderConfig,
  TelemetryEvent,
  GpsPoint,
} from "./tracking";

// Finance domain
export type {
  QuoteStatus,
  BookingStatus,
  SettlementStatus,
  Quote,
  Booking,
  Settlement,
  SettlementLine,
  FinancialDocument,
} from "./finance";

// Entities domain
export type {
  EntityType,
  IssueCategory,
  IssueStatus,
  ExceptionSeverity,
  EntitySummary,
  IssueSummary,
  OnboardingStatus,
  PartyType,
  CompanyConfig,
} from "./entities";
