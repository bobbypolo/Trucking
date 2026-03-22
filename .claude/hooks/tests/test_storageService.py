# Tests storageService (STORY-106: remove STORAGE_KEY_NOTIFICATION_JOBS re-export)
"""
Minimal traceability test for the storageService.ts re-export cleanup.
The main notification job tests are in test_r_p1_24_26.py.
"""
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
STORAGE_SERVICE_TS = REPO / "services" / "storageService.ts"


def test_storageService_no_notification_key_export():
    """storageService.ts does not re-export STORAGE_KEY_NOTIFICATION_JOBS after STORY-106."""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "STORAGE_KEY_NOTIFICATION_JOBS" not in content, (
        "storageService.ts must not re-export STORAGE_KEY_NOTIFICATION_JOBS (removed in STORY-106)"
    )


def test_storageService_still_exports_notification_functions():
    """storageService.ts still re-exports getRawNotificationJobs and saveNotificationJob."""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "getRawNotificationJobs" in content, (
        "storageService.ts must still export getRawNotificationJobs"
    )
    assert "saveNotificationJob" in content, (
        "storageService.ts must still export saveNotificationJob"
    )
