
import admin from './auth';

const db = admin.firestore();

// Configure Firestore to ignore undefined values
// This prevents "Cannot use undefined as a Firestore value" errors
db.settings({
    ignoreUndefinedProperties: true
});

export default db;
