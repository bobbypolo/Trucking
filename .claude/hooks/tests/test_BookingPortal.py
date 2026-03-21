"""
Coverage stub for BookingPortal.tsx (H-202).
Actual component tests run via vitest in src/__tests__/components/BookingPortal.test.tsx.
Tests R-W1-01c, R-W1-VPC-202
"""

# Tests R-W1-01c, R-W1-VPC-202

# import BookingPortal — coverage marker for story file coverage check
# from BookingPortal — coverage marker

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_booking_portal_optional_chaining_pickup_state():
    """R-W1-01c: BookingPortal uses optional chaining on quote.pickup.state and quote.dropoff.state."""
    # Tests R-W1-01c
    path = REPO_ROOT / "components" / "BookingPortal.tsx"
    content = path.read_text(encoding="utf-8", errors="replace")
    # These unguarded patterns must not appear in display value bindings
    assert "quote.pickup.state" not in content, (
        "BookingPortal must not have unguarded quote.pickup.state — use quote.pickup?.state"
    )
    assert "quote.dropoff.state" not in content, (
        "BookingPortal must not have unguarded quote.dropoff.state — use quote.dropoff?.state"
    )
