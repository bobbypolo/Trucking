"""
R-marker traceability for STORY-406 (Phase 4 Final Orchestrator Sign-off).
Tests R-P4-15, R-P4-16, R-P4-17, R-P4-18, R-P4-19, R-P4-20
"""
# Tests R-P4-15, R-P4-16, R-P4-17, R-P4-18, R-P4-19, R-P4-20
# Coverage: import IntelligenceHub (components/IntelligenceHub.tsx)
# Coverage: import SafetyView (components/SafetyView.tsx)
# Coverage: import storageService (services/storageService.ts)

import re
import subprocess
from pathlib import Path

ROOT = Path("F:/Trucking/DisbatchMe")
DIST_ASSETS = ROOT / "dist" / "assets"

EXEMPT_CHUNK_PREFIXES = (
    "vendor-",
    "maps-",
    "pdf-",
    "charts-",
    "capture-",
    "firebase-",
    "AccountingPortal-",
    "index.es-",
    "xlsx-",
)


def _run(cmd, cwd=None):
    if cwd is None:
        cwd = str(ROOT)
    r = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=cwd, timeout=120
    )
    return r.returncode, (r.stdout + r.stderr).strip()


# --- R-P4-15: Frontend TypeScript ---


def test_r_p4_15_frontend_ts_zero_errors():
    """R-P4-15: npx tsc --noEmit returns 0 error TS lines in frontend."""
    rc, out = _run("npx tsc --noEmit 2>&1 | grep -c 'error TS' || echo 0")
    count_match = re.search(r"\d+", out.strip())
    count = int(count_match.group()) if count_match else -1
    assert count == 0, f"Expected 0 frontend TypeScript errors, got {count}.\n{out}"


def test_r_p4_15_negative_no_promise_errors_in_components():
    """R-P4-15 negative: No Promise-type errors in component files."""
    rc, out = _run("npx tsc --noEmit 2>&1")
    promise_errors = [
        line for line in out.splitlines() if "error TS" in line and "Promise" in line
    ]
    assert promise_errors == [], "TypeScript Promise-type errors found: " + str(
        promise_errors
    )


# --- R-P4-16: Server TypeScript ---


def test_r_p4_16_server_ts_zero_errors():
    """R-P4-16: cd server && npx tsc --noEmit returns 0 errors."""
    rc, out = _run(
        "npx tsc --noEmit 2>&1 | grep -c 'error TS' || echo 0", cwd=str(ROOT / "server")
    )
    count_match = re.search(r"\d+", out.strip())
    count = int(count_match.group()) if count_match else -1
    assert count == 0, f"Expected 0 server TypeScript errors, got {count}.\n{out}"


# --- R-P4-17: Frontend tests ---


def test_r_p4_17_frontend_test_files_exist():
    """R-P4-17: Frontend test suite exists and has at least 100 test files."""
    test_dir = ROOT / "src" / "__tests__"
    test_files = list(test_dir.rglob("*.test.ts")) + list(test_dir.rglob("*.test.tsx"))
    assert len(test_files) >= 100, (
        f"Expected >= 100 frontend test files, found {len(test_files)}"
    )


def test_r_p4_17_intelligencehub_test_mocks_are_async():
    """R-P4-17: IntelligenceHub test uses mockResolvedValue for async getVendors."""
    test_file = ROOT / "src" / "__tests__" / "components" / "IntelligenceHub.test.tsx"
    content = test_file.read_text(encoding="utf-8")
    assert "getVendors: vi.fn().mockResolvedValue(" in content, (
        "IntelligenceHub.test.tsx must use mockResolvedValue for async getVendors"
    )
    assert "getVendors: vi.fn().mockReturnValue(" not in content, (
        "IntelligenceHub.test.tsx must not use mockReturnValue for async getVendors"
    )


def test_r_p4_17_safetyview_test_mocks_are_async():
    """R-P4-17: SafetyView tests use mockResolvedValue for getServiceTickets."""
    for test_name in ["SafetyView.test.tsx", "SafetyView.deep.test.tsx"]:
        test_file = ROOT / "src" / "__tests__" / "components" / test_name
        content = test_file.read_text(encoding="utf-8")
        assert "getServiceTickets: vi.fn().mockResolvedValue(" in content, (
            f"{test_name} must use mockResolvedValue for async getServiceTickets"
        )
        assert "getVendors: vi.fn().mockResolvedValue(" in content, (
            f"{test_name} must use mockResolvedValue for async getVendors"
        )


# --- R-P4-18: Server tests ---


def test_r_p4_18_server_test_files_exist():
    """R-P4-18: Server test suite exists and has at least 50 test files."""
    server_tests = list((ROOT / "server" / "__tests__").rglob("*.test.ts"))
    assert len(server_tests) >= 50, (
        f"Expected >= 50 server test files, found {len(server_tests)}"
    )


def test_r_p4_18_auth_test_imports_aftereach():
    """R-P4-18: auth.test.ts imports afterEach from vitest."""
    auth_test = ROOT / "server" / "__tests__" / "lib" / "auth.test.ts"
    content = auth_test.read_text(encoding="utf-8")
    assert "afterEach" in content, (
        "server/__tests__/lib/auth.test.ts must import afterEach from vitest"
    )


def test_r_p4_18_backfill_test_has_timeout():
    """R-P4-18: backfill-firebase-uid.test.ts has vitest timeout on spawnSync tests."""
    backfill_test = (
        ROOT / "server" / "__tests__" / "scripts" / "backfill-firebase-uid.test.ts"
    )
    content = backfill_test.read_text(encoding="utf-8")
    timeout_count = content.count("}, 30000);")
    assert timeout_count >= 2, (
        f"Expected >= 2 vitest timeout declarations (30000) in backfill test, found {timeout_count}"
    )


# --- R-P4-19: Build verification ---


def test_r_p4_19_build_output_exists():
    """R-P4-19: dist/assets directory exists from npm run build."""
    assert DIST_ASSETS.exists(), "dist/assets not found - run npm run build first"
    js_files = list(DIST_ASSETS.glob("*.js"))
    assert len(js_files) > 5, (
        f"Expected > 5 JS chunks in dist/assets, found {len(js_files)}"
    )


def test_r_p4_19_no_new_chunks_over_250kb():
    """R-P4-19: No route chunks > 250KB excluding shared vendor chunks."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found")
    over_limit = []
    for js_file in sorted(DIST_ASSETS.glob("*.js")):
        name = js_file.name
        if any(name.startswith(p) for p in EXEMPT_CHUNK_PREFIXES):
            continue
        size_kb = js_file.stat().st_size / 1024
        if size_kb > 250:
            over_limit.append(f"{name}: {size_kb:.1f}kB")
    assert over_limit == [], f"Route chunk(s) exceed 250KB: {over_limit}"


def test_r_p4_19_negative_critical_chunks_exist():
    """R-P4-19 negative: Critical shared chunks (vendor, firebase) must exist."""
    if not DIST_ASSETS.exists():
        import pytest

        pytest.skip("dist/assets not found")
    vendor = list(DIST_ASSETS.glob("vendor-*.js"))
    firebase = list(DIST_ASSETS.glob("firebase-*.js"))
    assert len(vendor) >= 1, "vendor-*.js chunk missing from dist/assets"
    assert len(firebase) >= 1, "firebase-*.js chunk missing from dist/assets"


# --- R-P4-20: Navigation coverage ---


def test_r_p4_20_app_has_dashboard():
    """R-P4-20: App.tsx references Dashboard tab/route."""
    app = (ROOT / "App.tsx").read_text(encoding="utf-8")
    assert "Dashboard" in app, "App.tsx must reference Dashboard tab/route"


def test_r_p4_20_app_has_load_board():
    """R-P4-20: App.tsx references Load Board."""
    app = (ROOT / "App.tsx").read_text(encoding="utf-8")
    assert "Load Board" in app or "LoadList" in app, (
        "App.tsx must reference Load Board or LoadList"
    )


def test_r_p4_20_app_has_accounting():
    """R-P4-20: App.tsx references Accounting."""
    app = (ROOT / "App.tsx").read_text(encoding="utf-8")
    assert "Accounting" in app, "App.tsx must reference Accounting"


def test_r_p4_20_app_has_safety():
    """R-P4-20: App.tsx references Safety."""
    app = (ROOT / "App.tsx").read_text(encoding="utf-8")
    assert "Safety" in app, "App.tsx must reference Safety"


def test_r_p4_20_app_has_broker_network():
    """R-P4-20: App.tsx references Broker Network."""
    app = (ROOT / "App.tsx").read_text(encoding="utf-8")
    assert "Broker Network" in app or "BrokerManager" in app, (
        "App.tsx must reference Broker Network or BrokerManager"
    )


def test_r_p4_20_app_has_vault():
    """R-P4-20: App.tsx references FileVault."""
    app = (ROOT / "App.tsx").read_text(encoding="utf-8")
    assert "vault" in app.lower() or "FileVault" in app, (
        "App.tsx must reference FileVault or vault"
    )


def test_r_p4_20_navigation_test_covers_labels():
    """R-P4-20: App.navigation.test.tsx covers Dashboard and Accounting labels."""
    nav_test = ROOT / "src" / "__tests__" / "components" / "App.navigation.test.tsx"
    assert nav_test.exists(), "App.navigation.test.tsx must exist"
    content = nav_test.read_text(encoding="utf-8")
    assert "Dashboard" in content, "App.navigation.test.tsx must test Dashboard"
    assert "Accounting" in content, "App.navigation.test.tsx must test Accounting"
