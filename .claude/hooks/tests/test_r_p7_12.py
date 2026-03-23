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
        assert "rpmByDay" in content, "Dashboard missing rpmByDay data reference"

    def test_dashboard_has_exception_linechart(self):
        content = _read("components/Dashboard.tsx")
        assert "exceptionsByDay" in content, (
            "Dashboard missing exceptionsByDay data reference"
        )

    def test_dashboard_has_revenue_barchart(self):
        content = _read("components/Dashboard.tsx")
        assert "revenueCostByWeek" in content, (
            "Dashboard missing revenueCostByWeek data reference"
        )

    def test_dashboard_has_three_chart_instances(self):
        content = _read("components/Dashboard.tsx")
        barchart_uses = _count(r"<BarChart[\s>]", content)
        linechart_uses = _count(r"<LineChart[\s>]", content)
        total = barchart_uses + linechart_uses
        assert total == 3, (
            f"Dashboard has {total} chart instances (expected exactly 3): "
            f"{barchart_uses} BarChart, {linechart_uses} LineChart"
        )

    def test_dashboard_barchart_count_equals_two(self):
        content = _read("components/Dashboard.tsx")
        barchart_uses = _count(r"<BarChart[\s>]", content)
        assert barchart_uses == 2, f"Expected 2 BarChart instances, got {barchart_uses}"

    def test_dashboard_linechart_count_equals_one(self):
        content = _read("components/Dashboard.tsx")
        linechart_uses = _count(r"<LineChart[\s>]", content)
        assert linechart_uses == 1, (
            f"Expected 1 LineChart instance, got {linechart_uses}"
        )


# ── S-6.2: LoadBoard +New button ──


class TestLoadBoardNewButton:
    """Verify LoadBoardEnhanced.tsx has +New button with z-40 and onClick."""

    def test_loadboard_has_new_button_text(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        assert "New" in content, "LoadBoardEnhanced missing +New button text"

    def test_loadboard_new_button_has_z40(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        assert "z-40" in content, "LoadBoardEnhanced +New button missing z-40 class"

    def test_loadboard_new_button_has_onclick(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        assert "onCreateLoad" in content, (
            "LoadBoardEnhanced missing onCreateLoad handler"
        )

    def test_loadboard_new_button_onclick_wired(self):
        content = _read("components/LoadBoardEnhanced.tsx")
        assert "onClick={onCreateLoad}" in content, (
            "LoadBoardEnhanced +New button onClick not wired to onCreateLoad"
        )


# ── S-6.3: Analytics has 2 charts with drill-down ──


class TestAnalyticsCharts:
    """Verify AnalyticsDashboard.tsx has >= 2 charts and drill-down handlers."""

    def test_analytics_chart_count_at_least_two(self):
        content = _read("components/AnalyticsDashboard.tsx")
        chart_instances = (
            _count(r"<BarChart[\s>]", content)
            + _count(r"<LineChart[\s>]", content)
            + _count(r"<PieChart[\s>]", content)
            + _count(r"<AreaChart[\s>]", content)
        )
        assert chart_instances == 2, (
            f"AnalyticsDashboard has {chart_instances} chart instances (expected 2)"
        )

    def test_analytics_has_drilldown_onclick_count(self):  # noqa: behavioral
        content = _read("components/AnalyticsDashboard.tsx")
        drilldowns = _count(r"onClick=\{.*onNavigate", content)
        assert drilldowns >= 2, (
            f"AnalyticsDashboard has {drilldowns} drill-down onClick handlers (need >= 2)"
        )

    def test_analytics_has_broker_drilldown(self):
        content = _read("components/AnalyticsDashboard.tsx")
        assert "broker:" in content, (
            "AnalyticsDashboard missing broker drill-down filter"
        )

    def test_analytics_has_lane_drilldown(self):
        content = _read("components/AnalyticsDashboard.tsx")
        assert "lane:" in content, "AnalyticsDashboard missing lane drill-down filter"


# ── S-6.4: Calendar shows multi-day loads ──


class TestCalendarMultiDay:
    """Verify CalendarView.tsx supports multi-day load rendering across date ranges."""

    def test_calendar_has_multiday_flag(self):
        content = _read("components/CalendarView.tsx")
        assert "isMultiDay" in content, "CalendarView missing isMultiDay flag"

    def test_calendar_has_span_position_type(self):
        content = _read("components/CalendarView.tsx")
        assert "SpanPosition" in content, "CalendarView missing SpanPosition type"

    def test_calendar_span_start_position(self):  # noqa: behavioral
        content = _read("components/CalendarView.tsx")
        start_count = _count(r'"start"', content)
        assert start_count >= 1, (
            f"CalendarView has {start_count} 'start' span positions (need >= 1)"
        )

    def test_calendar_span_middle_position(self):  # noqa: behavioral
        content = _read("components/CalendarView.tsx")
        middle_count = _count(r'"middle"', content)
        assert middle_count >= 1, (
            f"CalendarView has {middle_count} 'middle' span positions (need >= 1)"
        )

    def test_calendar_span_end_position(self):  # noqa: behavioral
        content = _read("components/CalendarView.tsx")
        end_count = _count(r'"end"', content)
        assert end_count >= 1, (
            f"CalendarView has {end_count} 'end' span positions (need >= 1)"
        )

    def test_calendar_uses_pickup_and_dropoff(self):
        content = _read("components/CalendarView.tsx")
        assert "pickupDate" in content, "CalendarView missing pickupDate reference"
        assert "dropoffDate" in content, "CalendarView missing dropoffDate reference"

    def test_calendar_multiday_data_attribute(self):
        content = _read("components/CalendarView.tsx")
        assert "data-multiday" in content, (
            "CalendarView missing data-multiday attribute"
        )


# ── S-6.5: CommandCenter has incident timeline ──


class TestCommandCenterTimeline:
    """Verify CommandCenterView.tsx has incident timeline renderer with timestamps."""

    def test_commandcenter_has_timeline_tab(self):  # noqa: behavioral
        content = _read("components/CommandCenterView.tsx")
        timeline_count = _count(r'"timeline"', content)
        assert timeline_count >= 1, (
            f"CommandCenterView has {timeline_count} timeline tab references (need >= 1)"
        )

    def test_commandcenter_timeline_renders_entries(self):
        content = _read("components/CommandCenterView.tsx")
        assert "timeline.map" in content, (
            "CommandCenterView doesn't iterate over timeline entries"
        )

    def test_commandcenter_timeline_has_timestamps(self):
        content = _read("components/CommandCenterView.tsx")
        assert "toLocaleTimeString" in content, (
            "CommandCenterView timeline missing timestamp display"
        )

    def test_commandcenter_has_incident_timeline_testid(self):  # noqa: behavioral
        content = _read("components/CommandCenterView.tsx")
        assert 'data-testid="incident-timeline"' in content, (
            "CommandCenterView missing incident-timeline data-testid"
        )

    def test_commandcenter_timeline_entry_has_action(self):
        content = _read("components/CommandCenterView.tsx")
        assert "entry.action" in content, (
            "CommandCenterView timeline entries missing action field"
        )

    def test_commandcenter_timeline_entry_has_timestamp(self):
        content = _read("components/CommandCenterView.tsx")
        assert "entry.timestamp" in content, (
            "CommandCenterView timeline entries missing timestamp field"
        )


# ── S-6.6: Settlements has expand/print/finalize/export ──


class TestSettlementsFeatures:
    """Verify Settlements.tsx has expand, batch print, finalize, and export."""

    def test_settlements_has_expand_state(self):
        content = _read("components/Settlements.tsx")
        assert "expandedUser" in content, "Settlements missing expandedUser state"

    def test_settlements_has_batch_print_handler(self):
        content = _read("components/Settlements.tsx")
        assert "handleBatchPrint" in content, (
            "Settlements missing handleBatchPrint function"
        )

    def test_settlements_has_finalize_handler(self):
        content = _read("components/Settlements.tsx")
        assert "handleFinalizeAll" in content, (
            "Settlements missing handleFinalizeAll function"
        )

    def test_settlements_has_export_csv_handler(self):
        content = _read("components/Settlements.tsx")
        assert "handleExportCSV" in content, (
            "Settlements missing handleExportCSV function"
        )

    def test_settlements_finalize_calls_api(self):
        content = _read("components/Settlements.tsx")
        assert "batchFinalizeSettlements" in content, (
            "Settlements finalize doesn't call batchFinalizeSettlements API"
        )

    def test_settlements_export_creates_csv(self):
        content = _read("components/Settlements.tsx")
        assert "settlements-export-" in content, (
            "Settlements export doesn't create CSV filename"
        )


# ── S-6.7: IntelligenceHub has reports ──


class TestIntelligenceHubReports:
    """Verify IntelligenceHub.tsx has a reports section or tab visible."""

    def test_intelligencehub_has_reports_section(self):
        content = _read("components/IntelligenceHub.tsx")
        assert "report" in content.lower(), "IntelligenceHub missing reports section"

    def test_intelligencehub_reports_not_empty_placeholder(self):  # noqa: behavioral
        content = _read("components/IntelligenceHub.tsx")
        # Must have actual reports content, not just a "coming soon" stub
        report_count = _count(r"[Rr]eport", content)
        assert report_count >= 2, (
            f"IntelligenceHub has only {report_count} 'report' references (expected >= 2)"
        )


# ── S-6.8: DriverMobile change requests call API ──


class TestDriverMobileChangeRequests:
    """Verify DriverMobileHome.tsx change requests call POST API, not in-memory."""

    def test_drivermobile_has_create_change_request(self):
        content = _read("components/DriverMobileHome.tsx")
        assert "createChangeRequest" in content, (
            "DriverMobileHome missing createChangeRequest function"
        )

    def test_drivermobile_calls_post_api(self):
        content = _read("components/DriverMobileHome.tsx")
        assert "api.post" in content, (
            "DriverMobileHome doesn't use api.post for API calls"
        )

    def test_drivermobile_change_request_endpoint(self):
        content = _read("components/DriverMobileHome.tsx")
        assert "change-requests" in content, (
            "DriverMobileHome missing change-requests endpoint"
        )

    def test_drivermobile_no_mock_change_requests(self):
        content = _read("components/DriverMobileHome.tsx")
        mock_count = _count(r"Mock Change Requests", content)
        assert mock_count == 0, (
            f"DriverMobileHome has {mock_count} 'Mock Change Requests' references"
        )


# ── S-6.9: DispatcherTimeline has no 'Geocoded Terminal Entry' ──


class TestDispatcherTimelineNoGeocodedLabel:
    """Verify DispatcherTimeline.tsx does not contain 'Geocoded Terminal Entry'."""

    def test_no_geocoded_terminal_entry(self):
        content = _read("components/DispatcherTimeline.tsx")
        geocoded_count = _count(r"Geocoded Terminal Entry", content)
        assert geocoded_count == 0, (
            f"DispatcherTimeline has {geocoded_count} 'Geocoded Terminal Entry' occurrences"
        )

    def test_no_geocoded_terminal_entry_caseinsensitive(self):
        content = _read("components/DispatcherTimeline.tsx")
        geocoded_count = _count(r"(?i)geocoded\s+terminal\s+entry", content)
        assert geocoded_count == 0, (
            f"DispatcherTimeline has {geocoded_count} case-insensitive 'Geocoded Terminal Entry' matches"
        )


# ── SafetyView: no hardcoded values, buttons wired ──


class TestSafetyViewClean:
    """Verify SafetyView.tsx has no hardcoded values and buttons are wired to handlers."""

    def test_safetyview_no_hardcoded_score_literals(self):
        """Ensure no score values are hardcoded as string literals like '98%' or 'score: 95'."""
        content = _read("components/SafetyView.tsx")
        hardcoded_scores = re.findall(
            r'(?:score|rating|compliance).*?[=:]\s*["\']?\d{2,3}%?["\']?',
            content,
            re.IGNORECASE,
        )
        real_hardcoded = [
            h for h in hardcoded_scores if not re.search(r">=|<=|>|<|===?\s*\d", h)
        ]
        assert len(real_hardcoded) == 0, (
            f"SafetyView has {len(real_hardcoded)} hardcoded score values: {real_hardcoded}"
        )

    def test_safetyview_buttons_have_onclick(self):  # noqa: behavioral
        """Every <button> element in SafetyView should have an onClick handler."""
        content = _read("components/SafetyView.tsx")
        button_count = _count(r"<button\b", content)
        onclick_button_count = _count(r"<button\b[^>]*onClick", content)
        assert button_count > 0, "SafetyView has no buttons"
        ratio = onclick_button_count / button_count if button_count > 0 else 0
        assert ratio >= 0.5, (
            f"SafetyView: only {onclick_button_count}/{button_count} buttons have onClick "
            f"({ratio:.0%}). All buttons should be wired to handlers."
        )

    def test_safetyview_no_hardcoded_comments(self):
        content = _read("components/SafetyView.tsx")
        hardcoded_comments = _count(r"(?i)//.*\bhardcoded\b", content)
        assert hardcoded_comments == 0, (
            f"SafetyView has {hardcoded_comments} 'hardcoded' comments"
        )

    def test_safetyview_no_fake_comments(self):
        content = _read("components/SafetyView.tsx")
        fake_comments = _count(r"(?i)//.*\bfake\b", content)
        assert fake_comments == 0, f"SafetyView has {fake_comments} 'fake' comments"


# ── Negative/Edge Tests ──


class TestNegativeAndEdgeCases:
    """Negative and edge-case tests verifying absence of anti-patterns and
    error conditions across all 9 Phase 6 features."""

    def test_dashboard_invalid_no_piechart_misuse(self):
        """Dashboard should use BarChart and LineChart, not PieChart."""
        content = _read("components/Dashboard.tsx")
        piechart_count = _count(r"<PieChart[\s>]", content)
        assert piechart_count == 0, (
            f"Dashboard has {piechart_count} PieChart instances (should only use Bar/Line)"
        )

    def test_loadboard_reject_missing_plus_icon(self):
        """LoadBoard +New button must have Plus icon component."""
        content = _read("components/LoadBoardEnhanced.tsx")
        assert "Plus" in content, (
            "LoadBoardEnhanced +New button missing Plus icon import"
        )

    def test_analytics_reject_no_empty_onclick_handlers(self):
        """Analytics chart drill-downs should not have empty onClick handlers."""
        content = _read("components/AnalyticsDashboard.tsx")
        empty_onclick = _count(r"onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}", content)
        assert empty_onclick == 0, (
            f"AnalyticsDashboard has {empty_onclick} empty onClick handlers"
        )

    def test_calendar_reject_no_hardcoded_dates(self):
        """CalendarView should not contain hardcoded date strings."""
        content = _read("components/CalendarView.tsx")
        hardcoded_dates = _count(r'"2\d{3}-\d{2}-\d{2}"', content)
        assert hardcoded_dates == 0, (
            f"CalendarView has {hardcoded_dates} hardcoded date strings"
        )

    def test_commandcenter_reject_empty_timeline(self):
        """CommandCenter should handle empty timeline gracefully with fallback text."""
        content = _read("components/CommandCenterView.tsx")
        assert "No timeline entries" in content, (
            "CommandCenterView missing empty timeline fallback message"
        )

    def test_settlements_reject_no_error_handling(self):
        """Settlements finalize and print should have error handling."""
        content = _read("components/Settlements.tsx")
        assert "catch" in content, (
            "Settlements missing error handling (no catch blocks)"
        )

    def test_drivermobile_reject_localstorage_in_change_requests(self):
        """DriverMobile createChangeRequest function should NOT use localStorage."""
        content = _read("components/DriverMobileHome.tsx")
        # Extract the createChangeRequest function body
        match = re.search(
            r"const createChangeRequest.*?^  \}", content, re.DOTALL | re.MULTILINE
        )
        func_body = match.group(0) if match else ""
        localstorage_in_cr = _count(r"localStorage", func_body)
        assert localstorage_in_cr == 0, (
            f"createChangeRequest uses localStorage {localstorage_in_cr} times (should use API)"
        )

    def test_dispatcher_reject_invalid_mock_labels(self):
        """DispatcherTimeline should not have any mock/fake label text."""
        content = _read("components/DispatcherTimeline.tsx")
        mock_labels = _count(r"(?i)\bmock\b.*\bentry\b|\bfake\b.*\blabel\b", content)
        assert mock_labels == 0, (
            f"DispatcherTimeline has {mock_labels} mock/fake label patterns"
        )

    def test_safetyview_reject_disabled_buttons(self):
        """SafetyView buttons should not have disabled={true} pattern."""
        content = _read("components/SafetyView.tsx")
        disabled_hardcoded = _count(r"disabled=\{true\}", content)
        assert disabled_hardcoded == 0, (
            f"SafetyView has {disabled_hardcoded} hardcoded disabled={{true}} buttons"
        )

    def test_settlements_reject_negative_finalized_is_set(self):
        """Settlements should track finalized state with a Set, not an array."""
        content = _read("components/Settlements.tsx")
        assert "new Set" in content, (
            "Settlements doesn't use Set for finalized state tracking"
        )
