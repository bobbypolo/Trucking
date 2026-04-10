"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const ENV_TEMPLATE = path.join(PROJECT_ROOT, ".env.example.sales-demo");

const PLACEHOLDER_PATTERN = /<fill[- ]?in>/i;

const REQUIRED_DEMO_VARS = [
  { key: "DB_HOST" },
  { key: "DB_PORT" },
  { key: "DB_USER" },
  { key: "DB_PASSWORD" },
  { key: "DB_NAME" },
  { key: "SALES_DEMO_ADMIN_FIREBASE_UID" },
  { key: "SALES_DEMO_DRIVER_FIREBASE_UID" },
  { key: "SALES_DEMO_ADMIN_EMAIL" },
  { key: "SALES_DEMO_ADMIN_PASSWORD" },
  { key: "SALES_DEMO_DRIVER_EMAIL" },
  { key: "SALES_DEMO_DRIVER_PASSWORD" },
  { key: "VITE_DEMO_NAV_MODE", exact: "sales" },
  { key: "ALLOW_DEMO_RESET", exact: "1" },
  { key: "FIREBASE_WEB_API_KEY" },
  { key: "VITE_FIREBASE_API_KEY" },
  { key: "VITE_FIREBASE_AUTH_DOMAIN" },
  { key: "VITE_FIREBASE_PROJECT_ID" },
  { key: "VITE_FIREBASE_STORAGE_BUCKET" },
  { key: "VITE_FIREBASE_MESSAGING_SENDER_ID" },
  { key: "VITE_FIREBASE_APP_ID" },
];

const REQUIRED_MATCHES = [
  ["FIREBASE_WEB_API_KEY", "VITE_FIREBASE_API_KEY"],
];

function parseEnvFile(filePath) {
  const vars = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 1) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

function ensureEnvLocalFile({ copyTemplate = false } = {}) {
  if (fs.existsSync(ENV_LOCAL)) {
    return true;
  }

  if (copyTemplate && fs.existsSync(ENV_TEMPLATE)) {
    fs.copyFileSync(ENV_TEMPLATE, ENV_LOCAL);
    return false;
  }

  return false;
}

function loadEnvFileIntoProcess(filePath, { override = false } = {}) {
  const vars = parseEnvFile(filePath);
  for (const [key, value] of Object.entries(vars)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return vars;
}

function isPlaceholder(value) {
  return typeof value === "string" && PLACEHOLDER_PATTERN.test(value);
}

function collectDemoEnvProblems(vars, { requireGemini = true } = {}) {
  const problems = [];

  for (const spec of REQUIRED_DEMO_VARS) {
    const value = vars[spec.key];

    if (value === undefined || value === "") {
      problems.push("  - " + spec.key + " is missing or empty");
      continue;
    }

    if (isPlaceholder(value)) {
      problems.push(
        "  - " + spec.key + " still contains a <fill-in> placeholder",
      );
      continue;
    }

    if (spec.exact && value !== spec.exact) {
      problems.push(
        "  - " +
          spec.key +
          ' must be "' +
          spec.exact +
          '" (got "' +
          value +
          '")',
      );
    }
  }

  if (requireGemini) {
    const gemini = vars.GEMINI_API_KEY;
    if (gemini === undefined || gemini === "" || isPlaceholder(gemini)) {
      problems.push("  - GEMINI_API_KEY is missing or empty");
    }
  }

  for (const [leftKey, rightKey] of REQUIRED_MATCHES) {
    const left = vars[leftKey];
    const right = vars[rightKey];
    if (
      left !== undefined &&
      right !== undefined &&
      !isPlaceholder(left) &&
      !isPlaceholder(right) &&
      left !== right
    ) {
      problems.push(
        "  - " + leftKey + " and " + rightKey + " must match (got different values)",
      );
    }
  }

  return problems;
}

function validateDemoEnvFile(filePath, options = {}) {
  const vars = parseEnvFile(filePath);
  const problems = collectDemoEnvProblems(vars, options);
  return { vars, problems };
}

function formatDemoEnvProblems(problems, filePath) {
  return (
    "The following " +
    filePath +
    " variables need attention:\n\n" +
    problems.join("\n") +
    "\n\nFix them in " +
    filePath +
    " and re-run the demo command."
  );
}

module.exports = {
  PROJECT_ROOT,
  ENV_LOCAL,
  ENV_TEMPLATE,
  PLACEHOLDER_PATTERN,
  REQUIRED_DEMO_VARS,
  REQUIRED_MATCHES,
  parseEnvFile,
  ensureEnvLocalFile,
  loadEnvFileIntoProcess,
  collectDemoEnvProblems,
  validateDemoEnvFile,
  formatDemoEnvProblems,
};
