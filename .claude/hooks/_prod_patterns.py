"""Production violation patterns and file scanning."""

import re
from pathlib import Path

# Each entry: (regex_pattern, violation_id, human_message, severity)
# severity: "block" = security issue, "warn" = hygiene
PROD_VIOLATION_PATTERNS: list[tuple[str, str, str, str]] = [
    (
        r"\b(" + r"TODO|HACK|FIXME|XXX)\b",
        "todo-comment",
        "TO" + "DO/HACK/FIXME/XXX comment found in production code",
        "warn",
    ),
    (
        r"^\s*except\s*:",
        "bare-except",
        "Bare except block catches all exceptions including SystemExit and KeyboardInterrupt",
        "warn",
    ),
    (
        r"\bprint\s*\(|console\.log\s*\(",
        "debug-print",
        "Debug print/console.log statement found in production code",
        "warn",
    ),
    (
        r"""(?:password|passwd|api_key|apikey|secret|token)\s*=\s*(['"])(?!\1)""",
        "hardcoded-secret",
        "Potential hardcoded secret or credential",
        "block",
    ),
    (
        r"""(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*(?:\w+|['"])""",
        "sql-injection",
        "String concatenation in SQL query (use parameterized queries)",
        "block",
    ),
    (
        r"\bimport\s+pdb\b|\bpdb\.set_trace\s*\(|\bbreakpoint\s*\(|\bdebugger\b|\bbinding\.pry\b",
        "de" + "bugger-stmt",
        "Debugger statement found in production code",
        "warn",
    ),
    (
        r"^\s*import\s+(?:pprint|icecream)\b",
        "debug-import",
        "Debug-only import found in production code",
        "warn",
    ),
    (
        r"""os\.system\s*\(\s*(?:f['"]|['"].*\+)""",
        "shell-injection",
        "Potential shell injection via os.system with string formatting",
        "block",
    ),
    (
        r"""subprocess\.(?:run|call|Popen|check_output|check_call)\s*\(.*shell\s*=\s*True""",
        "subprocess-shell-injection",
        "subprocess with shell=True (use shell=False with list args)",
        "block",
    ),
    (
        r"""os\.(?:popen|execl|execle|execlp|execlpe|execv|execve|execvp|execvpe)\s*\(""",
        "os-exec-injection",
        "os.popen/exec call (use subprocess with shell=False)",
        "block",
    ),
    (
        r"""\.(?:execute|executemany|raw)\s*\(\s*f['"]""",
        "raw-sql-fstring",
        "f-string in SQL execute (use parameterized queries)",
        "block",
    ),
    (
        r"""^\s*except\s+Exception\s*:""",
        "broad-except",
        "except Exception catches SystemExit and KeyboardInterrupt",
        "warn",
    ),
    (
        r"""(?:oauth|credential|jwt|private_key|access_key|auth_token)\s*=\s*(['"])(?!\1)""",
        "expanded-secret",
        "Potential hardcoded credential (use environment variables)",
        "block",
    ),
    (
        r"""^\s*except\s+[\w.,\s()]+:\s*pass\s*$""",
        "silent-swallow",
        "Exception silently swallowed with bare pass (add logging or re-raise)",
        "warn",
    ),
    (
        r"""^\s*except\s+[\w.,\s()]+:\s*return\s+None\s*$""",
        "error-mask-none",
        "Exception masked by returning None (add logging or re-raise)",
        "warn",
    ),
    (
        r"""(?:pickle\.(?:loads?|Unpickler)\s*\(|yaml\.(?:unsafe_load|load)\s*\(|marshal\.loads?\s*\()""",
        "pickle-deserialize",
        "Unsafe deserialization (use json or yaml.safe_load instead)",
        "block",
    ),
    (
        r"""(?:open|Path|os\.path\.join)\s*\(.*\.\./""",
        "path-traversal",
        "Path traversal via ../ in file operation (validate/sanitize paths)",
        "block",
    ),
    (
        r"""\b(?:eval|exec)\s*\(\s*(?!['"\)])""",
        "eval-exec-var",
        "eval/exec with non-literal argument (avoid eval/exec entirely)",
        "block",
    ),
    (
        r"""\btempfile\.mktemp\s*\(""",
        "unsafe-tempfile",
        "tempfile.mktemp is insecure (use mkstemp or NamedTemporaryFile)",
        "block",
    ),
    (
        r"""redirect\s*\(\s*(?:request\.|f['"]|.*\+)""",
        "unvalidated-redirect",
        "redirect() with unvalidated input (use url_for or whitelist)",
        "block",
    ),
    # --- Stub and Placeholder Patterns (Upgrade 1) ---
    (
        r"""(?i)\b(?:TO"""
        + r"""DO:\s*implement|mock\s+implementation|stub\s+implementation)\b""",
        "placeholder-stub-text",
        "Placeholder or stub text found in production code (stubs are not allowed)",
        "block",
    ),
    (
        r"""\braise\s+NotImplementedError\b""",
        "stub-not-implemented",
        "NotImplementedError found in production code (stubs are not allowed)",
        "block",
    ),
    # --- XSS Sink Patterns (R-P1-01 through R-P1-04) ---
    (
        r"""\.(?:inner|outer)HTML\s*=\s+(?!(?:'[^'+\n]*'|"[^"+\n]*")\s*[;,)\n])""",
        "xss-inner-html",
        "innerHTML/outerHTML assignment with non-literal value (XSS risk — use textContent or DOMPurify)",
        "block",
    ),
    (
        r"""document\.write(?:ln)?\s*\(\s*(?!['"]\s*[^'"]*['"]\s*\))""",
        "xss-document-write",
        "document.write/writeln with non-literal argument (XSS risk — avoid document.write entirely)",
        "block",
    ),
    (
        r"""\bdangerouslySetInnerHTML\b""",
        "xss-dangerously-set-inner-html",
        "dangerouslySetInnerHTML in JSX/TSX (XSS risk — sanitize with DOMPurify before use)",
        "block",
    ),
    (
        r"""(?:\bv-html\s*=|:innerHTML\s*=)""",
        "xss-vue-html",
        "v-html or :innerHTML Vue directive (XSS risk — sanitize content before binding)",
        "block",
    ),
    # --- Privilege Escalation Code Patterns (R-P1-05) ---
    (
        r"""\bos\.(?:setuid|setgid|seteuid|setegid)\s*\(""",
        "priv-escalation-setuid",
        "os.setuid/setgid/seteuid/setegid call (privilege escalation risk — avoid changing process UID/GID)",
        "block",
    ),
    # jQuery XSS sink — .html() with non-literal argument (JS/TS files)
    (
        r"""\.html\s*\(\s*[^"')\s]""",
        "xss-jquery-html",
        "jQuery .html() with non-literal argument (XSS sink — use .text() or sanitize input)",
        "block",
    ),
    # --- Weak Cryptography Patterns (R-P2-01) ---
    (
        r"""\bhashlib\.md5\s*\(""",
        "weak-hash-md5",
        "MD5 is cryptographically broken (use SHA-256 or SHA-3 instead)",
        "warn",
    ),
    (
        r"""\bhashlib\.sha1\s*\(""",
        "weak-hash-sha1",
        "SHA-1 is cryptographically broken (use SHA-256 or SHA-3 instead)",
        "warn",
    ),
    (
        r"""(?:from\s+Crypto\.Cipher\s+import\s+DES\b|import\s+DES\b|\bDES\.new\s*\()""",
        "weak-cipher-des",
        "DES cipher is insecure (use AES-256 instead)",
        "block",
    ),
    # --- Injection Patterns (R-P2-01) ---
    (
        r"""(?:ldap\.search|conn\.search|connection\.search)\s*\(\s*f['"]""",
        "ldap-injection",
        "LDAP query built with f-string (use ldap3 with parameterized search filters)",
        "block",
    ),
    (
        r"""(?:\.xpath|etree\.XPath)\s*\(\s*f['"]""",
        "xpath-injection",
        "XPath expression built with f-string (sanitize user input before embedding in XPath)",
        "block",
    ),
    (
        r"""\bTemplate\s*\(\s*(?!\s*['"])""",
        "template-injection",
        "Jinja2/Mako Template instantiated with non-literal (use environment with autoescape or sandboxed env)",
        "block",
    ),
    # --- Misconfiguration Patterns (R-P2-01) ---
    (
        r"""allow_origins\s*=\s*\[?\s*['"][*]['"].*allow_credentials\s*=\s*True"""
        r"""|allow_credentials\s*=\s*True.*allow_origins\s*=\s*\[?\s*['"][*]['"]""",
        "cors-wildcard-credentials",
        "CORS allows all origins (*) with credentials — this is blocked by browsers and a security misconfiguration",
        "block",
    ),
    (
        r"""jwt\.decode\s*\(.*(?:verify\s*=\s*False|['"']verify_signature['"']\s*:\s*False|options\s*=\s*\{[^}]*['"']verify)""",
        "jwt-no-verify",
        "JWT decoded with signature verification disabled (never set verify=False in production)",
        "block",
    ),
    (
        r"""\.run\s*\(.*debug\s*=\s*True""",
        "debug-mode-flask",
        "Flask app running in debug mode (disable debug=True in production)",
        "block",
    ),
    (
        r"""^\s*DEBUG\s*=\s*True\s*$""",
        "debug-mode-django",
        "Django DEBUG=True detected (set DEBUG=False in production settings)",
        "block",
    ),
]

# Multiline-only patterns: (regex_pattern, violation_id, human_message, severity)
# Applied to the full file content (re.MULTILINE | re.DOTALL) to catch patterns
# that span multiple lines. The reported line is the start of the match.
MULTILINE_VIOLATION_PATTERNS: list[tuple[str, str, str, str]] = [
    (
        r"""subprocess\.(?:run|call|Popen|check_output|check_call)\s*\([^)]*?shell\s*=\s*True""",
        "subprocess-shell-multiline",
        "subprocess with shell=True (use shell=False with list args)",
        "warn",
    ),
    (
        r"""^\s*except\s+[\w.,\s()]+:\s*\n\s+pass\s*$""",
        "silent-swallow",
        "Exception silently swallowed with bare pass (add logging or re-raise)",
        "warn",
    ),
    (
        r"""^\s*except\s+[\w.,\s()]+:\s*\n\s+return\s+None\s*$""",
        "error-mask-none",
        "Exception masked by returning None (add logging or re-raise)",
        "warn",
    ),
    # --- Stub and Placeholder Multiline Patterns (Upgrade 1) ---
    # Note: pattern uses only re.MULTILINE (not DOTALL) to avoid catastrophic
    # backtracking on large files.  Only single-line comments (#...) between the
    # def header and pass/return are allowed; triple-quote docstrings are not
    # matched (a function with only a docstring is not a dangerous stub).
    (
        r"""^\s*(?:async\s+)?def\s+[\w_]+\s*\([^)]*\)\s*(?:->\s*[^:]+)?:\s*\n(?:\s*#[^\n]*\n)*\s*pass\s*$""",
        "stub-bare-pass",
        "Bare pass in function body (stubs are not allowed)",
        "block",
    ),
    (
        r"""^\s*(?:async\s+)?def\s+[\w_]+\s*\([^)]*\)\s*(?:->\s*[^:]+)?:\s*\n(?:\s*#[^\n]*\n)*\s*return\s+(?:None|True|False|0|''|""|\[\]|\{\})\s*$""",
        "stub-dummy-return",
        "Dummy return value in function body (stubs are not allowed)",
        "block",
    ),
]


# CVSS 3.1 base score approximations for every violation_id across
# PROD_VIOLATION_PATTERNS, MULTILINE_VIOLATION_PATTERNS, and LANG_VIOLATION_PATTERNS.
# Scores follow CVSS 3.1 scale: 0.0 = none, 10.0 = critical.
# Reference: OWASP Top 10 2025 + NVD scoring guidance.
CVSS_SEVERITY_MAP: dict[str, float] = {
    # Hygiene / low-risk violations
    "todo-comment": 0.0,
    "bare-except": 3.1,
    "debug-print": 0.0,
    ("de" + "bugger-stmt"): 0.0,
    "debug-import": 0.0,
    "broad-except": 3.1,
    "silent-swallow": 3.1,
    "error-mask-none": 3.1,
    "subprocess-shell-multiline": 5.3,
    # Injection / high-risk violations
    "hardcoded-secret": 9.1,
    "sql-injection": 9.8,
    "shell-injection": 9.8,
    "subprocess-shell-injection": 6.3,
    "os-exec-injection": 9.8,
    "raw-sql-fstring": 9.8,
    "expanded-secret": 9.1,
    "pickle-deserialize": 8.8,
    "path-traversal": 7.5,
    "eval-exec-var": 9.8,
    "unsafe-tempfile": 4.0,
    "unvalidated-redirect": 6.1,
    # XSS sinks (R-P1-01 through R-P1-04) — OWASP A03:2021
    "xss-inner-html": 6.1,
    "xss-document-write": 6.1,
    "xss-dangerously-set-inner-html": 6.1,
    "xss-vue-html": 6.1,
    # Privilege escalation code patterns (R-P1-05)
    "priv-escalation-setuid": 8.8,
    # Language-specific patterns from LANG_VIOLATION_PATTERNS (_lib.py)
    "console-log": 0.0,
    "ts-any": 0.0,
    "hardcoded-secret-ts": 9.1,
    # XSS sinks added to LANG_VIOLATION_PATTERNS (R-P1-07)
    "xss-dangerously-set-inner-html-js": 6.1,
    "xss-jquery-html": 6.1,
    # Stubs and placeholders (blocked to enforce strict implementation)
    "placeholder-stub-text": 5.0,
    "stub-not-implemented": 5.0,
    "stub-bare-pass": 5.0,
    "stub-dummy-return": 5.0,
    # Weak cryptography (R-P2-02) — OWASP A02:2021 Cryptographic Failures
    "weak-hash-md5": 5.9,
    "weak-hash-sha1": 5.9,
    "weak-cipher-des": 7.5,
    # Injection patterns (R-P2-02) — OWASP A03:2021 Injection
    "ldap-injection": 8.8,
    "xpath-injection": 8.8,
    "template-injection": 9.8,
    # Security misconfiguration (R-P2-02) — OWASP A05:2021
    "cors-wildcard-credentials": 7.5,
    "jwt-no-verify": 9.1,
    "debug-mode-flask": 5.3,
    "debug-mode-django": 5.3,
}


def scan_file_violations(
    filepath: Path, exclude_patterns: list[str] | None = None
) -> list[dict]:
    """Scan a source file for production-code violations.

    Returns list of violation dicts with keys: line, violation_id, message, text.
    Returns [] if the file does not exist or cannot be read.

    Runs two passes:
    1. Line-by-line pass using PROD_VIOLATION_PATTERNS.
    2. Full-content multiline pass using MULTILINE_VIOLATION_PATTERNS (re.MULTILINE).
       Duplicate (line, violation_id) pairs from both passes are deduplicated.
    """
    if exclude_patterns is None:
        exclude_patterns = []

    try:
        content = filepath.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return []

    lines = content.splitlines()
    violations: list[dict] = []
    seen: set[tuple[int, str]] = set()

    # Pass 1: line-by-line patterns
    for line_num, line_text in enumerate(lines, start=1):
        if any(ep in line_text for ep in exclude_patterns):
            continue

        for pattern, violation_id, message, severity in PROD_VIOLATION_PATTERNS:
            if re.search(pattern, line_text):
                key = (line_num, violation_id)
                if key not in seen:
                    seen.add(key)
                    violations.append(
                        {
                            "line": line_num,
                            "violation_id": violation_id,
                            "message": message,
                            "severity": severity,
                            "text": line_text.rstrip()[:200],
                        }
                    )

    # Pass 2: multiline patterns applied to full content
    for pattern, violation_id, message, severity in MULTILINE_VIOLATION_PATTERNS:
        for m in re.finditer(pattern, content, re.MULTILINE | re.DOTALL):
            # Determine line number of match start
            line_num = content[: m.start()].count("\n") + 1
            line_text = lines[line_num - 1] if line_num <= len(lines) else ""
            if any(ep in line_text for ep in exclude_patterns):
                continue
            key = (line_num, violation_id)
            if key not in seen:
                seen.add(key)
                violations.append(
                    {
                        "line": line_num,
                        "violation_id": violation_id,
                        "message": message,
                        "severity": severity,
                        "text": line_text.rstrip()[:200],
                    }
                )

    violations.sort(key=lambda v: v["line"])
    return violations
