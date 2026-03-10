/**
 * Firebase REST Auth helper.
 * Creates, signs in, and deletes test users via Firebase Identity Toolkit REST API.
 * Uses FIREBASE_WEB_API_KEY from environment. No Firebase Admin SDK required.
 * Tests R-P1-03
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

const BASE_URL = "https://identitytoolkit.googleapis.com/v1/accounts";

function getApiKey(): string {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) {
    throw new Error("FIREBASE_WEB_API_KEY env var not set");
  }
  return key;
}

export interface FirebaseAuthUser {
  idToken: string;
  localId: string;
  email: string;
}

export async function createTestUser(
  email: string,
  pw: string,
): Promise<FirebaseAuthUser> {
  const key = getApiKey();
  const res = await fetch(`${BASE_URL}:signUp?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw, returnSecureToken: true }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Firebase signUp failed: ${JSON.stringify(body["error"] ?? body)}`,
    );
  }
  return {
    idToken: body["idToken"] as string,
    localId: body["localId"] as string,
    email: body["email"] as string,
  };
}

export async function signInTestUser(
  email: string,
  pw: string,
): Promise<FirebaseAuthUser> {
  const key = getApiKey();
  const res = await fetch(`${BASE_URL}:signInWithPassword?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: pw,
      returnSecureToken: true,
    }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Firebase signIn failed: ${JSON.stringify(body["error"] ?? body)}`,
    );
  }
  return {
    idToken: body["idToken"] as string,
    localId: body["localId"] as string,
    email: body["email"] as string,
  };
}

export async function deleteTestUser(idToken: string): Promise<void> {
  const key = getApiKey();
  const res = await fetch(`${BASE_URL}:delete?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = (await res.json()) as Record<string, unknown>;
    throw new Error(
      `Firebase delete failed: ${JSON.stringify(body["error"] ?? body)}`,
    );
  }
}
