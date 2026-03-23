# Tests R-W3-02b, R-W3-03b, R-W3-04b, R-W3-VPC-403
"""
H-403: Loading/Error/Empty States - Batch 2 verification tests.
Validates that LoadingSkeleton, ErrorState, and EmptyState are properly
integrated into the 5 target components.
"""

import os
import re
import subprocess
import pytest

REPO_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

COMPONENTS = [
    "DriverMobileHome.tsx",
    "IFTAManager.tsx",
    "FileVault.tsx",
    "BookingPortal.tsx",
    "IntelligenceHub.tsx",
]


def read_component(name: str) -> str:
    path = os.path.join(REPO_ROOT, "components", name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestLoadingSkeletonBatch2:
    """R-W3-02b: Each component shows LoadingSkeleton while data is loading."""

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_imports_loading_skeleton(self, component):
        content = read_component(component)
        assert "LoadingSkeleton" in content, f"{component} must import LoadingSkeleton"

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_renders_loading_skeleton(self, component):
        content = read_component(component)
        assert "<LoadingSkeleton" in content, (
            f"{component} must render <LoadingSkeleton"
        )


class TestErrorStateBatch2:
    """R-W3-03b: Each component shows ErrorState on API failure."""

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_imports_error_state(self, component):
        content = read_component(component)
        assert "ErrorState" in content, f"{component} must import ErrorState"

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_renders_error_state_with_retry(self, component):
        content = read_component(component)
        assert "<ErrorState" in content, f"{component} must render <ErrorState"
        assert "onRetry" in content, (
            f"{component} must provide onRetry callback to ErrorState"
        )


class TestEmptyStateBatch2:
    """R-W3-04b: Each component shows EmptyState when data array is empty."""

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_imports_empty_state(self, component):
        content = read_component(component)
        assert "EmptyState" in content, f"{component} must import EmptyState"

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_renders_empty_state(self, component):
        content = read_component(component)
        assert "<EmptyState" in content, f"{component} must render <EmptyState"


class TestVPCBatch2:
    """R-W3-VPC-403: VPC - unit tests pass, tsc clean."""

    def test_tsc_clean_for_modified_components(self):
        """TypeScript compiles without errors for modified files."""
        result = subprocess.run(
            "npx tsc --noEmit",
            shell=True,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            encoding="utf-8",
            errors="replace",
        )
        stderr = result.stderr + result.stdout
        for comp in COMPONENTS:
            assert comp not in stderr, f"TypeScript error in {comp}: {stderr}"

    def test_loading_state_conditionally_rendered(self):
        """Loading state is properly guarded (not always shown)."""
        for comp in COMPONENTS:
            content = read_component(comp)
            match = re.search(
                r"if\s*\(\s*(isLoading|loading|props\.isLoading|initLoading)\s*\)",
                content,
            )
            assert match is not None, f"{comp} must have an if-guard for loading state"
            assert match.group(1) in content, (
                f"{comp} loading guard variable '{match.group(1)}' must appear in component"
            )

    def test_error_state_conditionally_rendered(self):
        """Error state is properly guarded."""
        for comp in COMPONENTS:
            content = read_component(comp)
            match = re.search(
                r"if\s*\(\s*(loadError|initError|props\.loadError)\s*\)", content
            )
            assert match is not None, f"{comp} must have an if-guard for error state"
            assert match.group(1) in content, (
                f"{comp} error guard variable '{match.group(1)}' must appear in component"
            )
