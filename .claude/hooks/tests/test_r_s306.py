# Tests R-P3-17, R-P3-18
"""S-306: Verify IFTA comment accuracy and netTaxDue = 0 preservation."""
import re
from pathlib import Path

import pytest

DISPATCH_INTEL = Path(__file__).resolve().parents[3] / "services" / "dispatchIntelligence.ts"


@pytest.fixture
def file_content():
    """Read the dispatchIntelligence.ts file content once per test."""
    return DISPATCH_INTEL.read_text(encoding="utf-8")


# --- R-P3-17: Comment accuracy tests ---


def test_comment_references_ifta_summary_endpoint(file_content):
    """R-P3-17: Comment must reference the server endpoint URL."""
    assert "/api/accounting/ifta-summary" in file_content, (
        "Comment must reference /api/accounting/ifta-summary endpoint"
    )


def test_comment_describes_per_state_calculation(file_content):
    """R-P3-17: Comment must describe per-state or per-jurisdiction calculation."""
    matches = re.findall(r"per.state|per.jurisdiction", file_content, re.IGNORECASE)
    assert len(matches) >= 2, (
        f"Comment should describe per-state calculation in detail (found {len(matches)} mentions, need >= 2)"
    )


def test_comment_references_mileage_jurisdiction_table(file_content):
    """R-P3-17: Comment must reference the mileage_jurisdiction data source."""
    assert "mileage_jurisdiction" in file_content, (
        "Comment must reference the mileage_jurisdiction table"
    )


def test_comment_references_fuel_ledger_table(file_content):
    """R-P3-17: Comment must reference the fuel_ledger data source."""
    assert "fuel_ledger" in file_content, (
        "Comment must reference the fuel_ledger table"
    )


def test_comment_mentions_tax_rates(file_content):
    """R-P3-17: Comment must mention tax rates as part of the calculation."""
    assert re.search(r"tax.rate", file_content, re.IGNORECASE), (
        "Comment must mention tax rates"
    )


def test_comment_describes_net_tax_formula(file_content):
    """R-P3-17: Comment must describe the netTaxDue aggregation formula."""
    assert "taxDue" in file_content, (
        "Comment must mention taxDue in the calculation description"
    )
    assert "taxPaidAtPump" in file_content, (
        "Comment must mention taxPaidAtPump in the net calculation"
    )


def test_jsdoc_describes_client_side_role(file_content):
    """R-P3-17: JSDoc must describe the client-side role (analytics, not tax calc)."""
    # The JSDoc should not claim to do full reconciliation
    jsdoc_match = re.search(
        r"/\*\*\s*\n\s*\*\s*IFTA Intelligence:([^*]*(?:\*(?!/)[^*]*)*)\*/",
        file_content,
    )
    assert jsdoc_match, "reconcileIFTATax must have a JSDoc comment"
    jsdoc_text = jsdoc_match.group(0)
    # Should mention client-side or analytics role
    assert re.search(r"client.side|analytics|discrepancy.alerts", jsdoc_text, re.IGNORECASE), (
        "JSDoc should describe client-side analytics role, not full reconciliation"
    )


# --- R-P3-18: netTaxDue = 0 preservation tests ---


def test_net_tax_due_is_zero(file_content):
    """R-P3-18: netTaxDue must be explicitly assigned to 0."""
    match = re.search(r"const\s+netTaxDue\s*=\s*(\d+)\s*;", file_content)
    assert match, "netTaxDue assignment not found"
    assert match.group(1) == "0", (
        f"netTaxDue must be 0, got {match.group(1)}"
    )


def test_ifta_audit_interface_has_net_tax_due(file_content):
    """R-P3-18: IFTAAudit interface must include netTaxDue field."""
    assert re.search(r"netTaxDue:\s*number", file_content), (
        "IFTAAudit interface must have netTaxDue: number field"
    )


def test_return_object_includes_net_tax_due(file_content):
    """R-P3-18: Return statement must include netTaxDue in the returned object."""
    # Find the return block and verify netTaxDue is returned
    return_match = re.search(
        r"return\s*\{[^}]*netTaxDue[^}]*\}", file_content, re.DOTALL
    )
    assert return_match, (
        "Return object in reconcileIFTATax must include netTaxDue"
    )


# --- Edge / error case tests ---


def test_file_exists():
    """Edge: Verify the target file exists at expected path."""
    assert DISPATCH_INTEL.exists(), (
        f"dispatchIntelligence.ts not found at {DISPATCH_INTEL}"
    )


def test_no_stub_implementation_markers(file_content):
    """Edge: No TODO or stub markers in the IFTA comment block."""
    # Extract the comment block around netTaxDue
    ifta_section = re.search(
        r"(// Net IFTA.*?const netTaxDue)", file_content, re.DOTALL
    )
    assert ifta_section, "IFTA comment block not found"
    comment_text = ifta_section.group(1)
    assert "TODO" not in comment_text, "IFTA comment must not contain TODO markers"
    assert "FIXME" not in comment_text, "IFTA comment must not contain FIXME markers"
    assert "stub" not in comment_text.lower(), "IFTA comment must not reference stubs"


def test_comment_not_outdated_client_side_claim(file_content):
    """Edge: Comment must NOT claim client-side performs tax calculation."""
    # The old comment said 'Reconciles fuel purchases against states traveled'
    # which implied client-side reconciliation -- this should be gone from the JSDoc
    jsdoc_match = re.search(
        r"/\*\*\s*\n\s*\*\s*IFTA Intelligence:([^*]*(?:\*(?!/)[^*]*)*)\*/",
        file_content,
    )
    assert jsdoc_match, "reconcileIFTATax must have a JSDoc comment"
    jsdoc_text = jsdoc_match.group(0)
    assert "Reconciles fuel purchases against states traveled" not in jsdoc_text, (
        "JSDoc must not use the old misleading description"
    )
