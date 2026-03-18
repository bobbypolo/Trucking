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


def test_r_p1_27_no_localstorage_in_any_incident_fn():
    """R-P1-27: No localStorage call in any incident-related function body"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Check no localStorage set/get near incident functions
    localstorage_lines = [
        (i + 1, line.strip())
        for i, line in enumerate(content.splitlines())
        if "localStorage" in line and "incidents" in line.lower()
    ]
    assert localstorage_lines == [], (
        "R-P1-27 FAIL: found localStorage calls with 'incident' context:\n"
        + "\n".join(f"Line {ln}: {txt}" for ln, txt in localstorage_lines)
    )


def test_r_p1_28_get_incidents_is_async():
    """R-P1-28: getIncidents is declared as async (behavioral: checks signature)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Value assertion: find the line number where async getIncidents is declared
    async_declaration_lines = [
        (i + 1, line.strip())
        for i, line in enumerate(content.splitlines())
        if re.search(r"export\s+const\s+getIncidents\s*=\s*async", line)
    ]
    assert len(async_declaration_lines) == 1, (
        f"R-P1-28 FAIL: expected exactly 1 async getIncidents declaration, "
        f"found {len(async_declaration_lines)}: {async_declaration_lines}"
    )
    line_num, declaration = async_declaration_lines[0]
    assert "async" in declaration, f"R-P1-28 FAIL: line {line_num} missing 'async': {declaration}"


def test_r_p1_28_get_incidents_returns_promise_array():
    """R-P1-28: getIncidents return type is Promise<Incident[]> (behavioral: type signature)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Value assertion: verify the exact return type annotation
    return_type_lines = [
        (i + 1, line.strip())
        for i, line in enumerate(content.splitlines())
        if re.search(r"getIncidents.*Promise<Incident\[\]>", line)
    ]
    assert len(return_type_lines) >= 1, (
        "R-P1-28 FAIL: getIncidents does not declare return type Promise<Incident[]>"
    )
    _line_num, type_decl = return_type_lines[0]
    assert "Promise<Incident[]>" in type_decl, (
        f"R-P1-28 FAIL: return type mismatch, found: {type_decl}"
    )


def test_r_p1_28_get_incidents_fetches_api_incidents():
    """R-P1-28: getIncidents fetches from /api/incidents path (behavioral: checks API call)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Must contain a fetch call with /incidents path
    assert re.search(
        r"fetch\s*\(`?\$\{API_URL\}/incidents`?", content
    ), "R-P1-28 FAIL: getIncidents does not fetch from /api/incidents"


def test_r_p1_28_get_incidents_returns_empty_on_failure():
    """R-P1-28: getIncidents returns empty array on API failure (behavioral: error path)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Extract getIncidents function body
    match = re.search(
        r"export\s+const\s+getIncidents\s*=\s*async[^;]*?\{(.*?)\n\};",
        content,
        re.DOTALL,
    )
    assert match is not None, "R-P1-28 FAIL: Could not locate getIncidents function"
    fn_body = match.group(1)
    # Must return [] as the final fallback (not localStorage data)
    assert "return [];" in fn_body, (
        "R-P1-28 FAIL: getIncidents does not return [] as fallback on API failure"
    )
    # Must not call localStorage
    assert "localStorage" not in fn_body, (
        "R-P1-28 FAIL: getIncidents still contains localStorage calls"
    )


def test_r_p1_28_get_incidents_no_localstorage_fallback_after_failure():
    """R-P1-28: getIncidents fallback after API error is [] not localStorage (edge case)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # The catch block must not reference localStorage
    catch_match = re.search(
        r"export\s+const\s+getIncidents[^}]+catch\s*\([^)]+\)\s*\{([^}]+)\}",
        content,
        re.DOTALL,
    )
    if catch_match:
        catch_body = catch_match.group(1)
        assert "localStorage" not in catch_body, (
            "R-P1-28 FAIL: getIncidents catch block calls localStorage"
        )


def test_r_p1_29_seed_incidents_is_noop():
    """R-P1-29: seedIncidents function body is empty (behavioral: no side effects)"""
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
    """R-P1-29: seedIncidents does not write to localStorage (error path: must remain no-op)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Find seedIncidents declaration text
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
        assert "fetch" not in fn_text, (
            "R-P1-29 FAIL: seedIncidents makes fetch calls (should be no-op)"
        )


def test_r_p1_29_seed_incidents_no_fetch():
    """R-P1-29: seedIncidents makes no API calls (error edge: backward compat preserved)"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    # Find the exact seedIncidents line — must be a one-liner no-op
    lines = content.splitlines()
    for line in lines:
        if "export const seedIncidents" in line:
            assert "=> {}" in line or "=> { }" in line, (
                f"R-P1-29 FAIL: seedIncidents is not a one-liner no-op: {line.strip()}"
            )
            break
    else:
        assert False, "R-P1-29 FAIL: seedIncidents not found in storageService.ts"
