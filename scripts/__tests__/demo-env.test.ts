import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  buildDemoRuntimeEnv,
  collectDemoEnvProblems,
  parseEnvFile,
  validateDemoEnvFile,
} from "../../scripts/demo-env.cjs";

function makeTempEnv(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-env-test-"));
  const file = path.join(dir, ".env.local");
  fs.writeFileSync(file, content, "utf8");
  return file;
}

describe("scripts/demo-env.cjs", () => {
  it("parses quoted and unquoted env values", () => {
    const file = makeTempEnv(
      [
        "DB_HOST=127.0.0.1",
        'DB_USER="loadpilot"',
        "DB_PASSWORD='secret'",
        "",
      ].join("\n"),
    );

    const vars = parseEnvFile(file);
    expect(vars.DB_HOST).toBe("127.0.0.1");
    expect(vars.DB_USER).toBe("loadpilot");
    expect(vars.DB_PASSWORD).toBe("secret");
  });

  it("flags missing Gemini and required demo keys", () => {
    const file = makeTempEnv(
      [
        "DB_HOST=127.0.0.1",
        "DB_PORT=3306",
        "DB_USER=root",
        "DB_PASSWORD=root",
        "DB_NAME=loadpilot_demo",
        "SALES_DEMO_ADMIN_FIREBASE_UID=admin-uid",
        "SALES_DEMO_DRIVER_FIREBASE_UID=driver-uid",
        "SALES_DEMO_ADMIN_EMAIL=admin@example.com",
        "SALES_DEMO_ADMIN_PASSWORD=secret",
        "SALES_DEMO_DRIVER_EMAIL=driver@example.com",
        "SALES_DEMO_DRIVER_PASSWORD=secret",
        "VITE_DEMO_NAV_MODE=sales",
        "ALLOW_DEMO_RESET=1",
        "FIREBASE_WEB_API_KEY=abc",
        "VITE_FIREBASE_API_KEY=abc",
        "VITE_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com",
        "VITE_FIREBASE_PROJECT_ID=demo",
        "VITE_FIREBASE_STORAGE_BUCKET=demo.appspot.com",
        "VITE_FIREBASE_MESSAGING_SENDER_ID=123",
        "VITE_FIREBASE_APP_ID=1:123:web:456",
        "",
      ].join("\n"),
    );

    const { problems } = validateDemoEnvFile(file, { requireGemini: true });
    expect(problems).toContain("  - GEMINI_API_KEY is missing or empty");
  });

  it("flags mismatched firebase web keys", () => {
    const vars = {
      FIREBASE_WEB_API_KEY: "server-key",
      VITE_FIREBASE_API_KEY: "client-key",
    } as NodeJS.ProcessEnv;
    const problems = collectDemoEnvProblems(vars, { requireGemini: false });
    expect(
      problems.some((p) =>
        p.includes("FIREBASE_WEB_API_KEY and VITE_FIREBASE_API_KEY must match"),
      ),
    ).toBe(true);
  });

  it("hydrates GOOGLE_APPLICATION_CREDENTIALS from a local service account file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-env-runtime-"));
    const serviceAccountPath = path.join(dir, "serviceAccount.json");
    fs.writeFileSync(serviceAccountPath, '{"project_id":"demo"}', "utf8");

    const runtimeEnv = buildDemoRuntimeEnv(
      { DB_HOST: "127.0.0.1" } as NodeJS.ProcessEnv,
      { serviceAccountPath },
    );

    expect(runtimeEnv.GOOGLE_APPLICATION_CREDENTIALS).toBe(serviceAccountPath);
  });
});
