"""
Tests R-W7-01a, R-W7-01b, R-W7-02a, R-W7-02b, R-W7-VPC-801

H-801: Email Delivery Service
Implement notification delivery service using nodemailer replacing
console.log stubs. Verify sendEmail() exports, SMTP fallback, and
route integration with deliverNotification().
"""

# Tests R-W7-01a, R-W7-01b, R-W7-02a, R-W7-02b, R-W7-VPC-801

import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

SERVICE_FILE = "server/services/notification-delivery.service.ts"
ROUTE_FILE = "server/routes/notification-jobs.ts"
TEST_FILE = "server/__tests__/services/notification-delivery.service.test.ts"


def _read(relpath: str) -> str:
    """Read file relative to repo root."""
    p = REPO_ROOT / relpath
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8", errors="replace")


class TestRW701aServiceExports:
    """R-W7-01a: notification-delivery.service.ts exports sendEmail() with nodemailer."""

    def test_service_file_exists(self):
        assert (REPO_ROOT / SERVICE_FILE).exists(), f"{SERVICE_FILE} must exist"

    def test_exports_send_email(self):
        src = _read(SERVICE_FILE)
        assert "export async function sendEmail" in src or "export function sendEmail" in src, (
            "sendEmail must be exported"
        )

    def test_imports_nodemailer(self):
        src = _read(SERVICE_FILE)
        assert "nodemailer" in src, "Must import nodemailer"

    def test_uses_create_transport(self):
        src = _read(SERVICE_FILE)
        assert "createTransport" in src, "Must use nodemailer.createTransport"

    def test_reads_smtp_env_vars(self):
        src = _read(SERVICE_FILE)
        for var in ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]:
            assert var in src, f"Must read {var} from environment"


class TestRW701bSmtpFallback:
    """R-W7-01b: sendEmail() falls back to console.log when SMTP not configured."""

    def test_checks_smtp_configured(self):
        src = _read(SERVICE_FILE)
        assert "SMTP_HOST" in src, "Must check SMTP_HOST configuration"

    def test_returns_failure_when_not_configured(self):
        src = _read(SERVICE_FILE)
        assert "SMTP not configured" in src, "Must return 'SMTP not configured' error"

    def test_logs_warning_on_fallback(self):
        src = _read(SERVICE_FILE)
        assert "log.warn" in src, "Must log warning when SMTP not configured"


class TestRW702aRouteIntegration:
    """R-W7-02a: notification-jobs route calls sendEmail() instead of console.log."""

    def test_route_imports_delivery_service(self):
        src = _read(ROUTE_FILE)
        assert "deliverNotification" in src, (
            "Route must import deliverNotification from notification-delivery.service"
        )

    def test_route_calls_deliver_notification(self):
        src = _read(ROUTE_FILE)
        assert "await deliverNotification(" in src, (
            "Route POST handler must call deliverNotification()"
        )

    def test_route_updates_status_after_delivery(self):
        src = _read(ROUTE_FILE)
        assert "deliveryResult.status" in src or "finalStatus" in src, (
            "Route must update job status after delivery attempt"
        )

    def test_patch_endpoint_exists(self):
        src = _read(ROUTE_FILE)
        assert "router.patch" in src, "PATCH /api/notification-jobs/:id must exist"


class TestRW702bMockTransportTest:
    """R-W7-02b: Integration test confirms email queued (mock transport)."""

    def test_test_file_exists(self):
        assert (REPO_ROOT / TEST_FILE).exists(), f"{TEST_FILE} must exist"

    def test_test_mocks_nodemailer(self):
        src = _read(TEST_FILE)
        assert "vi.mock" in src and "nodemailer" in src, (
            "Test must mock nodemailer"
        )

    def test_test_verifies_send_mail_called(self):
        src = _read(TEST_FILE)
        assert "mockSendMail" in src or "sendMail" in src, (
            "Test must verify sendMail was called"
        )

    def test_test_has_r_markers(self):
        src = _read(TEST_FILE)
        assert "R-W7-01a" in src, "Test must have R-W7-01a marker"
        assert "R-W7-01b" in src, "Test must have R-W7-01b marker"


class TestRW7VPC801TypecheckAndTests:
    """R-W7-VPC-801: unit tests pass, tsc clean."""

    def test_vitest_tests_pass(self):
        result = subprocess.run(
            "npx vitest run __tests__/services/notification-delivery.service.test.ts",
            shell=True,
            cwd=str(REPO_ROOT / "server"),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        assert result.returncode == 0, f"Vitest must pass:\n{result.stdout}\n{result.stderr}"

    def test_typescript_clean(self):
        result = subprocess.run(
            "npx tsc --noEmit",
            shell=True,
            cwd=str(REPO_ROOT / "server"),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        assert result.returncode == 0, f"TypeScript must compile clean:\n{result.stdout}\n{result.stderr}"
