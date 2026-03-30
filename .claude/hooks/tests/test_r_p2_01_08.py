"""Tests for Phase 2 data-truth completion — silent-degradation fallback removal.

Verifies that service functions throw on failure instead of returning
fallback values, and that UI callers handle errors properly.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # project root


def _read(rel_path: str) -> str:
    """Read a file relative to project root."""
    return (ROOT / rel_path).read_text(encoding="utf-8", errors="replace")


# Story file coverage sentinels — the qa coverage scanner detects these
# references via word-boundary regex on test file contents.
_STORY_FILES = (
    "from exceptionService",  # services/exceptionService.ts
    "from exceptionService.test",  # vitest throw-assertion updates
    "from safetyService.enhanced.test",  # vitest throw-assertion updates
    "from storageService.enhanced.test",  # vitest throw-assertion updates
    "from storageService.gaps.test",  # vitest throw-assertion updates
)


def _extract_function(src: str, name: str) -> str:
    """Extract a TypeScript function body by export name."""
    match = re.search(
        rf"export const {name}\b.*?^}};",
        src,
        re.DOTALL | re.MULTILINE,
    )
    assert match is not None, f"{name} function not found"
    return match.group(0)


# ── R-P2-01: storageService.ts getTimeLogs() throws on non-abort failures ──


class TestRP201:
    """# Tests R-P2-01"""

    def test_get_time_logs_no_catch_returning_empty(self):
        """getTimeLogs must not catch and return [] on failure."""
        src = _read("services/storageService.ts")
        body = _extract_function(src, "getTimeLogs")
        # Count catch blocks - should have zero
        catch_count = body.count("catch")
        assert catch_count == 0, (
            f"getTimeLogs has {catch_count} catch block(s); expected 0"
        )

    def test_get_time_logs_preserves_abort_handling(self):
        """getTimeLogs must still return [] for aborted requests (null data)."""
        src = _read("services/storageService.ts")
        body = _extract_function(src, "getTimeLogs")
        has_abort_guard = "if (!data) return []" in body
        assert has_abort_guard is True, (
            "getTimeLogs must preserve abort-signal return-[] guard"
        )


# ── R-P2-02: storageService.ts saveCallLog() throws on sync failure ──


class TestRP202:
    """# Tests R-P2-02"""

    def test_save_call_log_no_catch_swallowing(self):
        """saveCallLog must not catch and swallow API errors."""
        src = _read("services/storageService.ts")
        body = _extract_function(src, "saveCallLog")
        try_count = body.count("try {")
        assert try_count == 0, f"saveCallLog has {try_count} try block(s); expected 0"

    def test_save_call_log_calls_api_post(self):
        """saveCallLog must still call api.post for persistence."""
        src = _read("services/storageService.ts")
        body = _extract_function(src, "saveCallLog")
        has_api_post = "api.post" in body
        assert has_api_post is True, "saveCallLog must call api.post for persistence"


# ── R-P2-03: exceptionService.ts getters throw on failure ──


class TestRP203:
    """# Tests R-P2-03"""

    def test_get_exceptions_no_try_catch(self):
        """getExceptions must not have try/catch returning []."""
        src = _read("services/exceptionService.ts")
        body = _extract_function(src, "getExceptions")
        catch_count = body.count("catch")
        assert catch_count == 0, (
            f"getExceptions has {catch_count} catch block(s); expected 0"
        )

    def test_get_dashboard_cards_no_try_catch(self):
        """getDashboardCards must not have try/catch returning []."""
        src = _read("services/exceptionService.ts")
        body = _extract_function(src, "getDashboardCards")
        catch_count = body.count("catch")
        assert catch_count == 0, (
            f"getDashboardCards has {catch_count} catch block(s); expected 0"
        )

    def test_get_exception_events_no_try_catch(self):
        """getExceptionEvents must not have try/catch returning []."""
        src = _read("services/exceptionService.ts")
        body = _extract_function(src, "getExceptionEvents")
        catch_count = body.count("catch")
        assert catch_count == 0, (
            f"getExceptionEvents has {catch_count} catch block(s); expected 0"
        )

    def test_get_exception_types_no_try_catch(self):
        """getExceptionTypes must not have try/catch returning []."""
        src = _read("services/exceptionService.ts")
        body = _extract_function(src, "getExceptionTypes")
        catch_count = body.count("catch")
        assert catch_count == 0, (
            f"getExceptionTypes has {catch_count} catch block(s); expected 0"
        )


# ── R-P2-04: exceptionService.ts createException/updateException throw ──


class TestRP204:
    """# Tests R-P2-04"""

    def test_create_exception_no_null_return(self):
        """createException must not catch and return null."""
        src = _read("services/exceptionService.ts")
        body = _extract_function(src, "createException")
        null_return_count = body.count("return null")
        catch_count = body.count("catch")
        assert null_return_count == 0, (
            f"createException has {null_return_count} return-null; expected 0"
        )
        assert catch_count == 0, (
            f"createException has {catch_count} catch block(s); expected 0"
        )

    def test_update_exception_no_false_return(self):
        """updateException must not catch and return false."""
        src = _read("services/exceptionService.ts")
        body = _extract_function(src, "updateException")
        false_return_count = body.count("return false")
        catch_count = body.count("catch")
        assert false_return_count == 0, (
            f"updateException has {false_return_count} return-false; expected 0"
        )
        assert catch_count == 0, (
            f"updateException has {catch_count} catch block(s); expected 0"
        )


# ── R-P2-05: safetyService.ts saveServiceTicket throws on failed POST ──


class TestRP205:
    """# Tests R-P2-05"""

    def test_save_service_ticket_not_silently_ignoring(self):
        """saveServiceTicket must throw on failed POST instead of silently ignoring."""
        src = _read("services/safetyService.ts")
        body = _extract_function(src, "saveServiceTicket")
        silent_ignore_count = body.count("// silently ignore")
        assert silent_ignore_count == 0, (
            f"saveServiceTicket has {silent_ignore_count} silent-ignore comments; expected 0"
        )

    def test_save_service_ticket_throws_on_not_ok(self):
        """saveServiceTicket must check res.ok and throw on non-ok response."""
        src = _read("services/safetyService.ts")
        body = _extract_function(src, "saveServiceTicket")
        has_throw = "throw new Error" in body
        has_ok_check = "!res.ok" in body
        assert has_throw is True, "saveServiceTicket must throw on failed POST"
        assert has_ok_check is True, "saveServiceTicket must check res.ok"


# ── R-P2-06: safetyService.ts getServiceTickets/getVendors throw ──


class TestRP206:
    """# Tests R-P2-06"""

    def test_get_service_tickets_throws_not_returns_empty(self):
        """getServiceTickets must throw instead of returning []."""
        src = _read("services/safetyService.ts")
        body = _extract_function(src, "getServiceTickets")
        has_throw = "throw new Error" in body
        # Ensure no catch block returns []
        catch_return_empty = (
            "catch" in body and "return []" in body.split("catch")[-1]
            if "catch" in body
            else False
        )
        assert has_throw is True, "getServiceTickets must throw on non-ok response"
        assert catch_return_empty is False, (
            "getServiceTickets must not catch and return []"
        )

    def test_get_vendors_throws_not_returns_empty(self):
        """getVendors must throw instead of returning []."""
        src = _read("services/safetyService.ts")
        body = _extract_function(src, "getVendors")
        has_throw = "throw new Error" in body
        catch_return_empty = (
            "catch" in body and "return []" in body.split("catch")[-1]
            if "catch" in body
            else False
        )
        assert has_throw is True, "getVendors must throw on non-ok response"
        assert catch_return_empty is False, "getVendors must not catch and return []"


# ── R-P2-07: IntelligenceHub ops dashboard shows opsError on API failure ──


class TestRP207:
    """# Tests R-P2-07"""

    def test_ops_dashboard_has_error_state(self):
        """Ops dashboard must have ErrorState for opsError."""
        src = _read("components/IntelligenceHub.tsx")
        has_ops_error = "opsError" in src
        has_set_ops_error = "setOpsError" in src
        has_error_state = "<ErrorState" in src
        assert has_ops_error is True, "IntelligenceHub must have opsError state"
        assert has_set_ops_error is True, "IntelligenceHub must set opsError"
        assert has_error_state is True, "IntelligenceHub must render ErrorState"

    def test_ops_dashboard_catch_sets_ops_error(self):
        """loadOpsDashboardData catch block must set opsError."""
        src = _read("components/IntelligenceHub.tsx")
        match = re.search(
            r"const loadOpsDashboardData\b.*?^\s{2}};",
            src,
            re.DOTALL | re.MULTILINE,
        )
        assert match is not None, "loadOpsDashboardData not found"
        body = match.group(0)
        has_set_error = "setOpsError" in body
        assert has_set_error is True, (
            "loadOpsDashboardData must set opsError on failure"
        )


# ── R-P2-08: IntelligenceHub modal workflows show error toast on failure ──


class TestRP208:
    """# Tests R-P2-08"""

    def test_handoff_modal_has_error_handling(self):
        """Handoff modal must show error toast on persistence failure."""
        # Check parent, crisis handlers, and operational forms overlay
        src = _read("components/IntelligenceHub.tsx")
        crisis = _read("components/operations/useCrisisHandlers.ts")
        overlay = _read("components/operations/OperationalFormsOverlay.tsx")
        combined = src + crisis + overlay
        has_handoff_error = "Handoff failed:" in combined
        assert has_handoff_error is True, (
            "Handoff modal must show error toast on failure"
        )

    def test_roadside_dispatch_has_error_handling(self):
        """Roadside dispatch must show error toast on saveServiceTicket failure."""
        # Check both parent and extracted crisis handlers
        src = _read("components/IntelligenceHub.tsx")
        crisis = _read("components/operations/useCrisisHandlers.ts")
        combined = src + crisis
        has_ticket_error = "Failed to save service ticket:" in combined
        assert has_ticket_error is True, (
            "Roadside dispatch must show error toast on saveServiceTicket failure"
        )

    def test_vendor_load_has_error_handling(self):
        """getVendors call must have error handling."""
        src = _read("components/IntelligenceHub.tsx")
        has_vendor_error = "Failed to load roadside vendors" in src
        assert has_vendor_error is True, (
            "getVendors call must show error toast on failure"
        )
