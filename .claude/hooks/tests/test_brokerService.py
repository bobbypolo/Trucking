# Tests R-P1-30, R-P1-31, R-P1-32
"""
STORY-108: Verify brokerService.ts has been fully migrated to API-only (no localStorage).
R-P1-30: no localStorage in brokerService.ts
R-P1-31: BROKERS_KEY constant removed
R-P1-32: saveBroker does not write to localStorage
"""
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
BROKER_SERVICE_TS = REPO / "services" / "brokerService.ts"


def test_r_p1_30_no_localstorage_in_brokerService():
    """R-P1-30: grep -rn localStorage services/brokerService.ts returns 0 matches."""
    content = BROKER_SERVICE_TS.read_text(encoding="utf-8")
    assert "localStorage" not in content, (
        "brokerService.ts must not contain localStorage references (R-P1-30)"
    )


def test_r_p1_31_brokers_key_removed():
    """R-P1-31: BROKERS_KEY constant removed from brokerService.ts."""
    content = BROKER_SERVICE_TS.read_text(encoding="utf-8")
    assert "BROKERS_KEY" not in content, (
        "BROKERS_KEY constant must be removed from brokerService.ts (R-P1-31)"
    )


def test_r_p1_32_saveBroker_api_only():
    """R-P1-32: saveBroker does not write to localStorage."""
    content = BROKER_SERVICE_TS.read_text(encoding="utf-8")
    # saveBroker must exist
    assert "export const saveBroker" in content, (
        "saveBroker must be exported from brokerService.ts (R-P1-32)"
    )
    # Must not reference localStorage anywhere
    assert "localStorage" not in content, (
        "saveBroker must not call localStorage.setItem (R-P1-32)"
    )
    # getRawBrokers (localStorage-based) must not be present
    assert "getRawBrokers" not in content, (
        "getRawBrokers (localStorage-based) must be removed from brokerService.ts (R-P1-32)"
    )
