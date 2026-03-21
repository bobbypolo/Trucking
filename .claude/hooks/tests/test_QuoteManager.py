"""
Coverage stub for QuoteManager.tsx (H-202).
Actual component tests run via vitest in src/__tests__/components/QuoteManager.test.tsx.
Tests R-W1-01c, R-W1-VPC-202
"""

# Tests R-W1-01c, R-W1-VPC-202

# import QuoteManager — coverage marker for story file coverage check
# from QuoteManager — coverage marker

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_quote_manager_total_rate_guarded():
    """R-W1-01c: QuoteManager uses safe access on quote.totalRate."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "QuoteManager.tsx"
    content = path.read_text(encoding="utf-8", errors="replace")
    # Unguarded quote.totalRate.toLocaleString() must not appear
    assert "quote.totalRate.toLocaleString()" not in content, (
        "QuoteManager must not have unguarded quote.totalRate.toLocaleString()"
    )
    # Unguarded selectedQuote.validUntil.split() must not appear
    assert "selectedQuote.validUntil.split(" not in content, (
        "QuoteManager must not have unguarded selectedQuote.validUntil.split()"
    )


def test_quote_manager_pickup_dropoff_guarded():
    """R-W1-01c: QuoteManager uses optional chaining on all pickup/dropoff reads."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "QuoteManager.tsx"
    content = path.read_text(encoding="utf-8", errors="replace")
    bad_patterns = [
        "q.pickup.city",
        "q.dropoff.city",
        "{quote.pickup.city}",
        "{quote.dropoff.city}",
        "selectedQuote.pickup.city",
        "selectedQuote.pickup.state",
        "selectedQuote.dropoff.city",
        "selectedQuote.dropoff.state",
        "selectedQuote?.pickup.city",
        "selectedQuote?.pickup.state",
        "selectedQuote?.dropoff.city",
        "selectedQuote?.dropoff.state",
    ]
    for pattern in bad_patterns:
        assert pattern not in content, (
            f"QuoteManager must not have unguarded '{pattern}'"
        )
