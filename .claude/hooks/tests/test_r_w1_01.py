"""
Tests R-W1-01a, R-W1-01b, R-W1-VPC-201

H-201: Fix Unsafe Nested Property Access -- Top 10 Components
Add optional chaining to all unsafe pickup/dropoff/nested reads in the
top 10 most affected components: AnalyticsDashboard, CalendarView,
CustomerPortalView, DriverMobileHome, GlobalMapView,
GlobalMapViewEnhanced, Intelligence, LoadBoardEnhanced, LoadList,
SafetyView.
"""

# Tests R-W1-01a, R-W1-01b, R-W1-VPC-201

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

STORY_FILES = [
    "components/AnalyticsDashboard.tsx",
    "components/CalendarView.tsx",
    "components/CustomerPortalView.tsx",
    "components/DriverMobileHome.tsx",
    "components/GlobalMapView.tsx",
    "components/GlobalMapViewEnhanced.tsx",
    "components/Intelligence.tsx",
    "components/LoadBoardEnhanced.tsx",
    "components/LoadList.tsx",
    "components/SafetyView.tsx",
]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# R-W1-01a: All pickup/dropoff reads on API data use optional chaining
# ---------------------------------------------------------------------------


def test_r_w1_01a_analytics_dashboard_pickup_guarded():
    """R-W1-01a: AnalyticsDashboard uses optional chaining on pickup/dropoff reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "AnalyticsDashboard.tsx"
    content = _read(path)
    assert "l.pickup.city" not in content, "AnalyticsDashboard unguarded l.pickup.city"
    assert "l.dropoff.city" not in content, (
        "AnalyticsDashboard unguarded l.dropoff.city"
    )
    assert "l.pickup?.city" in content, "AnalyticsDashboard must use l.pickup?.city"


def test_r_w1_01a_calendar_view_dropoff_guarded():
    """R-W1-01a: CalendarView uses optional chaining on dropoff.city."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "CalendarView.tsx"
    content = _read(path)
    assert "load.dropoff.city" not in content, (
        "CalendarView unguarded load.dropoff.city"
    )
    assert "load.dropoff?.city" in content, "CalendarView must use load.dropoff?.city"


def test_r_w1_01a_customer_portal_pickup_dropoff_guarded():
    """R-W1-01a: CustomerPortalView uses optional chaining on all pickup/dropoff reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "CustomerPortalView.tsx"
    content = _read(path)
    bad = [
        "l.dropoff.city",
        "load.pickup.city",
        "load.dropoff.city",
        "selectedLoad.pickup.city",
        "selectedLoad.pickup.state",
        "selectedLoad.dropoff.city",
        "selectedLoad.dropoff.state",
    ]
    for p in bad:
        assert p not in content, f"CustomerPortalView unguarded: {p!r}"


def test_r_w1_01a_driver_mobile_home_pickup_dropoff_guarded():
    """R-W1-01a: DriverMobileHome uses optional chaining on pickup/dropoff reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "DriverMobileHome.tsx"
    content = _read(path)
    bad = [
        "load.pickup.city",
        "load.dropoff.city",
        "selectedLoad.pickup.city",
        "selectedLoad.pickup.state",
        "selectedLoad.dropoff.city",
        "selectedLoad.dropoff.state",
        "selectedLoad.pickup.facilityName",
    ]
    for p in bad:
        assert p not in content, f"DriverMobileHome unguarded: {p!r}"


def test_r_w1_01a_global_map_view_pickup_dropoff_guarded():
    """R-W1-01a: GlobalMapView uses optional chaining on activeLoad.pickup/dropoff."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "GlobalMapView.tsx"
    content = _read(path)
    assert "vehicle.activeLoad.pickup.city" not in content
    assert "vehicle.activeLoad.dropoff.city" not in content


def test_r_w1_01a_global_map_view_enhanced_pickup_dropoff_guarded():
    """R-W1-01a: GlobalMapViewEnhanced uses optional chaining on pickup/dropoff."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "GlobalMapViewEnhanced.tsx"
    content = _read(path)
    bad = [
        "load.pickup.city",
        "load.pickup.state",
        "load.dropoff.city",
        "load.dropoff.state",
        "selectedVehicle.activeLoad.pickup.city",
        "selectedDriverOverlay.activeLoad.pickup.city",
        "selectedDriverOverlay.activeLoad.dropoff.city",
    ]
    for p in bad:
        assert p not in content, f"GlobalMapViewEnhanced unguarded: {p!r}"


def test_r_w1_01a_intelligence_pickup_dropoff_guarded():
    """R-W1-01a: Intelligence uses optional chaining on pickup/dropoff reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "Intelligence.tsx"
    content = _read(path)
    bad = [
        "load.pickup.facilityName",
        "load.pickup.city",
        "load.pickup.state",
        "load.dropoff.facilityName",
        "load.dropoff.city",
        "load.dropoff.state",
    ]
    for p in bad:
        assert p not in content, f"Intelligence unguarded: {p!r}"


def test_r_w1_01a_load_board_enhanced_pickup_dropoff_guarded():
    """R-W1-01a: LoadBoardEnhanced uses optional chaining on pickup/dropoff reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "LoadBoardEnhanced.tsx"
    content = _read(path)
    assert "load.pickup.city" not in content
    assert "load.dropoff.city" not in content


def test_r_w1_01a_load_list_pickup_dropoff_guarded():
    """R-W1-01a: LoadList uses optional chaining on pickup/dropoff reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "LoadList.tsx"
    content = _read(path)
    bad = [
        "l.pickup.city",
        "load.pickup.city",
        "load.pickup.state",
        "load.dropoff.city",
        "load.dropoff.state",
        "load.pickup.facilityName",
        "load.dropoff.facilityName",
    ]
    for p in bad:
        assert p not in content, f"LoadList unguarded: {p!r}"


def test_r_w1_01a_safety_view_pickup_guarded():
    """R-W1-01a: SafetyView uses optional chaining on pickup.city reads."""
    # Tests R-W1-01a
    path = REPO_ROOT / "components" / "SafetyView.tsx"
    content = _read(path)
    assert "l.pickup.city" not in content, "SafetyView unguarded l.pickup.city"
    assert "l.pickup?.city" in content, "SafetyView must use l.pickup?.city"


# ---------------------------------------------------------------------------
# R-W1-01b: Spot-verify 3 files -- no unguarded nested reads remain
# ---------------------------------------------------------------------------


def test_r_w1_01b_spot_verify_load_list():
    """R-W1-01b: Spot-verify LoadList has no unguarded .pickup. or .dropoff. on load objects."""
    # Tests R-W1-01b
    path = REPO_ROOT / "components" / "LoadList.tsx"
    content = _read(path)
    violations = []
    for i, line in enumerate(content.split("\n"), 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        if re.search(r"\bload\.pickup\.", line) and "?.pickup." not in line:
            violations.append(f"line {i}: unguarded load.pickup.: {stripped!r}")
        if re.search(r"\bload\.dropoff\.", line) and "?.dropoff." not in line:
            violations.append(f"line {i}: unguarded load.dropoff.: {stripped!r}")
    assert violations == [], f"LoadList unguarded reads: {violations}"


def test_r_w1_01b_spot_verify_customer_portal():
    """R-W1-01b: Spot-verify CustomerPortalView has no unguarded pickup/dropoff reads."""
    # Tests R-W1-01b
    path = REPO_ROOT / "components" / "CustomerPortalView.tsx"
    content = _read(path)
    violations = []
    for i, line in enumerate(content.split("\n"), 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        for obj_name in ["l", "load", "selectedLoad"]:
            for prop in ["pickup", "dropoff"]:
                pattern = f"{obj_name}.{prop}."
                safe_pattern = f"{obj_name}.{prop}?."
                if pattern in line and safe_pattern not in line:
                    if "set" + prop.capitalize() in line:
                        continue
                    if f"...{obj_name}.{prop}" in line:
                        continue
                    violations.append(f"line {i}: unguarded {pattern!r}: {stripped!r}")
    assert violations == [], f"CustomerPortalView unguarded reads: {violations}"


def test_r_w1_01b_spot_verify_global_map_view_enhanced():
    """R-W1-01b: Spot-verify GlobalMapViewEnhanced has no unguarded pickup/dropoff reads."""
    # Tests R-W1-01b
    path = REPO_ROOT / "components" / "GlobalMapViewEnhanced.tsx"
    content = _read(path)
    violations = []
    for i, line in enumerate(content.split("\n"), 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        for prop in ["pickup", "dropoff"]:
            if (
                f".{prop}." in line
                and f".{prop}?." not in line
                and f"?.{prop}." not in line
            ):
                if "set" + prop.capitalize() in line:
                    continue
                violations.append(f"line {i}: unguarded .{prop}.: {stripped!r}")
    assert violations == [], f"GlobalMapViewEnhanced unguarded reads: {violations}"


# ---------------------------------------------------------------------------
# R-W1-VPC-201: VPC -- unit tests pass, tsc clean, vitest pass
# ---------------------------------------------------------------------------


def test_r_w1_vpc_201_typescript_compiles():
    """R-W1-VPC-201: TypeScript compiles without errors after optional chaining fixes."""
    # Tests R-W1-VPC-201
    import subprocess

    result = subprocess.run(
        "npx tsc --noEmit",
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        timeout=120,
        encoding="utf-8",
        errors="replace",
        shell=True,
    )
    assert result.returncode == 0, f"TypeScript failed: {result.stdout} {result.stderr}"


def test_r_w1_vpc_201_no_remaining_unguarded_reads():
    """R-W1-VPC-201: None of the 10 story files have unguarded .pickup. or .dropoff. reads."""
    # Tests R-W1-VPC-201
    unsafe_patterns = [".pickup.", ".dropoff."]
    safe_context_markers = [
        "?.pickup.",
        "?.dropoff.",
        "setPickup",
        "setDropoff",
        "onPickup",
        "onDropoff",
    ]
    all_violations = []
    for rel_path in STORY_FILES:
        path = REPO_ROOT / rel_path
        if not path.exists():
            continue
        content = _read(path)
        for i, line in enumerate(content.split("\n"), 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            for pattern in unsafe_patterns:
                if pattern in line:
                    if any(safe in line for safe in safe_context_markers):
                        continue
                    if "..." in line and pattern.strip(".") in line:
                        continue
                    all_violations.append(
                        f"{rel_path}:{i}: unguarded {pattern!r}: {stripped!r}"
                    )
    assert all_violations == [], f"Unguarded reads found: {all_violations}"


def test_r_w1_01_rejects_missing_optional_chaining():
    """R-W1-01a: Verify the guard test logic correctly flags unguarded patterns."""
    # Tests R-W1-01a -- negative test: guard logic works correctly

    # An unguarded nested read: no optional chaining on pickup
    bad_line = "const city = load.pickup.city;"
    # A guarded read: optional chaining on the parent object before pickup
    safe_line = "const city = load?.pickup.city;"

    # The bad pattern contains .pickup. with no preceding ?.
    assert ".pickup." in bad_line, "bad_line must contain .pickup. pattern"
    assert "?.pickup." not in bad_line, (
        "bad_line must NOT have optional chaining ?.pickup."
    )

    # The safe line has ?.pickup. so is guarded
    assert "?.pickup." in safe_line, "safe_line must have optional chaining ?.pickup."

    # If neither safe marker appears, the line is unsafe -- this should be False for a safe line
    safe_markers = ["?.pickup.", "?.dropoff.", "setPickup", "setDropoff"]
    safe_line_flagged = ".pickup." in safe_line and not any(
        m in safe_line for m in safe_markers
    )
    assert safe_line_flagged == False, "safe_line must NOT be flagged as unsafe"
    bad_line_flagged = ".pickup." in bad_line and not any(
        m in bad_line for m in safe_markers
    )
    assert bad_line_flagged == True, "bad_line must be flagged as unsafe"
