# Tests R-P2-06, R-P2-07, R-P2-08, R-P2-09
"""
S-202: Twilio SMS integration in notification delivery service.

Validates that the notification-delivery.service.ts properly integrates
Twilio for SMS sending with graceful fallback when not configured.
"""
import subprocess
import pytest


def test_r_p2_06_sms_sends_via_twilio():
    """R-P2-06: SMS channel sends via Twilio when configured, returns SENT with message SID."""
    result = subprocess.run(
        ["npx", "vitest", "run", "__tests__/services/notification-delivery-sms.service.test.ts"],
        capture_output=True, text=True, cwd="server", shell=True, timeout=60,
        encoding="utf-8", errors="replace"
    )
    assert result.returncode == 0, f"SMS Twilio tests failed:\n{result.stdout}\n{result.stderr}"
    assert "sends SMS via Twilio and returns SENT with message SID" not in result.stderr or "FAIL" not in result.stdout


def test_r_p2_07_missing_twilio_config():
    """R-P2-07: Missing Twilio config returns { status: FAILED, sync_error: Twilio not configured }."""
    result = subprocess.run(
        ["npx", "vitest", "run", "__tests__/services/notification-delivery-sms.service.test.ts"],
        capture_output=True, text=True, cwd="server", shell=True, timeout=60,
        encoding="utf-8", errors="replace"
    )
    assert result.returncode == 0, f"Missing Twilio config tests failed:\n{result.stdout}\n{result.stderr}"


def test_r_p2_08_recipients_without_phone_skipped():
    """R-P2-08: Recipients without phone numbers are skipped, not errored."""
    result = subprocess.run(
        ["npx", "vitest", "run", "__tests__/services/notification-delivery-sms.service.test.ts"],
        capture_output=True, text=True, cwd="server", shell=True, timeout=60,
        encoding="utf-8", errors="replace"
    )
    assert result.returncode == 0, f"Phone skip tests failed:\n{result.stdout}\n{result.stderr}"


def test_r_p2_09_email_regression():
    """R-P2-09: Existing email delivery tests still pass unchanged (regression)."""
    result = subprocess.run(
        ["npx", "vitest", "run", "__tests__/services/notification-delivery.service.test.ts"],
        capture_output=True, text=True, cwd="server", shell=True, timeout=60,
        encoding="utf-8", errors="replace"
    )
    assert result.returncode == 0, f"Email regression tests failed:\n{result.stdout}\n{result.stderr}"
