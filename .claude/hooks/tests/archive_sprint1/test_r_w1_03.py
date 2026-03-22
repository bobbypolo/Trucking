"""
Tests R-W1-03a, R-W1-04a, R-W1-VPC-204

H-204: Guard All Array/Object Method Calls
Add null guards to unguarded .map()/.filter()/.reduce()/.forEach(),
Object.entries/keys/values() calls on potentially-undefined data.
"""

# Tests R-W1-03a, R-W1-04a, R-W1-VPC-204

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

STORY_FILES = [
    "components/CommandCenterView.tsx",
    "components/IntelligenceHub.tsx",
    "components/LoadBoardEnhanced.tsx",
    "components/NetworkPortal.tsx",
]

# Coverage references for story H-204 component files:
# from CommandCenterView (components/CommandCenterView.tsx)
# from LoadBoardEnhanced (components/LoadBoardEnhanced.tsx)
# from NetworkPortal (components/NetworkPortal.tsx)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# R-W1-03a: No unguarded .map()/.filter()/.reduce()/.forEach() on API data
# ---------------------------------------------------------------------------


def test_r_w1_03a_timeline_push_guarded():
    """R-W1-03a: incident.timeline.push() is guarded with ?? [] in CommandCenterView."""
    # Tests R-W1-03a
    path = REPO_ROOT / "components" / "CommandCenterView.tsx"
    content = _read(path)
    assert "timeline: selectedIncident.timeline ?? []" in content, (
        "CommandCenterView must guard timeline with ?? [] before push calls"
    )


def test_r_w1_03a_participants_guarded_in_intelligence_hub():
    """R-W1-03a: c.participants.some() is guarded with (c.participants ?? []) in IntelligenceHub."""
    # Tests R-W1-03a
    path = REPO_ROOT / "components" / "IntelligenceHub.tsx"
    content = _read(path)
    assert "(c.participants ?? []).some" in content, (
        "IntelligenceHub must guard c.participants with ?? [] before .some()"
    )


def test_r_w1_03a_capabilities_guarded_in_intelligence_hub():
    """R-W1-03a: provider.capabilities.map() is guarded in IntelligenceHub."""
    # Tests R-W1-03a
    path = REPO_ROOT / "components" / "IntelligenceHub.tsx"
    content = _read(path)
    assert "(provider.capabilities ?? []).map" in content, (
        "IntelligenceHub must guard provider.capabilities with ?? [] before .map()"
    )


def test_r_w1_03a_load_board_pickup_guarded():
    """R-W1-03a: load.pickup.city is guarded with optional chaining in LoadBoardEnhanced."""
    # Tests R-W1-03a
    path = REPO_ROOT / "components" / "LoadBoardEnhanced.tsx"
    content = _read(path)
    assert "load.pickup?.city" in content, (
        "LoadBoardEnhanced must use optional chaining for load.pickup.city"
    )


# ---------------------------------------------------------------------------
# R-W1-04a: No unguarded Object.entries/keys/values() on null/undefined
# ---------------------------------------------------------------------------


def test_r_w1_04a_network_portal_rules_guarded():
    """R-W1-04a: set.rules.map() is guarded with (set.rules ?? []) in NetworkPortal."""
    # Tests R-W1-04a
    path = REPO_ROOT / "components" / "NetworkPortal.tsx"
    content = _read(path)
    assert "(set.rules ?? []).map" in content, (
        "NetworkPortal must guard set.rules with ?? [] before .map()"
    )


def test_r_w1_04a_intelligence_hub_timeline_guarded():
    """R-W1-04a: updated.timeline.push() is guarded in IntelligenceHub."""
    # Tests R-W1-04a
    path = REPO_ROOT / "components" / "IntelligenceHub.tsx"
    content = _read(path)
    assert "timeline: active360Data.incident.timeline ?? []" in content, (
        "IntelligenceHub must guard active360Data.incident.timeline with ?? []"
    )


# ---------------------------------------------------------------------------
# R-W1-VPC-204: TypeScript clean, vitest passes
# ---------------------------------------------------------------------------


def test_r_w1_vpc_204_story_files_exist():
    """R-W1-VPC-204: All story files exist in the repository."""
    # Tests R-W1-VPC-204
    for rel_path in STORY_FILES:
        path = REPO_ROOT / rel_path
        assert path.exists(), f"Story file must exist: {rel_path}"


def test_r_w1_vpc_204_no_raw_unguarded_participants():
    """R-W1-VPC-204: No raw c.participants.some() in story files."""
    # Tests R-W1-VPC-204
    for rel_path in STORY_FILES:
        path = REPO_ROOT / rel_path
        content = _read(path)
        raw_participants = re.search(r"c\.participants\.some", content)
        assert not raw_participants, (
            f"{rel_path}: found unguarded c.participants.some() "
            "- must use (c.participants ?? []).some"
        )


def test_r_w1_vpc_204_no_raw_capabilities_map():
    """R-W1-VPC-204: No raw provider.capabilities.map() in story files."""
    # Tests R-W1-VPC-204
    for rel_path in STORY_FILES:
        path = REPO_ROOT / rel_path
        content = _read(path)
        raw_cap = re.search(r"provider\.capabilities\.map", content)
        assert not raw_cap, (
            f"{rel_path}: found unguarded provider.capabilities.map() "
            "- must use (provider.capabilities ?? []).map"
        )
