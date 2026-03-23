# Tests R-P1-24, R-P1-25, R-P1-26
"""
QA traceability markers for STORY-106: Migrate notifications.ts to API-only.

R-P1-24: No localStorage calls in services/storage/notifications.ts
R-P1-25: STORAGE_KEY_NOTIFICATION_JOBS constant removed
R-P1-26: saveNotificationJob is async and returns server response
"""
import re
import ast
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
NOTIFICATIONS_TS = REPO / "services" / "storage" / "notifications.ts"
INDEX_TS = REPO / "services" / "storage" / "index.ts"
STORAGE_SERVICE_TS = REPO / "services" / "storageService.ts"


def test_r_p1_24_no_localstorage_in_notifications():
    """R-P1-24: grep -rn 'localStorage' services/storage/notifications.ts returns 0 matches"""
    content = NOTIFICATIONS_TS.read_text(encoding="utf-8")
    matches = [
        line.strip()
        for line in content.splitlines()
        if "localStorage" in line
    ]
    assert matches == [], (
        f"R-P1-24 FAIL: found localStorage in notifications.ts:\n"
        + "\n".join(matches)
    )


def test_r_p1_25_storage_key_constant_removed():
    """R-P1-25: STORAGE_KEY_NOTIFICATION_JOBS constant removed from notifications.ts"""
    content = NOTIFICATIONS_TS.read_text(encoding="utf-8")
    assert "STORAGE_KEY_NOTIFICATION_JOBS" not in content, (
        "R-P1-25 FAIL: STORAGE_KEY_NOTIFICATION_JOBS still present in notifications.ts"
    )


def test_r_p1_25_storage_key_not_exported_from_index():
    """R-P1-25: STORAGE_KEY_NOTIFICATION_JOBS not exported from storage/index.ts"""
    content = INDEX_TS.read_text(encoding="utf-8")
    assert "STORAGE_KEY_NOTIFICATION_JOBS" not in content, (
        "R-P1-25 FAIL: STORAGE_KEY_NOTIFICATION_JOBS still exported from storage/index.ts"
    )


def test_r_p1_25_storage_key_not_in_storage_service():
    """R-P1-25: STORAGE_KEY_NOTIFICATION_JOBS not in storageService.ts"""
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "STORAGE_KEY_NOTIFICATION_JOBS" not in content, (
        "R-P1-25 FAIL: STORAGE_KEY_NOTIFICATION_JOBS still referenced in storageService.ts"
    )


def test_r_p1_26_save_notification_job_is_async():
    """R-P1-26: saveNotificationJob is declared as async function"""
    content = NOTIFICATIONS_TS.read_text(encoding="utf-8")
    # Must contain 'async' before 'saveNotificationJob'
    assert re.search(
        r"export\s+const\s+saveNotificationJob\s*=\s*async", content
    ), "R-P1-26 FAIL: saveNotificationJob is not declared as async"


def test_r_p1_26_save_notification_job_returns_server_response():
    """R-P1-26: saveNotificationJob returns res.json() (server response), no fire-and-forget"""
    content = NOTIFICATIONS_TS.read_text(encoding="utf-8")
    # Should await res.json() and return it
    assert "res.json()" in content or "await res.json()" in content, (
        "R-P1-26 FAIL: saveNotificationJob does not return res.json() (server response)"
    )
    # Must NOT silently swallow errors (no try/catch wrapping the fetch in saveNotificationJob)
    # The function body should propagate errors
    save_fn_match = re.search(
        r"saveNotificationJob\s*=\s*async[^=]*?=>.*?(?=\nexport|\Z)",
        content,
        re.DOTALL,
    )
    if save_fn_match:
        fn_body = save_fn_match.group(0)
        # Acceptable: throw on !res.ok; not acceptable: silent catch that returns job
        assert "throw" in fn_body or "rejects" in fn_body or "!res.ok" in fn_body, (
            "R-P1-26 FAIL: saveNotificationJob does not throw on failure"
        )


def test_r_p1_26_no_dual_write_pattern():
    """R-P1-26: No dual-write (localStorage + API) pattern in notifications.ts"""
    content = NOTIFICATIONS_TS.read_text(encoding="utf-8")
    # Must not set localStorage at all
    assert "localStorage.setItem" not in content, (
        "R-P1-26 FAIL: localStorage.setItem still present (dual-write pattern not removed)"
    )


def test_r_p1_25_storage_service_no_key_export():
    """R-P1-25: storageService.ts does not re-export STORAGE_KEY_NOTIFICATION_JOBS."""
    # This verifies the storageService re-export cleanup.
    # File path: services/storageService.ts (imported here for coverage check)
    import importlib.util
    # Structural check — no actual import needed since it's TypeScript
    content = STORAGE_SERVICE_TS.read_text(encoding="utf-8")
    assert "STORAGE_KEY_NOTIFICATION_JOBS" not in content, (
        "R-P1-25 FAIL: storageService.ts still exports STORAGE_KEY_NOTIFICATION_JOBS"
    )
