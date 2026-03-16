import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Firebase configuration using environment variables
// Values are populated from .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/**
 * Demo mode activates when Firebase credentials are missing in DEV,
 * and only when the build mode is not 'production'.
 * All auth is handled locally via localStorage — no Firebase calls.
 */
export const DEMO_MODE =
  import.meta.env.DEV &&
  !firebaseConfig.apiKey &&
  import.meta.env.MODE !== "production";

// Production guard: crash at startup with a clear message if somehow
// DEMO_MODE is active in a production build (defense-in-depth).
if (import.meta.env.PROD && DEMO_MODE) {
  throw new Error(
    "DEMO_MODE cannot be active in production. Set VITE_FIREBASE_API_KEY.",
  );
}

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _storage: FirebaseStorage | null = null;
let _analytics: ReturnType<typeof getAnalytics> | null = null;

if (!DEMO_MODE) {
  app = initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _storage = getStorage(app);
  _analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
} else {
  console.info(
    "%c[DEMO MODE] Firebase credentials not found — running with local auth only.",
    "color: #f59e0b; font-weight: bold",
  );
}

// Auth is null in demo mode — callers must check DEMO_MODE before using
export const auth = _auth as Auth;
export const storage = _storage as FirebaseStorage;
export const analytics = _analytics;
export default app;
