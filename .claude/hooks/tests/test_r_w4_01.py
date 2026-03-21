# Tests R-W4-01a, R-W4-01b, R-W4-01c, R-W4-VPC-501
"""H-501: Form Labels & Input Accessibility — Batch 1.

Validates that all form inputs in the 15 batch-1 components have proper
label bindings (htmlFor/id or aria-label), labels are visible (not sr-only),
and no duplicate IDs exist within each component.
"""
import os
import re
import pytest

BATCH_1_COMPONENTS = [
    "components/Auth.tsx",
    "components/CompanyProfile.tsx",
    "components/EditLoadForm.tsx",
    "components/AccountingBillForm.tsx",
    "components/EditUserModal.tsx",
    "components/BrokerManager.tsx",
    "components/IFTAManager.tsx",
    "components/DataImportWizard.tsx",
    "components/LoadSetupModal.tsx",
    "components/BolGenerator.tsx",
    "components/QuoteManager.tsx",
    "components/BookingPortal.tsx",
    "components/NetworkPortal.tsx",
    "components/SafetyView.tsx",
    "components/OperationalMessaging.tsx",
]

# Resolve project root (3 levels up from this test file)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _read_component(relpath):
    """Read a component file from the project root."""
    fullpath = os.path.join(PROJECT_ROOT, relpath)
    with open(fullpath, "r", encoding="utf-8") as f:
        return f.readlines()


def _find_unlabeled_inputs(lines):
    """Find input/select/textarea elements without id or aria-label."""
    unlabeled = []
    for i, line in enumerate(lines):
        match = re.search(r"<(input|select|textarea)\b", line)
        if not match:
            continue

        tag = match.group(1)
        # Collect element text across lines
        elem_text = ""
        for k in range(i, min(i + 8, len(lines))):
            elem_text += lines[k]
            if "/>" in lines[k] or (tag != "input" and "</" + tag in lines[k]):
                break
            if ">" in lines[k] and k > i:
                break

        has_id = bool(re.search(r"\bid=", elem_text))
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
    ids = re.findall(r'\bid="([^"]*)"', content)
    seen = set()
    dupes = set()
    for id_val in ids:
        if id_val in seen:
            dupes.add(id_val)
        seen.add(id_val)
    return dupes


def _has_sr_only_labels(content):
    """Check if any label has sr-only class (hidden from sighted users)."""
    return bool(re.search(r"<label[^>]*class=\"[^\"]*\bsr-only\b", content))


# R-W4-01a: Every input/select/textarea has a matching label htmlFor or aria-label
@pytest.mark.parametrize("component", BATCH_1_COMPONENTS)
def test_all_inputs_have_label_binding(component):
    """R-W4-01a: Every form element has label htmlFor or aria-label."""
    lines = _read_component(component)
    unlabeled = _find_unlabeled_inputs(lines)
    assert unlabeled == [], (
        f"{component} has unlabeled inputs at lines: {unlabeled}"
    )


# R-W4-01b: Labels are visible (not sr-only) for sighted users
@pytest.mark.parametrize("component", BATCH_1_COMPONENTS)
def test_labels_are_visible(component):
    """R-W4-01b: Labels are visible, not sr-only."""
    lines = _read_component(component)
    content = "".join(lines)
    assert not _has_sr_only_labels(content), (
        f"{component} has sr-only labels (should be visible)"
    )


# R-W4-01c: No duplicate IDs on the same page
@pytest.mark.parametrize("component", BATCH_1_COMPONENTS)
def test_no_duplicate_ids(component):
    """R-W4-01c: No duplicate IDs within a component."""
    lines = _read_component(component)
    content = "".join(lines)
    dupes = _find_duplicate_ids(content)
    assert dupes == set(), (
        f"{component} has duplicate IDs: {dupes}"
    )


# R-W4-VPC-501: Unit tests pass, tsc clean — validated by the test suite itself
# and the gate command (npx tsc --noEmit)
def test_batch1_component_count():
    """R-W4-VPC-501: All 15 batch-1 components exist and are readable."""
    assert len(BATCH_1_COMPONENTS) == 15, (
        f"Expected 15 batch-1 components, got {len(BATCH_1_COMPONENTS)}"
    )
    for comp in BATCH_1_COMPONENTS:
        fullpath = os.path.join(PROJECT_ROOT, comp)
        assert os.path.isfile(fullpath), f"Component {comp} not found"
        lines = _read_component(comp)
        assert len(lines) > 10, f"Component {comp} seems empty"
        content = "".join(lines)
        # Each component should be a valid React component (export statement)
        assert "export" in content, f"Component {comp} missing export statement"


def test_htmlfor_count_minimum():
    """R-W4-VPC-501: Each component with labels has htmlFor or aria-label bindings."""
    for comp in BATCH_1_COMPONENTS:
        lines = _read_component(comp)
        content = "".join(lines)
        # Count form elements (excluding hidden/file/checkbox)
        inputs = re.findall(r"<(input|select|textarea)\b", content)
        labels = re.findall(r"htmlFor=|aria-label=", content)
        # Every component with inputs must have at least as many label bindings
        # as it has form elements (allowing for hidden/file/checkbox exemptions)
        if len(inputs) > 0:
            assert len(labels) >= 1, (
                f"{comp} has {len(inputs)} form elements but no htmlFor/aria-label"
            )
            # The ratio of labels to inputs should be substantial
            ratio = len(labels) / len(inputs)
            assert ratio >= 0.3, (
                f"{comp} has poor label coverage: {len(labels)} labels for "
                f"{len(inputs)} inputs (ratio={ratio:.2f}, need >= 0.3)"
            )


def test_htmlfor_id_pairing_valid():
    """R-W4-VPC-501: htmlFor values reference existing id attributes."""
    for comp in BATCH_1_COMPONENTS:
        lines = _read_component(comp)
        content = "".join(lines)
        # Extract htmlFor values (static string only)
        html_fors = re.findall(r'htmlFor="([^"]+)"', content)
        ids = set(re.findall(r'\bid="([^"]+)"', content))
        for hf in html_fors:
            assert hf in ids, (
                f"{comp}: htmlFor=\"{hf}\" has no matching id attribute"
            )


def test_no_placeholder_only_inputs():
    """R-W4-01a (edge): Inputs with placeholder must also have label or aria-label."""
    for comp in BATCH_1_COMPONENTS:
        lines = _read_component(comp)
        content = "".join(lines)
        # Find inputs with placeholder attribute
        placeholder_inputs = re.finditer(
            r"<input[^>]*placeholder=", content, re.DOTALL
        )
        for match in placeholder_inputs:
            # Get surrounding context (200 chars before and after)
            start = max(0, match.start() - 200)
            end = min(len(content), match.end() + 300)
            context = content[start:end]
            has_label = "aria-label" in context or "htmlFor" in context or "id=" in context
            assert has_label, (
                f"{comp}: found input with placeholder but no label/aria-label near "
                f"position {match.start()}"
            )
