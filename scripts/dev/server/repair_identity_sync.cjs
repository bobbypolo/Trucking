const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

require("dotenv").config({ path: "./server/.env" });

function initFirebaseAdmin() {
  let serviceAccount;
  try {
    serviceAccount = require("./serviceAccount.json");
  } catch (_error) {
    serviceAccount = null;
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_PROJECT_ID
  ) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    return;
  }

  throw new Error(
    "Firebase Admin credentials unavailable. Provide serviceAccount.json or application default credentials.",
  );
}

async function listFirebaseUsersByEmail() {
  const usersByEmail = new Map();
  let nextPageToken;

  do {
    const page = await admin.auth().listUsers(1000, nextPageToken);
    for (const user of page.users) {
      if (user.email) {
        usersByEmail.set(user.email.toLowerCase(), user.uid);
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  return usersByEmail;
}

async function seed() {
  initFirebaseAdmin();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "trucklogix",
  });

  const firebaseUsersByEmail = await listFirebaseUsersByEmail();
  const SEED_COMPANY_ID = "iscope-authority-001";
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const users = [
    {
      id: "admin-001",
      email: "admin@kci-authority.com",
      name: "Authority Admin",
      role: "admin",
    },
    {
      id: "admin-loadpilot",
      email: "admin@loadpilot.com",
      name: "Authority Admin",
      role: "admin",
    },
    {
      id: "dispatch-loadpilot",
      email: "dispatch@loadpilot.com",
      name: "Dispatch Lead",
      role: "dispatcher",
    },
    {
      id: "fused-ops",
      email: "fused_ops@kci.com",
      name: "Fused Operations",
      role: "dispatcher",
    },
    {
      id: "fused-finance",
      email: "fused_finance@kci.com",
      name: "Fused Finance",
      role: "payroll_manager",
    },
  ];

  console.log("Seeding SQL users and backfilling firebase_uid...");

  for (const user of users) {
    const firebaseUid =
      firebaseUsersByEmail.get(user.email.toLowerCase()) || null;

    try {
      await connection.query(
        `INSERT INTO users (
          id,
          company_id,
          email,
          firebase_uid,
          password,
          name,
          role,
          onboarding_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          company_id = VALUES(company_id),
          email = VALUES(email),
          firebase_uid = COALESCE(VALUES(firebase_uid), firebase_uid),
          password = VALUES(password),
          name = VALUES(name),
          role = VALUES(role),
          onboarding_status = VALUES(onboarding_status)`,
        [
          user.id,
          SEED_COMPANY_ID,
          user.email,
          firebaseUid,
          hashedPassword,
          user.name,
          user.role,
          "Completed",
        ],
      );

      console.log(
        `Synced ${user.email}${firebaseUid ? ` -> ${firebaseUid}` : " (no Firebase UID found)"}`,
      );
    } catch (error) {
      console.error(
        `Failed to sync ${user.email}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  await connection.end();
  console.log("Sync complete.");
}

seed().catch((error) => {
  console.error(
    "Identity repair failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
