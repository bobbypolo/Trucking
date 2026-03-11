const mysql = require("mysql2/promise");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: "./server/.env" });

function initFirebaseAdmin() {
  const serviceAccountPath = path.resolve(__dirname, "..", "serviceAccount.json");

  if (admin.apps.length > 0) {
    return true;
  }

  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return true;
    }

    if (
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_PROJECT_ID
    ) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      return true;
    }
  } catch (error) {
    console.warn("Firebase Admin init failed:", error.message);
  }

  console.warn(
    "Firebase Admin credentials unavailable; cannot backfill users.firebase_uid.",
  );
  return false;
}

async function loadFirebaseUsersByEmail() {
  if (!initFirebaseAdmin()) {
    return new Map();
  }

  const emailToUid = new Map();
  let pageToken;

  try {
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.email) {
          emailToUid.set(user.email.toLowerCase(), user.uid);
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);
  } catch (error) {
    // Firebase Admin credentials may be present but invalid (e.g. applicationDefault
    // without ADC configured). Log a warning and proceed without remote user list.
    // Rows already linked (firebase_uid IS NOT NULL) will still be counted as alreadyLinked.
    console.warn(
      "Firebase Admin listUsers failed; proceeding with empty UID map.",
      error.message,
    );
  }

  return emailToUid;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "trucklogix",
  });

  try {
    const emailToUid = await loadFirebaseUsersByEmail();
    const [rows] = await connection.query("SELECT id, email, firebase_uid FROM users");

    let updated = 0;
    let alreadyLinked = 0;
    let missingFirebaseUser = 0;

    for (const row of rows) {
      if (row.firebase_uid) {
        alreadyLinked += 1;
        continue;
      }

      const firebaseUid = emailToUid.get(String(row.email).toLowerCase());
      if (!firebaseUid) {
        missingFirebaseUser += 1;
        continue;
      }

      await connection.query(
        "UPDATE users SET firebase_uid = ? WHERE id = ?",
        [firebaseUid, row.id],
      );
      updated += 1;
      console.log(`Linked ${row.email} -> ${firebaseUid}`);
    }

    console.log(
      JSON.stringify(
        { updated, alreadyLinked, missingFirebaseUser, total: rows.length },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("firebase_uid backfill failed:", error);
  process.exit(1);
});
