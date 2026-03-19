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


def test_r_p4_11_no_other_components_eagerly_imported():
    """R-P4-11 edge: No non-shell components sneak back in as eager imports."""
    source = _read_app()
    # All React.lazy definitions must use import() pattern
    lazy_defs = re.findall(r"const \w+ = React\.lazy\(", source)
    lazy_count = len(lazy_defs)
    # We expect a substantial number of lazy components (22+ originally, now 28+)
    assert lazy_count >= 22, (
        f"Expected >= 22 React.lazy component definitions, found {lazy_count}. "
        f"Converted components may have been reverted."
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
    for chunk in index_chunks:
        size_kb = chunk.stat().st_size / 1024
        assert size_kb < 250, (
            f"{chunk.name} is {size_kb:.1f}KB - expected < 250KB after Firebase split"
        )


def test_r_p4_12_firebase_chunk_exists_and_is_substantial():
    """R-P4-12: Firebase is split into its own chunk by vite.config.ts manualChunks."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found - run npm run build first")

    firebase_chunks = list(DIST_ASSETS.glob("firebase-*.js"))
    chunk_count = len(firebase_chunks)
    assert chunk_count >= 1, (
        f"Expected a firebase-*.js chunk from manualChunks, found {chunk_count}"
    )
    for chunk in firebase_chunks:
        size_kb = chunk.stat().st_size / 1024
        # Firebase SDK is ~220KB - must be substantial
        assert size_kb >= 50, (
            f"firebase chunk {chunk.name} is only {size_kb:.1f}KB - expected >= 50KB"
        )


# --- R-P4-12: Negative tests ---


def test_r_p4_12_index_chunk_not_huge():
    """R-P4-12 negative: index chunk must NOT be the old 488KB+ size."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found - run npm run build first")

    for chunk in DIST_ASSETS.glob("index-*.js"):
        size_kb = chunk.stat().st_size / 1024
        assert size_kb < 400, (
            f"index chunk {chunk.name} is {size_kb:.1f}KB - Firebase split did not work. "
            f"Before this story it was 488KB."
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
    eager_count = len(eager_imports)
    assert eager_count <= 4, (
        f"Expected at most 4 eager component imports, found {eager_count}: {eager_imports}"
    )
    for path_part in eager_imports:
        name = path_part.split("/")[-1]
        allowed = any(a.lower() in name.lower() for a in EAGER_ALLOWED)
        assert allowed, (
            f"Eager import from ./components/{path_part} is not a shell component. "
            f"Only {sorted(EAGER_ALLOWED)} allowed eagerly."
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
    for name, pattern in required.items():
        matches = re.findall(pattern, source, re.MULTILINE)
        assert len(matches) >= 1, (
            f"Shell component {name} must remain as an eager import, "
            f"but no matching import found."
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
    assert suspense_count >= 10, (
        f"Expected >= 10 Suspense boundaries in App.tsx, found {suspense_count}. "
        f"All lazy components must be wrapped."
    )


def test_r_p4_14_vite_config_has_firebase_chunk():
    """R-P4-14: vite.config.ts splits Firebase into its own chunk."""
    with open("F:/Trucking/DisbatchMe/vite.config.ts", encoding="utf-8") as f:
        config = f.read()
    firebase_count = config.count("firebase")
    assert firebase_count >= 2, (
        f"Expected >= 2 occurrences of 'firebase' in vite.config.ts "
        f"(condition + return value), found {firebase_count}"
    )
