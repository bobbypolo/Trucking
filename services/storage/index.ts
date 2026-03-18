/**
 * Barrel export for all storage domain modules.
 * Re-exports everything so consumers can import from "services/storage"
 * or individual domain modules for reduced coupling.
 */
export { getTenantKey, migrateKey } from "./core";
export { getQuotes, saveQuote } from "./quotes";
export { getLeads, saveLead } from "./leads";
export { getBookings, saveBooking } from "./bookings";
export { getMessages, saveMessage } from "./messages";
export {
  getRawCalls,
  saveCallSession,
  attachToRecord,
  linkSessionToRecord,
} from "./calls";
export {
  getRawTasks,
  saveTask,
  getRawWorkItems,
  getWorkItems,
  saveWorkItem,
} from "./tasks";
export {
  getRawCrisisActions,
  saveCrisisAction,
  getRawRequests,
  getRequests,
  saveRequest,
  updateRequestStatus,
  getUnresolvedRequests,
  getRawServiceTickets,
  saveServiceTicket,
} from "./recovery";
export {
  saveProvider,
  getProviders,
  getContacts,
  saveContact,
  getDirectory,
} from "./directory";
export { getRawVaultDocs, saveVaultDoc, uploadVaultDoc } from "./vault";
export { getRawNotificationJobs, saveNotificationJob } from "./notifications";
