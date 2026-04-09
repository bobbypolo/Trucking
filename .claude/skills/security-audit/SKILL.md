---
name: security-audit
description: On-demand security audit — pattern coverage inventory, SCA deep scan (pip-audit/npm-audit/bandit), DAST integration point (ZAP), and remediation priority matrix.
context: fork
---

# /security-audit — Security Audit

Run all 4 sections in order. For each finding, record severity, tool, and accepted status.

---

## Section 1: Pattern Coverage Inventory

**Purpose**: Report what the always-on production scanner (`_prod_patterns.py`) currently detects, its OWASP 2025 category coverage, and CVSS severity distribution.

```python
# Lazy import — only load when this skill runs
import sys, importlib
sys.path.insert(0, ".claude/hooks")
_prod = importlib.import_module("_prod_patterns")

patterns = _prod.PROD_VIOLATION_PATTERNS
cvss_map = _prod.CVSS_SEVERITY_MAP

# Pattern count
total_patterns = len(patterns)

# Severity distribution (block vs warn)
block_count = sum(1 for _, _, _, sev in patterns if sev == "block")
warn_count  = sum(1 for _, _, _, sev in patterns if sev == "warn")

# CVSS distribution buckets (from CVSS_SEVERITY_MAP)
import collections
cvss_buckets = collections.Counter()
for score in cvss_map.values():
    if score >= 9.0:
        cvss_buckets["critical (9.0-10.0)"] += 1
    elif score >= 7.0:
        cvss_buckets["high (7.0-8.9)"] += 1
    elif score >= 4.0:
        cvss_buckets["medium (4.0-6.9)"] += 1
    elif score > 0.0:
        cvss_buckets["low (0.1-3.9)"] += 1
    else:
        cvss_buckets["info (0.0)"] += 1
```

**Report**:

```
Pattern Coverage Inventory
==========================
Total patterns : <total_patterns>
  BLOCK        : <block_count>
  WARN         : <warn_count>

CVSS Severity Distribution (CVSS 3.1 approximations):
  Critical (9.0-10.0) : <n>  — hardcoded secrets, SQL/shell/eval injection
  High     (7.0-8.9)  : <n>  — privilege escalation, pickle deserialization, path traversal
  Medium   (4.0-6.9)  : <n>  — XSS sinks, unvalidated redirects, subprocess shell=True
  Low      (0.1-3.9)  : <n>  — broad/bare except, exception masking
  Info     (0.0)      : <n>  — debug prints, TODO comments, debugger statements

OWASP Top 10 2025 Category Coverage:
  A01 Broken Access Control       : path-traversal, unvalidated-redirect
  A02 Cryptographic Failures      : hardcoded-secret, expanded-secret
  A03 Injection                   : sql-injection, shell-injection, raw-sql-fstring, os-exec-injection,
                                    eval-exec-var, subprocess-shell-injection,
                                    xss-inner-html, xss-document-write, xss-dangerously-set-inner-html,
                                    xss-vue-html, xss-jquery-html (JS), xss-dangerously-set-inner-html-js (JS)
  A04 Insecure Design             : unsafe-tempfile
  A05 Security Misconfiguration   : subprocess-shell-injection, subprocess-shell-multiline
  A06 Vulnerable Components       : (covered by Section 2 SCA)
  A08 Software Integrity Failures : pickle-deserialize
  A09 Logging & Monitoring Gaps   : silent-swallow, error-mask-none, bare-except, broad-except
  A10 Privilege Escalation        : priv-escalation-setuid
  NOT COVERED                     : A07 Authentication Failures, A05 credential stuffing
                                    (these require runtime context; static patterns cannot detect them)
```

> **Limitation**: Static pattern matching cannot catch all injection variants (e.g., multi-step taint flows). Use Section 2 (bandit/semgrep) for deeper semantic analysis.

---

## Section 2: SCA Deep Scan

**Purpose**: Run pip-audit, npm-audit, and bandit; parse their JSON output via `_sca_parser.py`; normalize severity; flag accepted findings from `.security-baseline.json`.

### 2a. Load Acceptance Baseline

```python
import json, pathlib
baseline_path = pathlib.Path(".security-baseline.json")
accepted_ids: set[str] = set()
if baseline_path.exists():
    try:
        baseline = json.loads(baseline_path.read_text())
        accepted_ids = {e.get("id", "") for e in baseline.get("accepted", [])}
    except Exception:
        pass  # missing or malformed baseline — treat as empty
```

### 2b. Run Scanners

Run each scanner that is enabled in `workflow.json` `external_scanners` block. If a scanner is not installed or fails, record `SKIPPED — <reason>` and continue.

```python
import subprocess, sys, json as _json
sys.path.insert(0, ".claude/hooks")
from _sca_parser import (
    parse_pip_audit_json, parse_npm_audit_json, parse_bandit_json,
    normalize_severity
)

def run_scanner(cmd: list[str]) -> tuple[str, str]:
    """Returns (stdout, error_reason). error_reason is empty on success."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return result.stdout, ""
    except FileNotFoundError:
        return "", f"tool not found: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return "", "timeout after 120s"
    except Exception as e:
        return "", str(e)
```

**pip-audit** (Python dependency vulnerabilities):

```python
stdout, err = run_scanner(["pip-audit", "--format=json"])
if err:
    pip_findings = []
    pip_status = f"SKIPPED — {err}"
else:
    pip_findings = parse_pip_audit_json(stdout)
    pip_status = f"{len(pip_findings)} finding(s)"
```

**npm-audit** (Node.js dependency vulnerabilities — run only if `package.json` exists):

```python
import pathlib
if pathlib.Path("package.json").exists():
    stdout, err = run_scanner(["npm", "audit", "--json"])
    if err:
        npm_findings = []
        npm_status = f"SKIPPED — {err}"
    else:
        npm_findings = parse_npm_audit_json(stdout)
        npm_status = f"{len(npm_findings)} finding(s)"
else:
    npm_findings = []
    npm_status = "SKIPPED — no package.json"
```

**bandit** (Python static security analysis):

```python
stdout, err = run_scanner(["bandit", "-r", ".", "-f", "json", "-q"])
if err:
    bandit_findings = []
    bandit_status = f"SKIPPED — {err}"
else:
    bandit_findings = parse_bandit_json(stdout)
    bandit_status = f"{len(bandit_findings)} finding(s)"
```

### 2c. Normalize and Report

For each finding, normalize severity and check acceptance status:

```python
def is_accepted(finding_id: str) -> bool:
    return finding_id in accepted_ids

def accepted_label(finding_id: str) -> str:
    return " [ACCEPTED]" if is_accepted(finding_id) else ""
```

**Report format** (grouped by normalized severity, critical first):

```
SCA Deep Scan Results
=====================
pip-audit  : <pip_status>
npm-audit  : <npm_status>
bandit     : <bandit_status>

--- pip-audit findings (normalized severity) ---
CRITICAL  CVE-2024-XXXX  package==1.0.0  fix: 1.0.1  [ACCEPTED]?
HIGH      CVE-2023-XXXX  package==2.0.0  fix: 2.1.0

--- npm-audit findings (normalized severity) ---
HIGH      package@1.0.0  lodash prototype pollution  https://...  fix_available: yes

--- bandit findings (normalized severity) ---
MEDIUM    src/app.py:42  CWE-78  subprocess call with shell=True  confidence: HIGH

Note: CVSS scores are included only when provided by the scanner tool.
      pip-audit and bandit do not emit CVSS; npm-audit emits CVSS in some advisory formats.
```

> **Accepted findings**: Findings whose ID appears in `.security-baseline.json` are shown with `[ACCEPTED]` and excluded from the FAIL count. To accept a finding, add `{"id": "<vuln_id>", "reason": "...", "expires": "YYYY-MM-DD"}` to `.security-baseline.json`.

---

## Section 3: DAST Integration Point

**Purpose**: Run ZAP Baseline scan (passive only) by default. ZAP Full Scan requires explicit `"mode": "full"` opt-in in `workflow.json`. Document setup instructions if ZAP is not configured.

### DAST Mode Resolution

```python
import json, pathlib
wf_path = pathlib.Path(".claude/workflow.json")
dast_config: dict = {}
if wf_path.exists():
    try:
        wf = json.loads(wf_path.read_text())
        dast_config = wf.get("dast", {})
    except Exception:
        pass

dast_enabled = dast_config.get("enabled", False)
dast_mode    = dast_config.get("mode", "baseline")   # default: baseline
target_url   = dast_config.get("target_url", "")
zap_image    = dast_config.get("zap_image", "ghcr.io/zaproxy/zaproxy:stable")
```

### Default: ZAP Baseline (Passive Scan)

The **ZAP Baseline scan** (`zap-baseline.py`) performs **passive scanning only** — it crawls the target and reports alerts without sending attack payloads. It is safe to run against production URLs.

If `dast_enabled` is `true` and `dast_mode == "baseline"`:

```python
import subprocess
cmd = [
    "docker", "run", "--rm",
    "-v", f"{pathlib.Path.cwd()}:/zap/wrk",
    zap_image,
    "zap-baseline.py", "-t", target_url, "-J", "zap-baseline-report.json"
]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
```

Parse `zap-baseline-report.json` and report alerts grouped by risk level (High → Low).

### Opt-in: ZAP Full Scan (Active Scan)

The **ZAP Full Scan** (`zap-full-scan.py`) performs **active scanning** — it sends attack payloads to probe for vulnerabilities. It:

- Requires explicit `"mode": "full"` in `workflow.json` `dast` block
- Has much longer runtime (minutes to hours depending on target size)
- **Must NEVER be run against production** — use staging/sandbox only
- May cause unintended side effects (form submissions, account creation, etc.)

If `dast_mode == "full"`:

```python
cmd = [
    "docker", "run", "--rm",
    "-v", f"{pathlib.Path.cwd()}:/zap/wrk",
    zap_image,
    "zap-full-scan.py", "-t", target_url, "-J", "zap-full-report.json"
]
```

**IMPORTANT**: Display a prominent warning before running full scan:

```
WARNING: ZAP Full Scan will send attack payloads to <target_url>.
         Ensure this is a staging/sandbox environment, NOT production.
         Confirm with: yes/no
```

Pause for user confirmation before proceeding.

### If DAST Not Configured

If `dast_enabled` is `false` or the `dast` block is absent from `workflow.json`:

```
DAST Integration Point
======================
Status  : NOT CONFIGURED

Setup Instructions
------------------
1. Install Docker: https://docs.docker.com/get-docker/
2. Add to workflow.json:

   "dast": {
     "enabled": true,
     "mode": "baseline",
     "target_url": "http://localhost:8080",
     "zap_image": "ghcr.io/zaproxy/zaproxy:stable"
   }

   mode options:
     "baseline" (default) — passive scan, safe for production URLs
     "full"               — active scan, staging/sandbox ONLY

3. Re-run /security-audit to execute ZAP Baseline scan.

Note: ZAP Full Scan ("mode": "full") requires explicit opt-in and
      must only be run against staging/sandbox targets.
```

---

## Section 4: Remediation Priority Matrix

**Purpose**: Aggregate all findings from Sections 1-3 into a single severity-sorted remediation priority matrix. Includes accepted status column. Sorted by normalized severity (critical first), then by tool.

### Aggregate All Findings

Collect:

- Section 2 pip-audit findings → normalize via `normalize_severity("pip-audit", ...)`
- Section 2 npm-audit findings → normalize via `normalize_severity("npm-audit", ...)`
- Section 2 bandit findings → normalize via `normalize_severity("bandit", ...)`
- Section 3 DAST findings (if ZAP ran) → risk level mapped to: High→high, Medium→medium, Low→low

### Sort and Display

Sort order: critical > high > medium > low > unknown

```
Remediation Priority Matrix
============================
Severity  | Tool       | ID / Location                    | Description                   | Accepted
--------- | ---------- | -------------------------------- | ----------------------------- | --------
CRITICAL  | pip-audit  | CVE-2024-XXXX (package==1.0.0)   | Known vulnerability           | no
HIGH      | bandit     | src/app.py:42 CWE-78             | subprocess call with shell=True | no
HIGH      | npm-audit  | lodash@4.17.20                   | Prototype pollution           | yes [ACCEPTED]
MEDIUM    | zap        | http://localhost/login           | Missing X-Frame-Options       | no
LOW       | bandit     | src/utils.py:10 CWE-703          | Try-except-pass pattern       | no

Summary
-------
Total findings   : <n>
Active (non-accepted) : <n>
Accepted         : <n>
FAIL threshold   : any CRITICAL or HIGH that is not accepted
```

### Remediation Guidance

For each active (non-accepted) HIGH or CRITICAL finding, output a brief remediation note:

```
Priority Remediations
---------------------
1. [CRITICAL] CVE-2024-XXXX in package==1.0.0
   Action: Upgrade to 1.0.1 (pip install "package>=1.0.1")

2. [HIGH] CWE-78 subprocess shell=True at src/app.py:42
   Action: Replace shell=True with list args: subprocess.run(["cmd", arg], shell=False)
```

### Audit Result

```
/security-audit RESULT
======================
Section 1 (Patterns)  : PASS — <n> patterns loaded, OWASP 2025 coverage reported
Section 2 (SCA)       : PASS | WARN | FAIL — <summary>
Section 3 (DAST)      : PASS | SKIP | WARN | FAIL — <summary>
Section 4 (Matrix)    : <total> findings, <active> active, <accepted> accepted

Overall: PASS | WARN | FAIL
```

Criteria:

- **PASS**: No active CRITICAL or HIGH findings
- **WARN**: Active MEDIUM or LOW findings only
- **FAIL**: Any active CRITICAL or HIGH finding (not in `.security-baseline.json`)
