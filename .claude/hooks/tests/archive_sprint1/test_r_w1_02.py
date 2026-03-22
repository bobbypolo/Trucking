"""
Tests R-W1-01c, R-W1-VPC-202

H-202: Fix Unsafe Nested Property Access -- Remaining 7 Components
Add optional chaining to all unsafe pickup/dropoff/nested reads in
ExportModal, OperationalMessaging, QuoteManager, Settlements,
CommandCenterView, BookingPortal, IntelligenceHub.
"""

# Tests R-W1-01c, R-W1-VPC-202

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

STORY_FILES = [
    "components/ExportModal.tsx",
    "components/OperationalMessaging.tsx",
    "components/QuoteManager.tsx",
    "components/Settlements.tsx",
    "components/CommandCenterView.tsx",
    "components/BookingPortal.tsx",
    "components/IntelligenceHub.tsx",
]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# R-W1-01c: All pickup/dropoff/nested reads use optional chaining
# ---------------------------------------------------------------------------


def test_r_w1_01c_export_modal_pickup_guarded():
    """R-W1-01c: ExportModal uses optional chaining on pickup.facilityName."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "ExportModal.tsx"
    content = _read(path)
    assert "l.pickup.facilityName" not in content, (
        "ExportModal must not have unguarded l.pickup.facilityName — use l.pickup?.facilityName"
    )
    assert "l.pickup?.facilityName" in content, (
        "ExportModal must use l.pickup?.facilityName"
    )


def test_r_w1_01c_operational_messaging_pickup_dropoff_guarded():
    """R-W1-01c: OperationalMessaging uses optional chaining on pickup/dropoff.city."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "OperationalMessaging.tsx"
    content = _read(path)
    assert "selectedLoad.pickup.city" not in content, (
        "OperationalMessaging must not have unguarded selectedLoad.pickup.city"
    )
    assert "selectedLoad.dropoff.city" not in content, (
        "OperationalMessaging must not have unguarded selectedLoad.dropoff.city"
    )


def test_r_w1_01c_quote_manager_pickup_dropoff_guarded():
    """R-W1-01c: QuoteManager uses optional chaining on all pickup/dropoff reads."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "QuoteManager.tsx"
    content = _read(path)
    # These unguarded patterns must not exist
    bad_patterns = [
        "q.pickup.city",
        "q.dropoff.city",
        "{quote.pickup.city}",
        "{quote.dropoff.city}",
        "selectedQuote.pickup.city",
        "selectedQuote.pickup.state",
        "selectedQuote.dropoff.city",
        "selectedQuote.dropoff.state",
        "selectedQuote?.pickup.city",
        "selectedQuote?.pickup.state",
        "selectedQuote?.dropoff.city",
        "selectedQuote?.dropoff.state",
    ]
    for pattern in bad_patterns:
        assert pattern not in content, (
            f"QuoteManager must not have unguarded '{pattern}'"
        )


def test_r_w1_01c_settlements_pickup_guarded():
    """R-W1-01c: Settlements uses optional chaining on pickup.facilityName."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "Settlements.tsx"
    content = _read(path)
    assert "load.pickup.facilityName" not in content, (
        "Settlements must not have unguarded load.pickup.facilityName"
    )
    assert "load.pickup?.facilityName" in content, (
        "Settlements must use load.pickup?.facilityName"
    )


def test_r_w1_01c_intelligence_hub_contact_name_guarded():
    """R-W1-01c: IntelligenceHub uses safe access on contact.name."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "IntelligenceHub.tsx"
    content = _read(path)
    # contact.name.charAt(0) without guard is unsafe
    assert "{contact.name.charAt(0)}" not in content, (
        "IntelligenceHub must not have unguarded {contact.name.charAt(0)}"
    )


def test_r_w1_01c_intelligence_hub_provider_coverage_guarded():
    """R-W1-01c: IntelligenceHub uses optional chaining on provider.coverage.regions."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "IntelligenceHub.tsx"
    content = _read(path)
    assert "provider.coverage.regions" not in content, (
        "IntelligenceHub must not have unguarded provider.coverage.regions — use provider.coverage?.regions"
    )


# ---------------------------------------------------------------------------
# R-W1-VPC-202: VPC unit tests pass for each modified component
# ---------------------------------------------------------------------------


def test_r_w1_vpc_202_typescript_compiles():
    """R-W1-VPC-202: TypeScript compiles without errors after optional chaining fixes."""
    # Tests R-W1-VPC-202
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
    assert result.returncode == 0, (
        f"TypeScript compilation failed after H-202 changes:\n{result.stdout}\n{result.stderr}"
    )


def test_r_w1_vpc_202_no_remaining_unguarded_reads():
    """R-W1-VPC-202: None of the 7 story files have unguarded .pickup. or .dropoff. reads."""
    # Tests R-W1-VPC-202
    unsafe_patterns = [".pickup.", ".dropoff."]
    safe_context_markers = [
        "?.pickup.",
        "?.dropoff.",
        "...selectedQuote.pickup",
        "...selectedQuote.dropoff",
        "...quote.pickup",
        "...quote.dropoff",
        "setPickup",
        "setDropoff",
    ]

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
                    # Check if it's guarded
                    if any(safe in line for safe in safe_context_markers):
                        continue
                    # Check it's not a spread/setter
                    if "..." in line and pattern.strip(".") in line:
                        continue
                    assert False, (
                        f"{rel_path} line {i}: unguarded '{pattern}' read: {stripped!r}"
                    )
