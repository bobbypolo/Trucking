# Tests R-P1-30, R-P1-31, R-P1-32
# Traceability file - main assertions in test_brokerService.py
# storageService.ts was updated to import getBrokers (async) instead of getRawBrokers
from pathlib import Path

REPO = Path("__file__".replace("__file__", __file__)).resolve().parents[3]
STORAGE_SERVICE_TS = REPO / "services" / "storageService.ts"


def test_storageService_no_getRawBrokers_import():
    """storageService.ts must not import getRawBrokers after STORY-108 migration."""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "getRawBrokers" not in content, (
        "storageService.ts must not import getRawBrokers after STORY-108 (use getBrokers instead)"
    )


def test_storageService_uses_getBrokers():
    """storageService.ts imports getBrokers (async API) not getRawBrokers (localStorage)."""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "getBrokers" in content, (
        "storageService.ts must use getBrokers (async API) instead of getRawBrokers (R-P1-30)"
    )
