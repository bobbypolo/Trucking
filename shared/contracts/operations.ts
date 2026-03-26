/**
 * Shared Operations Domain Contracts — FROZEN
 *
 * Re-exports all domain contracts for convenience.
 * Any team may read these types; changes require cross-team agreement.
 */

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

export type {
  TrackingVehicle,
  TrackingProviderConfig,
  TelemetryEvent,
  GpsPoint,
} from "./tracking";

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
