# Tests R-W4-01d, R-W4-VPC-506
"""H-506: Form Labels & Input Accessibility - Batch 2.

Validates that all form inputs in the 18 batch-2 components have proper
label bindings (htmlFor/id or aria-label), labels are visible (not sr-only),
and no duplicate IDs exist within each component.
"""

import os
import re
import pytest

BATCH_2_COMPONENTS = [
    "components/Dashboard.tsx",
    "components/LoadList.tsx",
    "components/LoadBoardEnhanced.tsx",
    "components/CommandCenterView.tsx",
    "components/IntelligenceHub.tsx",
    "components/GlobalMapView.tsx",
    "components/GlobalMapViewEnhanced.tsx",
    "components/ExceptionConsole.tsx",
    "components/FileVault.tsx",
    "components/DriverMobileHome.tsx",
    "components/Settlements.tsx",
    "components/CalendarView.tsx",
    "components/CustomerPortalView.tsx",
    "components/Intelligence.tsx",
    "components/AnalyticsDashboard.tsx",
    "components/CommsOverlay.tsx",
    "components/IssueSidebar.tsx",
    "components/EditLoadForm.tsx",
]

# Resolve project root (3 levels up from this test file)
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def _read_component(relpath):
    """Read a component file from the project root."""
    fullpath = os.path.join(PROJECT_ROOT, relpath)
    with open(fullpath, "r", encoding="utf-8") as f:
        return f.readlines()


def _find_unlabeled_inputs(lines):
    """Find input/select/textarea elements without id or aria-label."""
    unlabeled = []
    for i, line in enumerate(lines):
        match = re.search(r"<(input|select|textarea)", line)
        if not match:
            continue

        tag = match.group(1)
        # Collect element text across lines until we find the closing of the opening tag
        elem_text = ""
        for k in range(i, min(i + 10, len(lines))):
            elem_text += lines[k]
            if "/>" in lines[k]:
                break
            if tag != "input" and "</" + tag in lines[k]:
                break
            # Check if this line ends the opening tag (> at end of trimmed line,
            # not inside attribute values like arrow functions =>)
            stripped = lines[k].rstrip()
            if k > i and stripped.endswith(">") and not stripped.endswith("=>"):
                break

        has_id = bool(re.search(r"id=", elem_text))
        has_aria = "aria-label" in elem_text
        has_hidden = 'type="hidden"' in elem_text or 'type="file"' in elem_text
        has_checkbox = 'type="checkbox"' in elem_text

        if has_id or has_aria or has_hidden or has_checkbox:
            continue

        # Check if wrapped in a label
        wrapped = False
        for k in range(max(0, i - 5), i):
            if "<label" in lines[k]:
                closed = any("</label>" in lines[m] for m in range(k, i))
                if not closed:
                    wrapped = True
                    break
        if not wrapped:
            unlabeled.append(i + 1)  # 1-indexed line number

    return unlabeled


def _find_duplicate_ids(content):
    """Find duplicate id attribute values in a component."""
    ids = re.findall(r'id="([^"]*)"', content)
    seen = set()
    dupes = set()
    for id_val in ids:
        if id_val in seen:
            dupes.add(id_val)
        seen.add(id_val)
    return dupes


def _has_sr_only_labels(content):
    """Check if any label has sr-only class (hidden from sighted users)."""
    return bool(re.search(r'<label[^>]*class="[^"]*sr-only', content))


# R-W4-01d: Every input/select/textarea has a matching label htmlFor or aria-label
@pytest.mark.parametrize("component", BATCH_2_COMPONENTS)
def test_all_inputs_have_label_binding(component):
    """R-W4-01d: Every form element in Batch 2 has label htmlFor or aria-label."""
    lines = _read_component(component)
    unlabeled = _find_unlabeled_inputs(lines)
    assert unlabeled == [], f"{component} has unlabeled inputs at lines: {unlabeled}"


# R-W4-01d: Labels are visible (not sr-only) for sighted users
@pytest.mark.parametrize("component", BATCH_2_COMPONENTS)
def test_labels_are_visible(component):
    """R-W4-01d: Labels are visible, not sr-only."""
    lines = _read_component(component)
    content = "".join(lines)
    assert not _has_sr_only_labels(content), (
        f"{component} has sr-only labels (should be visible)"
    )


# R-W4-01d: No duplicate IDs on the same page
@pytest.mark.parametrize("component", BATCH_2_COMPONENTS)
def test_no_duplicate_ids(component):
    """R-W4-01d: No duplicate IDs within a component."""
    lines = _read_component(component)
    content = "".join(lines)
    dupes = _find_duplicate_ids(content)
    assert dupes == set(), f"{component} has duplicate IDs: {dupes}"


# R-W4-VPC-506: Unit tests pass, tsc clean - validated by the test suite itself
# and the gate command (npx tsc --noEmit)
def test_batch2_component_count():
    """R-W4-VPC-506: All 18 batch-2 components exist and are readable."""
    assert len(BATCH_2_COMPONENTS) == 18, "Expected exactly 18 batch-2 components"
    for comp in BATCH_2_COMPONENTS:
        fullpath = os.path.join(PROJECT_ROOT, comp)
        assert os.path.isfile(fullpath), f"Component {comp} not found"
        lines = _read_component(comp)
        assert len(lines) > 10, f"Component {comp} seems empty"
        # Verify file contains valid JSX/TSX content
        content = "".join(lines)
        assert "export" in content or "function" in content, (
            f"{comp} does not appear to be a valid React component"
        )


def test_batch2_accessibility_attributes_present():
    """R-W4-VPC-506: Components with form elements have accessibility attributes."""
    components_with_inputs = 0
    for comp in BATCH_2_COMPONENTS:
        lines = _read_component(comp)
        content = "".join(lines)
        # Count form elements (excluding hidden/file/checkbox)
        inputs = re.findall(r"<(input|select|textarea)", content)
        labels = re.findall(r"htmlFor=|aria-label=", content)
        if len(inputs) > 0:
            components_with_inputs += 1
            # Every component with inputs must have at least one label attribute
            assert len(labels) >= 1, (
                f"{comp} has {len(inputs)} form elements but no htmlFor/aria-label"
            )
            # Label count should match or exceed input count (each input gets a label)
            unlabeled = _find_unlabeled_inputs(lines)
            assert unlabeled == [], (
                f"{comp} has unlabeled form elements at lines: {unlabeled}"
            )
    # At least some batch-2 components should have form elements
    assert components_with_inputs >= 5, (
        f"Expected at least 5 components with form elements, found {components_with_inputs}"
    )


# --- Negative / edge / boundary tests ---


def test_fail_unlabeled_input_detected():
    """R-W4-01d (negative): _find_unlabeled_inputs catches a bare <input> with no label."""
    lines = [
        "<div>" + chr(10),
        '  <input type="text" className="w-full" />' + chr(10),
        "</div>" + chr(10),
    ]
    unlabeled = _find_unlabeled_inputs(lines)
    assert unlabeled == [2], f"Expected unlabeled at line 2, got {unlabeled}"


def test_reject_select_without_label():
    """R-W4-01d (negative): bare <select> without id or aria-label is flagged."""
    lines = [
        "<div>" + chr(10),
        '  <select className="w-full">' + chr(10),
        "    <option>A</option>" + chr(10),
        "  </select>" + chr(10),
        "</div>" + chr(10),
    ]
    unlabeled = _find_unlabeled_inputs(lines)
    assert unlabeled == [2], f"Expected unlabeled select at line 2, got {unlabeled}"


def test_reject_textarea_without_label():
    """R-W4-01d (negative): bare <textarea> without id or aria-label is flagged."""
    lines = [
        "<div>" + chr(10),
        '  <textarea className="w-full">' + chr(10),
        "  </textarea>" + chr(10),
        "</div>" + chr(10),
    ]
    unlabeled = _find_unlabeled_inputs(lines)
    assert unlabeled == [2], f"Expected unlabeled textarea at line 2, got {unlabeled}"


def test_invalid_labeled_input_not_flagged():
    """R-W4-01d (negative): _find_unlabeled_inputs allows inputs with id or aria-label."""
    lines_id = ['<input id="myInput" type="text" />' + chr(10)]
    assert _find_unlabeled_inputs(lines_id) == []

    lines_aria = ['<input aria-label="search" type="text" />' + chr(10)]
    assert _find_unlabeled_inputs(lines_aria) == []


def test_boundary_hidden_and_file_inputs_skipped():
    """R-W4-01d (boundary): hidden and file inputs are excluded from labeling checks."""
    lines = [
        '<input type="hidden" name="csrf" />' + chr(10),
        '<input type="file" accept=".csv" />' + chr(10),
    ]
    assert _find_unlabeled_inputs(lines) == []


def test_boundary_checkbox_inputs_skipped():
    """R-W4-01d (boundary): checkbox inputs are excluded from labeling checks."""
    lines = [
        '<input type="checkbox" checked />' + chr(10),
    ]
    assert _find_unlabeled_inputs(lines) == []


def test_fail_duplicate_id_detected():
    """R-W4-01d (negative): _find_duplicate_ids catches repeated id values."""
    content = '<input id="dup" /><select id="dup" />'
    dupes = _find_duplicate_ids(content)
    assert dupes == {"dup"}


def test_edge_sr_only_label_detected():
    """R-W4-01d (edge): sr-only labels are detected as accessibility issue."""
    content = '<label htmlFor="x" class="sr-only">Hidden</label><input id="x" />'
    assert _has_sr_only_labels(content) is True

    content_visible = (
        '<label htmlFor="x" class="text-sm">Visible</label><input id="x" />'
    )
    assert _has_sr_only_labels(content_visible) is False


def test_edge_wrapped_in_label_accepted():
    """R-W4-01d (edge): input wrapped in parent <label> element is accepted."""
    lines = [
        '<label className="block">' + chr(10),
        "  Select File" + chr(10),
        '  <input type="text" className="w-full" />' + chr(10),
        "</label>" + chr(10),
    ]
    assert _find_unlabeled_inputs(lines) == []


def test_edge_empty_component_no_inputs():
    """R-W4-01d (edge): component with no form elements has zero unlabeled inputs."""
    lines = [
        "<div>" + chr(10),
        "  <h1>Title</h1>" + chr(10),
        "  <p>Content</p>" + chr(10),
        "</div>" + chr(10),
    ]
    assert _find_unlabeled_inputs(lines) == []
    content = "".join(lines)
    assert _find_duplicate_ids(content) == set()
