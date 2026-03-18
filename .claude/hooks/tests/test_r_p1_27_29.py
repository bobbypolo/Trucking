# Tests R-P1-27, R-P1-28, R-P1-29
"""
QA traceability markers for STORY-107: Migrate incidents localStorage to API-only.

R-P1-27: No localStorage+STORAGE_KEY_INCIDENTS pattern in services/storageService.ts
R-P1-28: getIncidents is async and fetches from /api/incidents exclusively
R-P1-29: seedIncidents function body remains empty (no-op kept for backward compat)
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
STORAGE_SERVICE_TS = REPO / "services" / "storageService.ts"


def test_r_p1_27_no_localstorage_storage_key_incidents():
    """R-P1-27: grep for localStorage.*STORAGE_KEY_INCIDENTS|STORAGE_KEY_INCIDENTS.*localStorage returns 0 matches"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    pattern = re.compile(
        r"localStorage.*STORAGE_KEY_INCIDENTS|STORAGE_KEY_INCIDENTS.*localStorage"
    )
    matches = [
        line.strip()
        for line in content.splitlines()
        if pattern.search(line)
    ]
    assert matches == [], (
        f"R-P1-27 FAIL: found localStorage+STORAGE_KEY_INCIDENTS in storageService.ts:\n"
        + "\n".join(matches)
    )


def test_r_p1_27_storage_key_incidents_removed():
    """R-P1-27: STORAGE_KEY_INCIDENTS constant definition is gone"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "STORAGE_KEY_INCIDENTS =" not in content, (
        "R-P1-27 FAIL: STORAGE_KEY_INCIDENTS constant still defined in storageService.ts"
    )


def test_r_p1_27_get_raw_incidents_removed():
    """R-P1-27: getRawIncidents helper function is gone"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "getRawIncidents" not in content, (
        "R-P1-27 FAIL: getRawIncidents still present in storageService.ts"
    )


def test_r_p1_28_get_incidents_is_async():
    """R-P1-28: getIncidents is declared as async"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert re.search(
        r"export\s+const\s+getIncidents\s*=\s*async", content
    ), "R-P1-28 FAIL: getIncidents is not declared as async in storageService.ts"


def test_r_p1_28_get_incidents_fetches_api_incidents():
    """R-P1-28: getIncidents fetches from /api/incidents (or ${API_URL}/incidents)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert re.search(
        r"fetch\s*\(\s*[`'\"].*[/]incidents[`'\"]|\$\{API_URL\}/incidents", content
    ), "R-P1-28 FAIL: getIncidents does not contain a fetch to /api/incidents"


def test_r_p1_28_no_localstorage_in_get_incidents():
    """R-P1-28: getIncidents body has no localStorage calls"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Extract getIncidents function body
    match = re.search(
        r"export\s+const\s+getIncidents\s*=\s*async[^;]*?\{(.*?)\n\};",
        content,
        re.DOTALL,
    )
    if match:
        fn_body = match.group(1)
        assert "localStorage" not in fn_body, (
            "R-P1-28 FAIL: getIncidents still contains localStorage calls"
        )
    # If we can't extract body, check the whole file for the pattern
    else:
        # Verify no localStorage.getItem/setItem near incidents
        localstorage_incident_lines = [
            line for line in content.splitlines()
            if "localStorage" in line and "incident" in line.lower()
        ]
        assert localstorage_incident_lines == [], (
            "R-P1-28 FAIL: found localStorage+incident references:\n"
            + "\n".join(localstorage_incident_lines)
        )


def test_r_p1_29_seed_incidents_is_noop():
    """R-P1-29: seedIncidents function body is empty (no-op)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Must still be exported
    assert "export const seedIncidents" in content, (
        "R-P1-29 FAIL: seedIncidents is no longer exported from storageService.ts"
    )
    # Body must be empty: => {};
    assert re.search(
        r"export\s+const\s+seedIncidents\s*=\s*async\s*\([^)]*\)\s*:\s*Promise<void>\s*=>\s*\{\s*\}",
        content,
    ), "R-P1-29 FAIL: seedIncidents body is not empty (no-op)"


def test_r_p1_29_seed_incidents_no_localstorage():
    """R-P1-29: seedIncidents does not write to localStorage"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Find seedIncidents and check nothing follows before next export
    match = re.search(
        r"export\s+const\s+seedIncidents[^;]+;",
        content,
        re.DOTALL,
    )
    if match:
        fn_text = match.group(0)
        assert "localStorage" not in fn_text, (
            "R-P1-29 FAIL: seedIncidents contains localStorage calls"
        )
