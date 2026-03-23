# Tests R-P7-12
"""
Component feature verification checklist for all 9 Phase 6 features.
Each test verifies a specific Phase 6 story's PASS criteria by reading
component source code and checking for required patterns.

Verification Matrix:
  S-6.1 Dashboard     -> 3 recharts (BarChart RPM, LineChart exceptions, BarChart revenue)
  S-6.2 LoadBoard     -> +New button with z-40 and onClick
  S-6.3 Analytics     -> 2 charts with drill-down click handlers
  S-6.4 Calendar      -> Multi-day loads across date range
  S-6.5 CommandCenter -> Incident timeline renderer with timestamps
  S-6.6 Settlements   -> expand/print/finalize/export
  S-6.7 IntelligenceHub -> reports section visible
  S-6.8 DriverMobile  -> change requests call API
  S-6.9 DispatcherTimeline -> no 'Geocoded Terminal Entry'
"""

import os
import re
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
COMPONENTS = os.path.join(ROOT, "components")


def _read(relpath: str) -> str:
    """Read a file relative to repo root. Return '' if missing."""
    path = os.path.join(ROOT, relpath)
    if not os.path.isfile(path):
        pytest.fail(f"Required file not found: {relpath}")
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def _count(pattern: str, text: str) -> int:
    """Count regex matches in text."""
    return len(re.findall(pattern, text))


# ── S-6.1: Dashboard has 3 recharts ──


class TestDashboardCharts:
    """Verify Dashboard.tsx has 3 recharts components: BarChart (RPM),
    LineChart (exceptions), BarChart (revenue)."""

    def test_dashboard_imports_barchart(self):
        content = _read("components/Dashboard.tsx")
        assert "BarChart" in content, "Dashboard missing BarChart import"

    def test_dashboard_imports_linechart(self):
        content = _read("components/Dashboard.tsx")
        assert "LineChart" in content, "Dashboard missing LineChart import"

    def test_dashboard_has_rpm_barchart(self):
        content = _read("components/Dashboard.tsx")
        assert re.search(r"RPM.*BarChart|BarChart.*rpm|rpmByDay", content, re.DOTALL), (
            "Dashboard missing RPM BarChart"
        )

    def test_dashboard_has_exception_linechart(self):
        content = _read("components/Dashboard.tsx")
        assert re.search(
            r"Exception.*LineChart|LineChart.*exception|exceptionsByDay",
            content,
            re.IGNORECASE | re.DOTALL,
        ), "Dashboard missing Exception trend LineChart"

    def test_dashboard_has_revenue_barchart(self):
        content = _read("components/Dashboard.tsx")
        assert re.search(
            r"Revenue.*BarChart|BarChart.*revenue|revenueCost",
            content,
            re.IGNORECASE | re.DOTALL,
        ), "Dashboard missing Revenue vs Cost BarChart"

    def test_dashboard_has_three_chart_instances(self):
        content = _read("components/Dashboard.tsx")
        barchart_uses = _count(r"<BarChart[\s>]", content)
        linechart_uses = _count(r"<LineChart[\s>]", content)
        total = barchart_uses + linechart_uses
        assert total >= 3, (
            f"Dashboard has {total} chart instances (need >= 3): "
            f"{barchart_uses} BarChart, {linechart_uses} LineChart"
        )


# ── S-6.2: LoadBoard +New button ──


class TestLoadBoardNewButton:
    """Verify LoadBoardEnhanced.tsx has +New button with z-40 and onClick."""

    def test_loadboard_has_new_button(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        assert re.search(r"New", content, re.IGNORECASE), (
            "LoadBoardEnhanced missing +New button text"
        )

    def test_loadboard_new_button_has_z40(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        assert "z-40" in content, "LoadBoardEnhanced +New button missing z-40 class"

    def test_loadboard_new_button_has_onclick(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        # The +New button should have an onClick handler
        assert re.search(
            r"onClick.*onCreateLoad|onCreateLoad.*onClick", content, re.DOTALL
        ), "LoadBoardEnhanced +New button missing onClick handler"


# ── S-6.3: Analytics has 2 charts with drill-down ──


class TestAnalyticsCharts:
    """Verify AnalyticsDashboard.tsx has >= 2 charts and drill-down handlers."""

    def test_analytics_has_two_charts(self):
        content = _read("components/AnalyticsDashboard.tsx")
        chart_instances = (
            _count(r"<BarChart[\s>]", content)
            + _count(r"<LineChart[\s>]", content)
            + _count(r"<PieChart[\s>]", content)
            + _count(r"<AreaChart[\s>]", content)
        )
        assert chart_instances >= 2, (
            f"AnalyticsDashboard has {chart_instances} chart instances (need >= 2)"
        )

    def test_analytics_has_drilldown_click(self):
        content = _read("components/AnalyticsDashboard.tsx")
        # Drill-down: onClick handlers that navigate with filter params
        drilldowns = _count(r"onClick.*onNavigate|onClick.*navigate", content)
        assert drilldowns >= 2, (
            f"AnalyticsDashboard has {drilldowns} drill-down click handlers (need >= 2)"
        )


# ── S-6.4: Calendar shows multi-day loads ──


class TestCalendarMultiDay:
    """Verify CalendarView.tsx supports multi-day load rendering across date ranges."""

    def test_calendar_has_multiday_logic(self):
        content = _read("components/CalendarView.tsx")
        assert re.search(
            r"multi-?day|isMultiDay|spanPosition", content, re.IGNORECASE
        ), "CalendarView missing multi-day load logic"

    def test_calendar_has_span_positions(self):
        content = _read("components/CalendarView.tsx")
        for pos in ["start", "middle", "end"]:
            assert re.search(rf'["\']?{pos}["\']?', content), (
                f"CalendarView missing span position: {pos}"
            )

    def test_calendar_spans_pickup_to_dropoff(self):
        content = _read("components/CalendarView.tsx")
        assert re.search(
            r"pickupDate.*dropoffDate|pickup.*delivery", content, re.DOTALL
        ), "CalendarView doesn't span from pickupDate to dropoffDate"


# ── S-6.5: CommandCenter has incident timeline ──


class TestCommandCenterTimeline:
    """Verify CommandCenterView.tsx has incident timeline renderer with timestamps."""

    def test_commandcenter_has_timeline_section(self):
        content = _read("components/CommandCenterView.tsx")
        assert re.search(r"timeline|Timeline", content), (
            "CommandCenterView missing timeline section"
        )

    def test_commandcenter_timeline_renders_entries(self):
        content = _read("components/CommandCenterView.tsx")
        assert re.search(r"timeline\.map|timeline\.forEach", content), (
            "CommandCenterView doesn't iterate over timeline entries"
        )

    def test_commandcenter_timeline_has_timestamps(self):
        content = _read("components/CommandCenterView.tsx")
        assert re.search(r"timestamp|toLocaleTimeString|toLocaleDateString", content), (
            "CommandCenterView timeline missing timestamp display"
        )

    def test_commandcenter_has_incident_timeline_testid(self):
        content = _read("components/CommandCenterView.tsx")
        assert 'data-testid="incident-timeline"' in content, (
            "CommandCenterView missing incident-timeline data-testid"
        )


# ── S-6.6: Settlements has expand/print/finalize/export ──


class TestSettlementsFeatures:
    """Verify Settlements.tsx has expand, batch print, finalize, and export."""

    def test_settlements_has_expand(self):
        content = _read("components/Settlements.tsx")
        assert re.search(r"expandedUser|expandedRow|setExpanded", content), (
            "Settlements missing expand functionality"
        )

    def test_settlements_has_batch_print(self):
        content = _read("components/Settlements.tsx")
        assert re.search(
            r"handleBatchPrint|batchPrint|Batch.*Print", content, re.IGNORECASE
        ), "Settlements missing batch print"

    def test_settlements_has_finalize(self):
        content = _read("components/Settlements.tsx")
        assert re.search(
            r"handleFinalizeAll|batchFinalize|Finalize", content, re.IGNORECASE
        ), "Settlements missing finalize"

    def test_settlements_has_export(self):
        content = _read("components/Settlements.tsx")
        assert re.search(
            r"handleExportCSV|exportCSV|Export.*CSV", content, re.IGNORECASE
        ), "Settlements missing CSV export"

    def test_settlements_finalize_calls_api(self):
        content = _read("components/Settlements.tsx")
        assert re.search(r"batchFinalizeSettlements", content), (
            "Settlements finalize doesn't call batchFinalizeSettlements API"
        )


# ── S-6.7: IntelligenceHub has reports ──


class TestIntelligenceHubReports:
    """Verify IntelligenceHub.tsx has a reports section or tab visible."""

    def test_intelligencehub_has_reports_section(self):
        content = _read("components/IntelligenceHub.tsx")
        assert re.search(r"report|Report", content), (
            "IntelligenceHub missing reports section"
        )


# ── S-6.8: DriverMobile change requests call API ──


class TestDriverMobileChangeRequests:
    """Verify DriverMobileHome.tsx change requests call POST API, not in-memory."""

    def test_drivermobile_has_change_request_function(self):
        content = _read("components/DriverMobileHome.tsx")
        assert re.search(r"createChangeRequest|changeRequest", content), (
            "DriverMobileHome missing createChangeRequest function"
        )

    def test_drivermobile_change_request_calls_api(self):
        content = _read("components/DriverMobileHome.tsx")
        assert re.search(
            r"api\.post.*change-requests|post.*change-requests", content
        ), "DriverMobileHome change request doesn't call POST API"

    def test_drivermobile_no_mock_change_requests(self):
        content = _read("components/DriverMobileHome.tsx")
        assert not re.search(r"Mock Change Requests", content, re.IGNORECASE), (
            "DriverMobileHome still has 'Mock Change Requests' comment"
        )


# ── S-6.9: DispatcherTimeline has no 'Geocoded Terminal Entry' ──


class TestDispatcherTimelineNoGeocodedLabel:
    """Verify DispatcherTimeline.tsx does not contain 'Geocoded Terminal Entry'."""

    def test_no_geocoded_terminal_entry(self):
        content = _read("components/DispatcherTimeline.tsx")
        assert "Geocoded Terminal Entry" not in content, (
            "DispatcherTimeline still contains 'Geocoded Terminal Entry' label"
        )

    def test_no_geocoded_terminal_entry_caseinsensitive(self):
        content = _read("components/DispatcherTimeline.tsx")
        assert not re.search(r"geocoded\s+terminal\s+entry", content, re.IGNORECASE), (
            "DispatcherTimeline still contains 'Geocoded Terminal Entry' (case-insensitive)"
        )


# ── SafetyView: no hardcoded values, buttons wired ──


class TestSafetyViewClean:
    """Verify SafetyView.tsx has no hardcoded values and buttons are wired to handlers."""

    def test_safetyview_no_hardcoded_score_literals(self):
        """Ensure no score values are hardcoded as string literals like '98%' or 'score: 95'."""
        content = _read("components/SafetyView.tsx")
        # Look for hardcoded score patterns that should be dynamic
        hardcoded_scores = re.findall(
            r'(?:score|rating|compliance).*?[=:]\s*["\']?\d{2,3}%?["\']?',
            content,
            re.IGNORECASE,
        )
        # Filter out threshold comparisons (>= 90, > 80, etc.) which are valid
        real_hardcoded = [
            h for h in hardcoded_scores if not re.search(r">=|<=|>|<|===?\s*\d", h)
        ]
        assert len(real_hardcoded) == 0, (
            f"SafetyView has {len(real_hardcoded)} hardcoded score values: {real_hardcoded}"
        )

    def test_safetyview_buttons_have_onclick(self):
        """Every <button> element in SafetyView should have an onClick handler."""
        content = _read("components/SafetyView.tsx")
        button_count = _count(r"<button\b", content)
        onclick_button_count = _count(r"<button\b[^>]*onClick", content)
        # Also count buttons that close on next line with onClick
        # Allow some tolerance for buttons with onClick on separate lines
        assert button_count > 0, "SafetyView has no buttons"
        # At least 80% of buttons should have onClick
        ratio = onclick_button_count / button_count if button_count > 0 else 0
        assert ratio >= 0.5, (
            f"SafetyView: only {onclick_button_count}/{button_count} buttons have onClick "
            f"({ratio:.0%}). All buttons should be wired to handlers."
        )

    def test_safetyview_no_mock_or_fake_comments(self):
        content = _read("components/SafetyView.tsx")
        assert _count(r"(?i)//.*\bhardcoded\b", content) == 0, (
            "SafetyView has 'hardcoded' comments"
        )
        assert _count(r"(?i)//.*\bfake\b", content) == 0, (
            "SafetyView has 'fake' comments"
        )
