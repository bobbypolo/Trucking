# Tests R-W5-04a, R-W5-04b, R-W5-04c, R-W5-VPC-603
"""
H-603: AbortController for API Requests
Validates that apiFetch() accepts/forwards signal, the 3 highest-traffic
components wire AbortController in useEffect cleanup, and AbortError is
silently caught in apiFetch.

Covers: api.ts, Dashboard.tsx, IntelligenceHub.tsx, CommandCenterView.tsx
"""
import subprocess
import re
import pytest


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ---- R-W5-04a: apiFetch() accepts and forwards signal parameter ----


def test_api_fetch_destructures_signal():
    """R-W5-04a: apiFetch destructures signal from options."""
    content = _read("F:/Trucking/DisbatchMe/services/api.ts")
    assert re.search(
        r"const\s*\{[^}]*signal[^}]*\}\s*=\s*options",
        content,
    ), "apiFetch must destructure signal from options"


def test_api_fetch_passes_signal_to_fetch():
    """R-W5-04a: apiFetch passes signal to the fetch() call."""
    content = _read("F:/Trucking/DisbatchMe/services/api.ts")
    assert re.search(
        r"signal\s*\?\s*\{\s*signal\s*\}",
        content,
    ), "apiFetch must conditionally pass signal to fetch()"


def test_api_convenience_methods_accept_signal():
    """R-W5-04a: api.get/post/patch/delete accept optional signal via ApiFetchOptions."""
    content = _read("F:/Trucking/DisbatchMe/services/api.ts")
    assert "ApiFetchOptions" in content, (
        "api.ts must define ApiFetchOptions interface"
    )
    for method in ["get", "post", "patch", "delete"]:
        assert re.search(
            rf"{method}:\s*\([^)]*opts\??\s*:\s*ApiFetchOptions",
            content,
        ), f"api.{method} must accept optional ApiFetchOptions parameter"


# ---- R-W5-04b: Dashboard, IntelligenceHub, CommandCenterView pass AbortSignal ----


def test_dashboard_abort_controller():
    """R-W5-04b: Dashboard creates AbortController and aborts in useEffect cleanup."""
    content = _read("F:/Trucking/DisbatchMe/components/Dashboard.tsx")
    assert "new AbortController()" in content, (
        "Dashboard must create AbortController"
    )
    assert "controller.abort()" in content, (
        "Dashboard must call controller.abort() in cleanup"
    )


def test_intelligence_hub_abort_controller():
    """R-W5-04b: IntelligenceHub creates AbortController and aborts in useEffect cleanup."""
    content = _read("F:/Trucking/DisbatchMe/components/IntelligenceHub.tsx")
    assert "new AbortController()" in content, (
        "IntelligenceHub must create AbortController"
    )
    assert "controller.abort()" in content, (
        "IntelligenceHub must call controller.abort() in cleanup"
    )


def test_command_center_view_abort_controller():
    """R-W5-04b: CommandCenterView creates AbortController and aborts in useEffect cleanup."""
    content = _read("F:/Trucking/DisbatchMe/components/CommandCenterView.tsx")
    assert "new AbortController()" in content, (
        "CommandCenterView must create AbortController"
    )
    assert "controller.abort()" in content, (
        "CommandCenterView must call controller.abort() in cleanup"
    )


# ---- R-W5-04c: AbortError silently caught in apiFetch ----


def test_abort_error_silently_caught_in_api_fetch():
    """R-W5-04c: apiFetch catches AbortError and returns undefined (no throw)."""
    content = _read("F:/Trucking/DisbatchMe/services/api.ts")
    assert "AbortError" in content, (
        "apiFetch must check for AbortError"
    )
    assert "return undefined" in content, (
        "apiFetch must return undefined on AbortError (silently swallow)"
    )


def test_components_also_guard_abort_error():
    """R-W5-04c: Components guard against AbortError as defense-in-depth."""
    for component, name in [
        ("F:/Trucking/DisbatchMe/components/Dashboard.tsx", "Dashboard"),
        ("F:/Trucking/DisbatchMe/components/IntelligenceHub.tsx", "IntelligenceHub"),
        ("F:/Trucking/DisbatchMe/components/CommandCenterView.tsx", "CommandCenterView"),
    ]:
        content = _read(component)
        assert "AbortError" in content, (
            f"{name} must check for AbortError as defense-in-depth"
        )


# ---- R-W5-VPC-603: VPC - unit tests pass, tsc clean ----


def test_vpc_tsc_clean():
    """R-W5-VPC-603: tsc --noEmit produces no errors on changed files."""
    result = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
        shell=True,
        encoding="utf-8",
        errors="replace",
    )
    changed_files = [
        "api.ts",
        "Dashboard.tsx",
        "IntelligenceHub.tsx",
        "CommandCenterView.tsx",
    ]
    for f in changed_files:
        assert f not in result.stderr and f not in result.stdout, (
            f"tsc error found in {f}:\n{result.stdout}\n{result.stderr}"
        )


def test_vpc_unit_tests_pass():
    """R-W5-VPC-603: Vitest unit tests pass for api.ts."""
    result = subprocess.run(
        "npx vitest run src/__tests__/services/api.test.ts",
        capture_output=True,
        text=True,
        cwd="F:/Trucking/DisbatchMe",
        shell=True,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"API unit tests must pass:\n{result.stdout}\n{result.stderr}"
    )
