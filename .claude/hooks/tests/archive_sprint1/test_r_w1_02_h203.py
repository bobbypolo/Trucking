"""
Tests R-W1-02a, R-W1-02b, R-W1-VPC-203

H-203: Remove Non-null Assertions on API Data
Replace all TypeScript non-null assertion operators (!) on API response data
with proper optional chaining or type guards in:
  - components/BookingPortal.tsx
  - components/IntelligenceHub.tsx
  - components/NetworkPortal.tsx
  - components/OperationalMessaging.tsx
  - components/CompanyProfile.tsx
"""

# Tests R-W1-02a, R-W1-02b, R-W1-VPC-203

import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

STORY_FILES = [
    "components/BookingPortal.tsx",
    "components/IntelligenceHub.tsx",
    "components/NetworkPortal.tsx",
    "components/OperationalMessaging.tsx",
    "components/CompanyProfile.tsx",
]

# Non-null assertion pattern: word character followed by !.
_NONNULL_RE = re.compile(r"\w+!\.")


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _check_no_nonnull(component_name: str, rel_path: str) -> None:
    """Shared helper: assert no non-null assertions on API data in the given file."""
    path = REPO_ROOT / rel_path
    content = _read(path)
    violations = []
    for i, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        if _NONNULL_RE.search(line):
            violations.append(f"  line {i}: {stripped}")
    assert not violations, (
        f"{component_name} still has non-null assertions (word!.):\n"
        + "\n".join(violations)
    )


# ---------------------------------------------------------------------------
# R-W1-02a: No non-null assertions on API data in each scope file
# ---------------------------------------------------------------------------


def test_r_w1_02a_booking_portal_no_nonnull():
    """R-W1-02a: BookingPortal has no non-null assertions on API data."""
    # Tests R-W1-02a
    _check_no_nonnull("BookingPortal.tsx", "components/BookingPortal.tsx")


def test_r_w1_02a_intelligence_hub_no_nonnull():
    """R-W1-02a: IntelligenceHub has no non-null assertions on API data."""
    # Tests R-W1-02a
    _check_no_nonnull("IntelligenceHub.tsx", "components/IntelligenceHub.tsx")


def test_r_w1_02a_network_portal_no_nonnull():
    """R-W1-02a: NetworkPortal has no non-null assertions on API data."""
    # Tests R-W1-02a
    _check_no_nonnull("NetworkPortal.tsx", "components/NetworkPortal.tsx")


def test_r_w1_02a_operational_messaging_no_nonnull():
    """R-W1-02a: OperationalMessaging has no non-null assertions on API data."""
    # Tests R-W1-02a
    _check_no_nonnull("OperationalMessaging.tsx", "components/OperationalMessaging.tsx")


def test_r_w1_02a_company_profile_no_nonnull():
    """R-W1-02a: CompanyProfile has no non-null assertions on API data."""
    # Tests R-W1-02a
    _check_no_nonnull("CompanyProfile.tsx", "components/CompanyProfile.tsx")


# ---------------------------------------------------------------------------
# R-W1-02b: No 'as any' casts added to replace assertions
# ---------------------------------------------------------------------------


def test_r_w1_02b_no_new_as_any_in_booking_portal():
    """R-W1-02b: BookingPortal changes use real type fixes, not 'as any' replacements."""
    # Tests R-W1-02b
    path = REPO_ROOT / "components" / "BookingPortal.tsx"
    content = _read(path)
    convert_fn_start = content.find("const convertToBooking")
    if convert_fn_start >= 0:
        fn_end = content.find("};", convert_fn_start)
        fn_body = content[convert_fn_start:fn_end]
        assert " as any" not in fn_body, (
            "BookingPortal convertToBooking must not use 'as any' to bypass type errors"
        )


# ---------------------------------------------------------------------------
# R-W1-VPC-203: TypeScript compiles clean
# ---------------------------------------------------------------------------


def test_r_w1_vpc_203_typescript_compiles():
    """R-W1-VPC-203: TypeScript compiles without errors after non-null assertion removal."""
    # Tests R-W1-VPC-203
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
        f"TypeScript compilation failed after H-203 changes:\n{result.stdout}\n{result.stderr}"
    )
