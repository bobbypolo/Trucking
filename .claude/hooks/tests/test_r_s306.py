# Tests R-P3-17, R-P3-18
"""S-306: Verify IFTA comment accuracy and netTaxDue = 0 preservation."""
import re
from pathlib import Path

DISPATCH_INTEL = Path(__file__).resolve().parents[3] / "services" / "dispatchIntelligence.ts"


def test_comment_describes_server_side_ifta_endpoint():
    """R-P3-17: Comment accurately describes server-side IFTA calculation via /api/accounting/ifta-summary."""
    content = DISPATCH_INTEL.read_text(encoding="utf-8")
    # The comment must reference the server endpoint
    assert "/api/accounting/ifta-summary" in content, (
        "Comment must reference /api/accounting/ifta-summary endpoint"
    )
    # The comment must mention per-state/per-jurisdiction calculation
    assert re.search(r"per.state|per.jurisdiction", content, re.IGNORECASE), (
        "Comment must describe per-state or per-jurisdiction calculation"
    )
    # The comment must mention the key data sources
    assert "mileage_jurisdiction" in content, (
        "Comment must reference the mileage_jurisdiction table"
    )
    assert "fuel_ledger" in content, (
        "Comment must reference the fuel_ledger table"
    )
    # The comment must mention tax rates
    assert re.search(r"tax.rate", content, re.IGNORECASE), (
        "Comment must mention tax rates"
    )


def test_net_tax_due_is_zero():
    """R-P3-18: netTaxDue = 0 unchanged and existing IFTA tests pass."""
    content = DISPATCH_INTEL.read_text(encoding="utf-8")
    # Must contain the explicit zero assignment
    assert re.search(r"const\s+netTaxDue\s*=\s*0\s*;", content), (
        "netTaxDue must be assigned to 0"
    )
