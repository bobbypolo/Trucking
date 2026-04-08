"""SCA (Software Composition Analysis) JSON output parsers.

Each parser accepts raw JSON stdout from a scanner and returns a list of
tool-native finding dicts. Severity values are left in their native dialect;
call normalize_severity() to map to internal buckets.

Exports:
    parse_pip_audit_json(raw: str) -> list[dict]
    parse_npm_audit_json(raw: str) -> list[dict]
    parse_bandit_json(raw: str) -> list[dict]
    normalize_severity(tool: str, native_severity: str) -> str
"""

from __future__ import annotations

import json

# ---------------------------------------------------------------------------
# Severity normalization
# ---------------------------------------------------------------------------

# Mapping: tool -> {native_severity_lower -> normalized}
_SEVERITY_MAPS: dict[str, dict[str, str]] = {
    "pip-audit": {
        # pip-audit does not emit a severity field; all findings are high by convention
        # (any known CVE is treated as at-least-high)
        "critical": "critical",
        "high": "high",
        "medium": "medium",
        "low": "low",
        "unknown": "unknown",
        # Fallback key for when caller passes empty/missing severity
        "": "high",
    },
    "npm-audit": {
        "info": "low",
        "low": "low",
        "moderate": "medium",
        "high": "high",
        "critical": "critical",
    },
    "bandit": {
        "low": "low",
        "medium": "medium",
        "high": "high",
    },
    "semgrep": {
        "info": "low",
        "warning": "medium",
        "error": "high",
    },
}

_SEVERITY_ORDER: dict[str, int] = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
    "unknown": 0,
}


def normalize_severity(tool: str, native_severity: str) -> str:
    """Map a scanner's native severity string to an internal bucket.

    Args:
        tool: Scanner name, e.g. "pip-audit", "npm-audit", "bandit", "semgrep".
        native_severity: Severity string as emitted by the scanner.

    Returns:
        One of: "critical", "high", "medium", "low", "unknown".
        Returns "unknown" for any unrecognized tool or severity value.
    """
    tool_map = _SEVERITY_MAPS.get(tool.lower(), {})
    if not tool_map:
        return "unknown"
    normalized = tool_map.get(native_severity.lower() if native_severity else "", None)
    return normalized if normalized is not None else "unknown"


def severity_at_least(normalized: str, threshold: str) -> bool:
    """Return True if normalized severity >= threshold.

    Both arguments must be values from normalize_severity().
    Unknown severity is below all named thresholds.
    """
    return _SEVERITY_ORDER.get(normalized, 0) >= _SEVERITY_ORDER.get(threshold, 0)


# ---------------------------------------------------------------------------
# pip-audit parser
# ---------------------------------------------------------------------------


def parse_pip_audit_json(raw: str) -> list[dict]:
    """Parse JSON output from ``pip-audit --format=json``.

    pip-audit JSON schema (v2):
        {"dependencies": [{"name": str, "version": str, "vulns": [{"id": str,
        "aliases": [str], "fix_versions": [str], "description": str}]}]}

    Returns:
        List of dicts with keys:
            package      – package name (str)
            version      – installed version (str)
            vuln_id      – primary vulnerability ID (str)
            aliases      – list of alias IDs, e.g. CVE numbers (list[str])
            fix_versions – list of versions that fix the issue (list[str])
        Returns [] on any parse error or malformed input.
        CVSS fields are NOT fabricated; they are absent from output.
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return []

    if not isinstance(data, dict):
        return []

    findings: list[dict] = []
    dependencies = data.get("dependencies", [])
    if not isinstance(dependencies, list):
        return []

    for dep in dependencies:
        if not isinstance(dep, dict):
            continue
        name = dep.get("name", "")
        version = dep.get("version", "")
        vulns = dep.get("vulns", [])
        if not isinstance(vulns, list):
            continue
        for vuln in vulns:
            if not isinstance(vuln, dict):
                continue
            finding = {
                "package": str(name),
                "version": str(version),
                "vuln_id": str(vuln.get("id", "")),
                "aliases": list(vuln.get("aliases", [])),
                "fix_versions": list(vuln.get("fix_versions", [])),
            }
            findings.append(finding)

    return findings


# ---------------------------------------------------------------------------
# npm-audit parser
# ---------------------------------------------------------------------------


def parse_npm_audit_json(raw: str) -> list[dict]:
    """Parse JSON output from ``npm audit --json``.

    npm audit JSON schema:
        {"vulnerabilities": {"<pkg>": {"name": str, "severity": str,
         "via": [...], "range": str, "nodes": [...], "fixAvailable": bool|dict}}}

    Severity is npm-native: "info" | "low" | "moderate" | "high" | "critical"

    Returns:
        List of dicts with keys:
            package       – package name (str)
            severity      – npm-native severity string
            via           – vulnerability source list (list)
            url           – advisory URL (str, first from via if available)
            title         – advisory title (str, first from via if available)
            fix_available – whether a fix is available (bool)
        Returns [] on any parse error or malformed input.
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return []

    if not isinstance(data, dict):
        return []

    findings: list[dict] = []
    vulnerabilities = data.get("vulnerabilities", {})
    if not isinstance(vulnerabilities, dict):
        return []

    for pkg_name, vuln_info in vulnerabilities.items():
        if not isinstance(vuln_info, dict):
            continue

        severity = str(vuln_info.get("severity", ""))
        via = vuln_info.get("via", [])
        if not isinstance(via, list):
            via = []

        # Extract url + title from first advisory entry in "via" (if present)
        url = ""
        title = ""
        for via_entry in via:
            if isinstance(via_entry, dict):
                url = str(via_entry.get("url", ""))
                title = str(via_entry.get("title", ""))
                break

        fix_available_raw = vuln_info.get("fixAvailable", False)
        # fixAvailable can be bool or dict (when a breaking fix is available)
        fix_available = bool(fix_available_raw)

        finding = {
            "package": str(pkg_name),
            "severity": severity,
            "via": via,
            "url": url,
            "title": title,
            "fix_available": fix_available,
        }
        findings.append(finding)

    return findings


# ---------------------------------------------------------------------------
# bandit parser
# ---------------------------------------------------------------------------


def parse_bandit_json(raw: str) -> list[dict]:
    """Parse JSON output from ``bandit -f json``.

    bandit JSON schema:
        {"results": [{"filename": str, "line_number": int, "issue_cwe": {"id": int},
         "issue_severity": str, "issue_confidence": str, "issue_text": str}]}

    Severity is bandit-native: "LOW" | "MEDIUM" | "HIGH"

    Returns:
        List of dicts with keys:
            filename   – source file path (str)
            line       – line number (int)
            cwe        – CWE identifier string, e.g. "CWE-78" (str)
            severity   – bandit-native severity ("LOW"/"MEDIUM"/"HIGH")
            confidence – bandit-native confidence ("LOW"/"MEDIUM"/"HIGH")
            issue_text – human-readable issue description (str)
        Returns [] on any parse error or malformed input.
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return []

    if not isinstance(data, dict):
        return []

    findings: list[dict] = []
    results = data.get("results", [])
    if not isinstance(results, list):
        return []

    for result in results:
        if not isinstance(result, dict):
            continue

        # CWE extraction: bandit may use "issue_cwe" (dict) or "cwe" (str/dict)
        cwe_raw = result.get("issue_cwe", result.get("cwe", {}))
        if isinstance(cwe_raw, dict):
            cwe_id = cwe_raw.get("id", "")
            cwe = f"CWE-{cwe_id}" if cwe_id else ""
        elif isinstance(cwe_raw, str):
            cwe = cwe_raw
        else:
            cwe = ""

        finding = {
            "filename": str(result.get("filename", "")),
            "line": int(result.get("line_number") or result.get("line") or 0),
            "cwe": cwe,
            "severity": str(result.get("issue_severity", result.get("severity", ""))),
            "confidence": str(
                result.get("issue_confidence", result.get("confidence", ""))
            ),
            "issue_text": str(result.get("issue_text", "")),
        }
        findings.append(finding)

    return findings
