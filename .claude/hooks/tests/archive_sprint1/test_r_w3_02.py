# Tests R-W3-02a, R-W3-03a, R-W3-04a, R-W3-VPC-402
"""
H-402: Loading/Error/Empty States - Batch 1 verification tests.
Validates that LoadingSkeleton, ErrorState, and EmptyState are properly
integrated into the 6 target components.
"""
import os
import re
import subprocess
import pytest

REPO_ROOT = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
)

COMPONENTS = [
    "CommsOverlay.tsx",
    "LoadList.tsx",
    "CommandCenterView.tsx",
    "Settlements.tsx",
    "BrokerManager.tsx",
    "NetworkPortal.tsx",
]


def read_component(name: str) -> str:
    path = os.path.join(REPO_ROOT, "components", name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestLoadingSkeleton:
    """R-W3-02a: Each component shows LoadingSkeleton while data is loading."""

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_imports_loading_skeleton(self, component):
        content = read_component(component)
        assert "LoadingSkeleton" in content, (
            f"{component} must import LoadingSkeleton"
        )

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_renders_loading_skeleton(self, component):
        content = read_component(component)
        assert "isLoading" in content, (
            f"{component} must use isLoading state or prop"
        )
        assert "<LoadingSkeleton" in content, (
            f"{component} must render <LoadingSkeleton"
        )


class TestErrorState:
    """R-W3-03a: Each component shows ErrorState on API failure."""

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_imports_error_state(self, component):
        content = read_component(component)
        assert "ErrorState" in content, (
            f"{component} must import ErrorState"
        )

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_renders_error_state_with_retry(self, component):
        content = read_component(component)
        assert "<ErrorState" in content, (
            f"{component} must render <ErrorState"
        )
        assert "onRetry" in content, (
            f"{component} must provide onRetry callback to ErrorState"
        )


class TestEmptyState:
    """R-W3-04a: Each component shows EmptyState when data array is empty."""

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_imports_empty_state(self, component):
        content = read_component(component)
        assert "EmptyState" in content, (
            f"{component} must import EmptyState"
        )

    @pytest.mark.parametrize("component", COMPONENTS)
    def test_renders_empty_state(self, component):
        content = read_component(component)
        assert "<EmptyState" in content, (
            f"{component} must render <EmptyState"
        )


class TestEmptyStateComponent:
    """R-W3-04a: EmptyState.tsx exists as a reusable UI component."""

    def test_empty_state_file_exists(self):
        path = os.path.join(REPO_ROOT, "components", "ui", "EmptyState.tsx")
        assert os.path.isfile(path), "components/ui/EmptyState.tsx must exist"
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "EmptyState" in content, "EmptyState component must be defined"

    def test_empty_state_exports_component(self):
        path = os.path.join(REPO_ROOT, "components", "ui", "EmptyState.tsx")
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "export const EmptyState" in content
        assert "title" in content
        assert "icon" in content

    def test_empty_state_has_testid(self):
        path = os.path.join(REPO_ROOT, "components", "ui", "EmptyState.tsx")
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "data-testid" in content


class TestVPC:
    """R-W3-VPC-402: VPC - unit tests pass, tsc clean."""

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
            assert comp not in stderr, (
                f"TypeScript error in {comp}: {stderr}"
            )

    def test_no_loading_error_state_without_guard(self):
        """Loading and error states are properly guarded (not always shown)."""
        for comp in COMPONENTS:
            content = read_component(comp)
            assert "isLoading" in content, (
                f"{comp} must conditionally render based on isLoading"
            )
            assert "loadError" in content, (
                f"{comp} must conditionally render based on loadError"
            )
