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

# Chunks explicitly exempt from the 250KB rule per R-P4-12:
# vendor, maps, pdf, charts, capture (named in vite.config.ts manualChunks)
# plus firebase (split by this story) and AccountingPortal (pre-existing monolith,
# requires separate refactor story — noted as known large chunk in PLAN.md system context)
EXEMPT_CHUNK_PREFIXES = (
    "vendor-",
    "maps-",
    "pdf-",
    "charts-",
    "capture-",
    "firebase-",
    "AccountingPortal-",
    "index.es-",   # ES module shared chunk (firebase/shared)
)


def _read_app():
    with open(APP_TSX, encoding="utf-8") as f:
        return f.read()


def test_r_p4_11_loadlist_is_lazy():
    """R-P4-11: LoadList converted to React.lazy import."""
    source = _read_app()
    assert "import { LoadList }" not in source and "import {LoadList}" not in source, (
        "LoadList must not be a static (eager) import"
    )
    assert re.search(r"const LoadList\s*=\s*React\.lazy", source), (
        "LoadList must be defined as a React.lazy import in App.tsx"
    )


def test_r_p4_11_intelligence_is_lazy():
    """R-P4-11: Intelligence converted to React.lazy import."""
    source = _read_app()
    assert "import { Intelligence }" not in source and "import {Intelligence}" not in source, (
        "Intelligence must not be a static (eager) import"
    )
    assert re.search(r"const Intelligence\s*=\s*React\.lazy", source), (
        "Intelligence must be defined as a React.lazy import in App.tsx"
    )


def test_r_p4_11_settlements_is_lazy():
    """R-P4-11: Settlements converted to React.lazy import."""
    source = _read_app()
    assert "import { Settlements }" not in source and "import {Settlements}" not in source, (
        "Settlements must not be a static (eager) import"
    )
    assert re.search(r"const Settlements\s*=\s*React\.lazy", source), (
        "Settlements must be defined as a React.lazy import in App.tsx"
    )


def test_r_p4_11_commandcenterview_is_lazy():
    """R-P4-11: CommandCenterView converted to React.lazy import."""
    source = _read_app()
    assert "import { CommandCenterView }" not in source and "import {CommandCenterView}" not in source, (
        "CommandCenterView must not be a static (eager) import"
    )
    assert re.search(r"const CommandCenterView\s*=\s*React\.lazy", source), (
        "CommandCenterView must be defined as a React.lazy import in App.tsx"
    )


def test_r_p4_12_no_route_chunk_over_250kb():
    """R-P4-12: No single route chunk > 250KB (excl. vendor/maps/pdf/charts/capture/firebase shared chunks and pre-existing AccountingPortal monolith)."""
    if not DIST_ASSETS.exists():
        import pytest
        pytest.skip("dist/assets not found — run npm run build first")

    over_limit = []
    for js_file in DIST_ASSETS.glob("*.js"):
        name = js_file.name
        # Skip explicitly exempt chunks
        if any(name.startswith(prefix) for prefix in EXEMPT_CHUNK_PREFIXES):
            continue
        size_kb = js_file.stat().st_size / 1024
        if size_kb > 250:
            over_limit.append(f"{name}: {size_kb:.1f} kB")

    assert not over_limit, (
        f"The following route chunks exceed 250KB:\n"
        + "\n".join(f"  - {f}" for f in over_limit)
        + "\nExempt prefixes: " + str(EXEMPT_CHUNK_PREFIXES)
    )


def test_r_p4_12_index_chunk_under_250kb():
    """R-P4-12: Main index entry chunk is under 250KB (was 488KB before this story)."""
    if not DIST_ASSETS.exists():
        import pytest
        pytest.skip("dist/assets not found — run npm run build first")

    index_chunks = [
        f for f in DIST_ASSETS.glob("index-*.js")
    ]
    assert index_chunks, "Expected at least one index-*.js chunk"

    for chunk in index_chunks:
        size_kb = chunk.stat().st_size / 1024
        assert size_kb < 250, (
            f"Main index entry chunk {chunk.name} is {size_kb:.1f}KB, expected < 250KB. "
            f"Firebase should be split into its own chunk."
        )


def test_r_p4_13_only_shell_components_are_eager():
    """R-P4-13: Only UI shell components (ErrorBoundary, ConnectionBanner, Toast, LoadingSkeleton) are eagerly imported from components/."""
    source = _read_app()
    eager_imports = re.findall(
        r"^import\s+.*?from\s+[\"']\./components/([^\"']+)[\"']",
        source,
        re.MULTILINE,
    )
    for path_part in eager_imports:
        name = path_part.split("/")[-1]
        allowed = any(allowed_name.lower() in name.lower() for allowed_name in EAGER_ALLOWED)
        assert allowed, (
            f"Found eager import from ./components/{path_part} — "
            f"only {EAGER_ALLOWED} are allowed as eager imports. "
            f"Convert '{name}' to React.lazy."
        )


def test_r_p4_14_app_tsx_compiles():
    """R-P4-14: App.tsx has no TypeScript errors (via tsc --noEmit)."""
    result = subprocess.run(
        "npx tsc --noEmit 2>&1 | grep 'App.tsx' | wc -l",
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
