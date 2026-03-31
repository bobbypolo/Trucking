import admin from "./auth";
import { logger } from "./lib/logger";

let db: FirebaseFirestore.Firestore;

try {
  db = admin.firestore();
  // Configure Firestore to ignore undefined values
  // This prevents "Cannot use undefined as a Firestore value" errors
  db.settings({
    ignoreUndefinedProperties: true,
  });
} catch (e) {
  logger.warn(
    "Firestore not initialized — Firebase Admin SDK not configured (missing serviceAccount.json)",
  );
  // Provide a proxy that throws descriptive errors on use rather than crashing at import
  db = new Proxy({} as FirebaseFirestore.Firestore, {
    get(_target, prop) {
      if (
        prop === "collection" ||
        prop === "doc" ||
        prop === "runTransaction"
      ) {
        return () => {
          throw new Error(
            "Firestore is not available — serviceAccount.json is missing",
          );
        };
      }
      return undefined;
    },
  });
}

// Firestore Emulator detection
if (process.env.FIRESTORE_EMULATOR_HOST) {
  logger.info('Firestore Emulator active');
}

export default db;
