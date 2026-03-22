# Tests R-W4-02a, R-W4-05a, R-W4-VPC-502
"""H-502: Icon Button Accessibility + Heading Hierarchy — Batch 1.

Validates that all icon-only buttons in the 15 batch-1 components have
descriptive aria-labels, and heading elements follow sequential order
(h1->h2->h3, no skipped levels).
"""
import os
import re
import pytest

BATCH_1_COMPONENTS = [
    "components/IntelligenceHub.tsx",
    "components/CommandCenterView.tsx",
    "components/Dashboard.tsx",
    "components/AccountingPortal.tsx",
    "components/LoadBoardEnhanced.tsx",
    "components/QuoteManager.tsx",
    "components/BookingPortal.tsx",
    "components/NetworkPortal.tsx",
    "components/SafetyView.tsx",
    "components/BrokerManager.tsx",
    "components/Settlements.tsx",
    "components/IFTAManager.tsx",
    "components/CompanyProfile.tsx",
    "components/ExportModal.tsx",
    "components/FileVault.tsx",
]

# Resolve project root (3 levels up from this test file)
_HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(_HERE, "..", "..", ".."))


def _read(component: str) -> str:
    path = os.path.join(PROJECT_ROOT, component)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ── R-W4-02a: Icon-only buttons must have aria-label ──


def _find_icon_only_buttons_without_aria(content: str) -> list[dict]:
    """Find <button> elements that contain only icon content (no text) and lack aria-label."""
    lines = content.split("\n")
    violations = []

    for i, line in enumerate(lines):
        if "<button" not in line:
            continue

        # Grab up to 8 lines for the full button element
        chunk = "\n".join(lines[i : min(i + 8, len(lines))])

        # Skip if already has aria-label
        if "aria-label" in chunk:
            continue

        # Extract content between > and </button>
        btn_match = re.search(r">(.*?)</button>", chunk, re.DOTALL)
        if not btn_match:
            continue

        inner = btn_match.group(1)
        # Remove HTML/JSX tags
        text = re.sub(r"<[^>]+>", "", inner).strip()
        # Remove JSX expressions that are NOT text content (like className={...})
        # But keep {s.value} type expressions as they are text
        text_no_expr = re.sub(r"\{[^}]*\}", "", text).strip()

        # Truly empty (icon-only): no text at all after removing tags
        if len(text) == 0:
            violations.append({"line": i + 1, "context": line.strip()[:80]})

    return violations


@pytest.mark.parametrize("component", BATCH_1_COMPONENTS)
def test_icon_buttons_have_aria_label(component: str):
    """R-W4-02a: All icon-only buttons must have descriptive aria-label."""
    content = _read(component)
    violations = _find_icon_only_buttons_without_aria(content)
    assert violations == [], (
        f"{component} has icon-only buttons without aria-label:\n"
        + "\n".join(f"  Line {v['line']}: {v['context']}" for v in violations)
    )


# ── R-W4-05a: Heading hierarchy must be sequential ──


def _check_heading_hierarchy(content: str) -> list[str]:
    """Check that heading levels don't skip (e.g., h2 directly to h4)."""
    h_re = re.compile(r"<h([1-6])")
    lines = content.split("\n")
    levels_used = set()

    for line in lines:
        m = h_re.search(line)
        if m:
            levels_used.add(int(m.group(1)))

    if not levels_used:
        return []

    sorted_levels = sorted(levels_used)
    issues = []
    for idx in range(len(sorted_levels) - 1):
        gap = sorted_levels[idx + 1] - sorted_levels[idx]
        if gap > 1:
            issues.append(
                f"Heading gap: h{sorted_levels[idx]} -> h{sorted_levels[idx+1]} "
                f"(skips h{sorted_levels[idx] + 1})"
            )

    return issues


@pytest.mark.parametrize("component", BATCH_1_COMPONENTS)
def test_heading_hierarchy_sequential(component: str):
    """R-W4-05a: Headings must follow sequential order with no skipped levels."""
    content = _read(component)
    issues = _check_heading_hierarchy(content)
    assert issues == [], (
        f"{component} has heading hierarchy violations:\n"
        + "\n".join(f"  {iss}" for iss in issues)
    )


# ── R-W4-VPC-502: TypeScript compiles clean ──


def test_vpc_tsc_clean():
    """R-W4-VPC-502: TypeScript compiles without errors for modified components."""
    import subprocess

    result = subprocess.run(
        "npx tsc --noEmit",
        shell=True,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, f"tsc failed:\n{result.stdout}\n{result.stderr}"
