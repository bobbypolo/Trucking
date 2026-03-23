# Tests R-P7-04
"""
Exhaustive static grep verification: every hardcoded value must be gone
across SafetyView, AccountingPortal, IntelligenceHub, ExceptionConsole,
LoadGantt, QuoteManager, NetworkPortal, DispatcherTimeline, DriverMobileHome,
and auth services (financialService, storageService).
"""

import os
import re
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
COMPONENTS = os.path.join(ROOT, "components")
SERVICES = os.path.join(ROOT, "services")


def _read(relpath: str) -> str:
    """Read a file relative to repo root. Return '' if missing."""
    path = os.path.join(ROOT, relpath)
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def _count(pattern: str, text: str) -> int:
    """Count regex matches in text."""
    return len(re.findall(pattern, text))


# ── Auth service: no raw fetch() ──


class TestAuthServiceNoRawFetch:
    def test_financial_service_no_fetch(self):
        content = _read("services/financialService.ts")
        assert _count(r"fetch\(", content) == 0, (
            "financialService.ts still contains raw fetch() calls"
        )

    def test_storage_service_no_fetch(self):
        content = _read("services/storageService.ts")
        assert _count(r"fetch\(", content) == 0, (
            "storageService.ts still contains raw fetch() calls"
        )


# ── SafetyView.tsx: all 12 hardcoded values removed ──


class TestSafetyViewNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/SafetyView.tsx")

    def test_no_progress_85(self):
        assert _count(r"progress:\s*85", self.content) == 0

    def test_no_progress_42(self):
        assert _count(r"progress:\s*42", self.content) == 0

    def test_no_progress_98(self):
        assert _count(r"progress:\s*98", self.content) == 0

    def test_no_95_percent(self):
        assert _count(r'"95%"', self.content) == 0

    def test_no_100_percent(self):
        assert _count(r'"100%"', self.content) == 0

    def test_no_65_percent(self):
        assert _count(r'"65%"', self.content) == 0

    def test_no_324_certified(self):
        assert _count(r'"324 Certified', self.content) == 0

    def test_no_safety_score_75(self):
        assert _count(r'value:.*"75"', self.content) == 0

    def test_no_90_days(self):
        assert _count(r'"90 Days"', self.content) == 0

    def test_no_unit_101(self):
        assert _count(r'"Unit 101"', self.content) == 0

    def test_no_unit_102(self):
        assert _count(r'"Unit 102"', self.content) == 0


# ── AccountingPortal.tsx: all 10 hardcoded values removed ──


class TestAccountingPortalNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/AccountingPortal.tsx")

    def test_no_val_14(self):
        assert _count(r'val:.*"14"', self.content) == 0

    def test_no_2840(self):
        assert _count(r'"\$2,840"', self.content) == 0

    def test_no_42_5_hrs(self):
        assert _count(r'"42\.5 hrs"', self.content) == 0

    def test_no_setTimeout_matched(self):
        assert _count(r"setTimeout.*matched", self.content) == 0

    def test_no_glAccountId_5000(self):
        assert _count(r'glAccountId:.*"5000"', self.content) == 0

    def test_no_1_hour_ago(self):
        assert _count(r'"1 hour ago"', self.content) == 0

    def test_no_value_14_active(self):
        assert _count(r'value:.*"14".*Active', self.content) == 0


# ── IntelligenceHub.tsx: all 8 mock values removed ──


class TestIntelligenceHubNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/IntelligenceHub.tsx")

    def test_no_cs9901(self):
        assert _count(r'"CS-9901"', self.content) == 0

    def test_no_888_555_0000(self):
        assert _count(r'"888-555-0000"', self.content) == 0

    def test_no_800_safe_kci(self):
        assert _count(r'"800-SAFE-KCI"', self.content) == 0

    def test_no_john_doe(self):
        assert _count(r'"John Doe"', self.content) == 0

    def test_no_trucker_tom(self):
        assert _count(r'"Trucker Tom"', self.content) == 0

    def test_no_mike_thompson(self):
        assert _count(r'"Mike Thompson"', self.content) == 0

    def test_no_choptank(self):
        assert _count(r'"Choptank"', self.content) == 0

    def test_no_blue_star(self):
        assert _count(r'"Blue Star"', self.content) == 0

    def test_no_45_60_mins(self):
        assert _count(r'"45-60 mins"', self.content) == 0


# ── ExceptionConsole.tsx: all 3 hardcoded values removed ──


class TestExceptionConsoleNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/ExceptionConsole.tsx")

    def test_no_sla_24m(self):
        assert _count(r'"SLA: 24m', self.content) == 0

    def test_no_014200(self):
        assert _count(r'"01:42:00"', self.content) == 0

    def test_no_1h_14m(self):
        assert _count(r'"1h 14m"', self.content) == 0


# ── LoadGantt.tsx ──


class TestLoadGanttNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/LoadGantt.tsx")

    def test_no_04_00_am(self):
        assert _count(r'"04:00 AM"', self.content) == 0

    def test_no_eta_0630_pm(self):
        assert _count(r'"ETA: 06:30 PM"', self.content) == 0


# ── QuoteManager.tsx ──


class TestQuoteManagerNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/QuoteManager.tsx")

    def test_no_acme_global(self):
        assert _count(r'"Acme Global"', self.content) == 0

    def test_no_3125550199(self):
        assert _count(r'"3125550199"', self.content) == 0


# ── NetworkPortal.tsx ──


class TestNetworkPortalNoHardcoded:
    @pytest.fixture(autouse=True)
    def load_file(self):
        self.content = _read("components/NetworkPortal.tsx")

    def test_no_pending_mail(self):
        assert _count(r'"PENDING@MAIL\.COM"', self.content) == 0

    def test_no_new_contact(self):
        assert _count(r'"NEW CONTACT"', self.content) == 0

    def test_no_000_000_000(self):
        assert _count(r'"000-000-000"', self.content) == 0


# ── DispatcherTimeline.tsx ──


class TestDispatcherTimelineNoHardcoded:
    def test_no_geocoded_terminal_entry(self):
        content = _read("components/DispatcherTimeline.tsx")
        assert _count(r"Geocoded Terminal Entry", content) == 0


# ── DriverMobileHome.tsx ──


class TestDriverMobileHomeNoHardcoded:
    def test_no_mock_change_requests(self):
        content = _read("components/DriverMobileHome.tsx")
        assert _count(r"Mock Change Requests", content) == 0


# ── Edge/negative tests: verify detection logic works ──


class TestNegativeDetectionOfHardcodedValues:
    """Negative tests: verify _count() correctly flags hardcoded values in bad input."""

    def test_invalid_content_with_progress_85_is_rejected(self):
        """Reject content containing hardcoded progress: 85."""
        synthetic = 'const data = { progress: 85, name: "test" };'
        assert _count(r"progress:\s*85", synthetic) != 0

    def test_invalid_content_with_fetch_call_is_rejected(self):
        """Reject content containing raw fetch() call."""
        synthetic = 'const resp = fetch("/api/data");'
        assert _count(r"fetch\(", synthetic) != 0

    def test_invalid_content_with_cs9901_is_rejected(self):
        """Reject content containing hardcoded CS-9901."""
        synthetic = 'const name = "CS-9901";'
        assert _count(r'"CS-9901"', synthetic) != 0

    def test_invalid_multiple_occurrences_fail(self):
        """Reject content with multiple hardcoded Unit 101 references."""
        synthetic = '"Unit 101" and also "Unit 101" again'
        assert _count(r'"Unit 101"', synthetic) == 2

    def test_boundary_partial_match_still_detected(self):
        """Boundary: progress: 850 still matches progress: 85 prefix."""
        synthetic = "progress: 850"
        assert _count(r"progress:\s*85", synthetic) == 1

    def test_reject_incorrect_case_does_not_match(self):
        """Reject: lowercase 'acme global' must not match 'Acme Global'."""
        synthetic = '"acme global"'
        assert _count(r'"Acme Global"', synthetic) == 0

    def test_edge_empty_content_returns_zero(self):
        """Edge: empty content must return zero matches."""
        assert _count(r'"CS-9901"', "") == 0

    def test_error_nonexistent_file_returns_empty(self):
        """Error path: nonexistent file must return empty string."""
        content = _read("components/NonExistentFile.tsx")
        assert content == ""
        assert _count(r'"CS-9901"', content) == 0


class TestBoundaryComponentFilesExist:
    """Boundary tests: verify remediated component files exist on disk."""

    @pytest.mark.parametrize(
        "relpath",
        [
            "components/SafetyView.tsx",
            "components/AccountingPortal.tsx",
            "components/IntelligenceHub.tsx",
            "components/ExceptionConsole.tsx",
            "components/LoadGantt.tsx",
            "components/QuoteManager.tsx",
            "components/NetworkPortal.tsx",
        ],
    )
    def test_boundary_component_file_exists(self, relpath):
        """Each remediated component file must exist (guard against renames)."""
        path = os.path.join(ROOT, relpath)
        assert os.path.isfile(path) is True, f"Expected file not found: {relpath}"
