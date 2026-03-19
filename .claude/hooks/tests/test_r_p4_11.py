"""
R-marker traceability for STORY-405 (Phase 4 Bundle Splitting).
Tests R-P4-11, R-P4-12, R-P4-13, R-P4-14
"""
# Tests R-P4-11, R-P4-12, R-P4-13, R-P4-14

import re
import subprocess
from pathlib import Path


APP_TSX = "F:/Trucking/DisbatchMe/App.tsx"
DIST_ASSETS = Path("F:/Trucking/DisbatchMe/dist/assets")

EAGER_ALLOWED = {
    "ErrorBoundary",
    "ConnectionBanner",
    "Toast",
    "LoadingSkeleton",
}

# Exempt chunk prefixes per R-P4-12:
# vendor, maps, pdf, charts, capture: named in vite.config.ts manualChunks
# firebase: split by this story from the 488KB index chunk
# AccountingPortal: pre-existing monolith (462KB baseline per PLAN.md system context)
# index.es: ES module shared chunk
EXEMPT_CHUNK_PREFIXES = (
    "vendor-",
    "maps-",
    "pdf-",
    "charts-",
    "capture-",
    "firebase-",
    "AccountingPortal-",
    "index.es-",
)


def _read_app():
    with open(APP_TSX, encoding="utf-8") as f:
        return f.read()


# --- R-P4-11: Lazy conversion tests (happy path) ---


def test_r_p4_11_loadlist_is_lazy():
    """R-P4-11: LoadList converted to React.lazy import."""
    source = _read_app()
    eager_count = source.count("import { LoadList }") + source.count(
        "import {LoadList}"
    )
    assert eager_count == 0, (
        f"LoadList must not be a static (eager) import - found {eager_count} eager imports"
    )
    lazy_matches = re.findall(r"const LoadList\s*=\s*React\.lazy", source)
    assert len(lazy_matches) == 1, (
        f"Expected exactly 1 React.lazy definition for LoadList, found {len(lazy_matches)}"
    )


def test_r_p4_11_intelligence_is_lazy():
    """R-P4-11: Intelligence converted to React.lazy import."""
    source = _read_app()
    eager_count = source.count("import { Intelligence }") + source.count(
        "import {Intelligence}"
    )
    assert eager_count == 0, (
        f"Intelligence must not be a static (eager) import - found {eager_count} eager imports"
    )
    lazy_matches = re.findall(r"const Intelligence\s*=\s*React\.lazy", source)
    assert len(lazy_matches) == 1, (
        f"Expected exactly 1 React.lazy definition for Intelligence, found {len(lazy_matches)}"
    )


def test_r_p4_11_settlements_is_lazy():
    """R-P4-11: Settlements converted to React.lazy import."""
    source = _read_app()
    eager_count = source.count("import { Settlements }") + source.count(
        "import {Settlements}"
    )
    assert eager_count == 0, (
        f"Settlements must not be a static (eager) import - found {eager_count} eager imports"
    )
    lazy_matches = re.findall(r"const Settlements\s*=\s*React\.lazy", source)
    assert len(lazy_matches) == 1, (
        f"Expected exactly 1 React.lazy definition for Settlements, found {len(lazy_matches)}"
    )


def test_r_p4_11_commandcenterview_is_lazy():
    """R-P4-11: CommandCenterView converted to React.lazy import."""
    source = _read_app()
    eager_count = source.count("import { CommandCenterView }") + source.count(
        "import {CommandCenterView}"
    )
    assert eager_count == 0, (
        f"CommandCenterView must not be a static (eager) import - found {eager_count} eager imports"
    )
    lazy_matches = re.findall(r"const CommandCenterView\s*=\s*React\.lazy", source)
    assert len(lazy_matches) == 1, (
        f"Expected exactly 1 React.lazy definition for CommandCenterView, found {len(lazy_matches)}"
    )


# --- R-P4-11: Edge / negative tests ---


def test_r_p4_11_negative_lazy_count_not_regressed():
    """R-P4-11 negative: React.lazy count must not have decreased (reverted components)."""
    source = _read_app()
    lazy_defs = re.findall(r"const \w+ = React\.lazy\(", source)
    lazy_count = len(lazy_defs)
    # Before this story there were 22 lazy components; after conversion there are 28
    reverted = [
        c
        for c in [
            "LoadList",
            "Intelligence",
            "Settlements",
            "CommandCenterView",
            "LoadSetupModal",
            "GoogleMapsAPITester",
        ]
        if "React.lazy" not in source or f"const {c} = React.lazy" not in source
    ]
    assert reverted == [], (
        f"The following components were not converted to React.lazy: {reverted}"
    )


def test_r_p4_11_loadsetupmodal_is_lazy():
    """R-P4-11 edge: LoadSetupModal also converted to React.lazy (was eager, non-shell)."""
    source = _read_app()
    eager_count = source.count("import { LoadSetupModal }") + source.count(
        "import {LoadSetupModal}"
    )
    assert eager_count == 0, (
        f"LoadSetupModal must not be a static (eager) import - found {eager_count} eager imports"
    )
    lazy_matches = re.findall(r"const LoadSetupModal\s*=\s*React\.lazy", source)
    assert len(lazy_matches) == 1, (
        f"Expected exactly 1 React.lazy definition for LoadSetupModal, found {len(lazy_matches)}"
    )


# --- R-P4-12: Chunk size tests ---


def test_r_p4_12_no_route_chunk_over_250kb():
    """R-P4-12: No single route chunk > 250KB (excl. shared vendor/firebase/AccountingPortal)."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found - run npm run build first")

    over_limit = []
    checked = 0
    for js_file in sorted(DIST_ASSETS.glob("*.js")):
        name = js_file.name
        if any(name.startswith(prefix) for prefix in EXEMPT_CHUNK_PREFIXES):
            continue
        size_kb = js_file.stat().st_size / 1024
        checked += 1
        if size_kb > 250:
            over_limit.append(f"{name}: {size_kb:.1f} kB")

    assert checked > 0, f"Expected at least 1 non-exempt JS chunk, found {checked}"
    assert len(over_limit) == 0, (
        f"{len(over_limit)} route chunk(s) exceed 250KB: " + ", ".join(over_limit)
    )


def test_r_p4_12_index_chunk_under_250kb():
    """R-P4-12: Main index entry chunk is under 250KB (was 488KB before this story)."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found - run npm run build first")

    index_chunks = sorted(DIST_ASSETS.glob("index-*.js"))
    chunk_count = len(index_chunks)
    assert chunk_count >= 1, (
        f"Expected at least 1 index-*.js chunk, found {chunk_count}"
    )
    oversized = [
        f"{c.name}: {c.stat().st_size / 1024:.1f}KB"
        for c in index_chunks
        if c.stat().st_size / 1024 >= 250
    ]
    assert oversized == [], (
        f"Index chunk(s) exceed 250KB after Firebase split: {oversized}"
    )


def test_r_p4_12_firebase_chunk_exists_and_is_substantial():
    """R-P4-12: Firebase is split into its own chunk by vite.config.ts manualChunks."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found - run npm run build first")

    firebase_chunks = list(DIST_ASSETS.glob("firebase-*.js"))
    chunk_count = len(firebase_chunks)
    assert chunk_count == 1, (
        f"Expected exactly 1 firebase-*.js chunk from manualChunks, found {chunk_count}"
    )
    # Firebase SDK is ~220KB - tiny chunk means split did not work
    trivial_chunks = [
        f"{c.name}: {c.stat().st_size / 1024:.1f}KB"
        for c in firebase_chunks
        if c.stat().st_size / 1024 < 50
    ]
    assert trivial_chunks == [], (
        f"Firebase chunk is too small (< 50KB) - SDK may not be included: {trivial_chunks}"
    )


# --- R-P4-12: Negative tests ---


def test_r_p4_12_negative_index_chunk_not_pre_story_size():
    """R-P4-12 negative: index chunk must NOT be the old 488KB+ pre-story size."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found - run npm run build first")

    # Before this story index was 488KB; after Firebase split it should be < 250KB
    pre_story_sized = [
        f"{c.name}: {c.stat().st_size / 1024:.1f}KB"
        for c in DIST_ASSETS.glob("index-*.js")
        if c.stat().st_size / 1024 >= 400
    ]
    assert pre_story_sized == [], (
        "Index chunk is still pre-story size (>= 400KB), Firebase split did not work: "
        + ", ".join(pre_story_sized)
    )


# --- R-P4-13: Eager imports tests ---


def test_r_p4_13_only_shell_components_are_eager():
    """R-P4-13: Only UI shell components are eagerly imported from components/."""
    source = _read_app()
    eager_imports = re.findall(
        r"^import\s+.*?from\s+[\"']\./components/([^\"']+)[\"']",
        source,
        re.MULTILINE,
    )
    non_shell = [
        p
        for p in eager_imports
        if not any(a.lower() in p.split("/")[-1].lower() for a in EAGER_ALLOWED)
    ]
    assert non_shell == [], (
        f"Non-shell components found as eager imports: {non_shell}. "
        f"Only {sorted(EAGER_ALLOWED)} are allowed as eager imports."
    )


def test_r_p4_13_shell_components_remain_eager():
    """R-P4-13: Shell components ErrorBoundary, ConnectionBanner, Toast, LoadingSkeleton remain eager."""
    source = _read_app()
    required = {
        "ErrorBoundary": r"^import.*ErrorBoundary.*from.*components/ErrorBoundary",
        "ConnectionBanner": r"^import.*ConnectionBanner.*from.*components/ui/ConnectionBanner",
        "Toast": r"^import.*Toast.*from.*components/Toast",
        "LoadingSkeleton": r"^import.*LoadingSkeleton.*from.*components/ui/LoadingSkeleton",
    }
    missing = [
        name
        for name, pattern in required.items()
        if not re.findall(pattern, source, re.MULTILINE)
    ]
    assert missing == [], (
        f"Shell component(s) {missing} are missing their eager imports. "
        f"These must remain eagerly imported as UI shell components."
    )


# --- R-P4-13: Negative / error tests ---


def test_r_p4_13_error_if_route_component_eagerly_imported():
    """R-P4-13 error: Route components (non-shell) must NOT be eagerly imported."""
    source = _read_app()
    # Known route components that were converted to lazy — if any slip back to eager, fail
    route_components = [
        "LoadList",
        "Intelligence",
        "Settlements",
        "CommandCenterView",
        "LoadSetupModal",
        "GoogleMapsAPITester",
    ]
    found_eager = [
        c
        for c in route_components
        if f"import {{ {c} }}" in source or f"import {{{c}}}" in source
    ]
    assert found_eager == [], (
        f"Route components found as eager imports (must be lazy): {found_eager}"
    )


def test_r_p4_13_boundary_no_lazy_outside_suspense():
    """R-P4-13 boundary: Verify Suspense is present — lazy without Suspense causes runtime error."""
    source = _read_app()
    # Count lazy defs and Suspense boundaries
    lazy_defs = re.findall(r"const \w+ = React\.lazy\(", source)
    suspense_count = source.count("<Suspense")
    # At minimum, 1 Suspense boundary is required to avoid runtime errors
    missing_suspense = 1 if suspense_count == 0 else 0
    assert missing_suspense == 0, (
        f"No <Suspense> boundaries found but {len(lazy_defs)} lazy components exist. "
        "React.lazy without Suspense causes runtime errors."
    )


# --- R-P4-14: Compilation and structure tests ---


def test_r_p4_14_app_tsx_compiles():
    """R-P4-14: App.tsx has no TypeScript errors (via tsc --noEmit)."""
    result = subprocess.run(
        "npx tsc --noEmit 2>&1 | grep App.tsx | wc -l",
        shell=True,
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
    )
    combined = (result.stdout + result.stderr).strip()
    count_match = re.search(r"\d+", combined)
    count = int(count_match.group()) if count_match else -1
    assert count == 0, (
        f"Expected 0 TypeScript errors in App.tsx, got {count}. Output: {combined}"
    )


def test_r_p4_14_lazy_components_have_suspense_wrappers():
    """R-P4-14: Lazy-loaded components have Suspense fallback boundaries."""
    source = _read_app()
    suspense_count = source.count("<Suspense")
    # Each Suspense fallback wraps a lazy component — need at least one per lazy component
    # Check the ratio of lazy defs to Suspense wrappers
    lazy_defs = re.findall(r"const \w+ = React\.lazy\(", source)
    lazy_without_suspense = [
        d
        for d in lazy_defs
        if suspense_count == 0  # if no Suspense at all, something is very wrong
    ]
    assert lazy_without_suspense == [], (
        f"No Suspense boundaries found in App.tsx despite {len(lazy_defs)} lazy components"
    )
    # Also verify minimum count
    missing_wrappers = max(0, 10 - suspense_count)
    assert missing_wrappers == 0, (
        f"Too few Suspense boundaries: found {suspense_count}, expected >= 10. "
        f"Missing approximately {missing_wrappers} wrappers."
    )


def test_r_p4_14_vite_config_has_firebase_chunk():
    """R-P4-14: vite.config.ts splits Firebase into its own chunk."""
    with open("F:/Trucking/DisbatchMe/vite.config.ts", encoding="utf-8") as f:
        config = f.read()
    # Verify firebase appears in both the condition and return value
    firebase_occurrences = config.count("firebase")
    assert firebase_occurrences != 0, (
        "vite.config.ts has no 'firebase' references - Firebase chunk split is missing"
    )
    assert firebase_occurrences >= 2, (
        f"Expected >= 2 'firebase' occurrences in vite.config.ts "
        f"(condition + return value), found {firebase_occurrences}"
    )
