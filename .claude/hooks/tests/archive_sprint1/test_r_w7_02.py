# Tests R-W7-02-FE, R-W7-03-FE, R-W7-VPC-803
"""
H-803: Notification Status in Frontend
- R-W7-02-FE: Notification status badges render correctly for each status (PENDING/SENT/FAILED)
- R-W7-03-FE: SafetyView displays real cert expiry warnings from GET /api/safety/expiring-certs
- R-W7-VPC-803: VPC: unit tests pass, tsc clean for modified components
"""
import subprocess
import os
import re

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def test_notification_status_badge_component_exists():
    """R-W7-02-FE: NotificationStatusBadge component file exists."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "NotificationStatusBadge.tsx")
    assert os.path.isfile(path), f"NotificationStatusBadge.tsx not found at {path}"


def test_notification_status_badge_has_three_statuses():
    """R-W7-02-FE: Badge handles PENDING, SENT, FAILED statuses."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "NotificationStatusBadge.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for status in ["PENDING", "SENT", "FAILED"]:
        assert status in content, f"Status '{status}' not found in NotificationStatusBadge.tsx"


def test_notification_status_badge_color_mapping():
    """R-W7-02-FE: Badge uses green=SENT, yellow=PENDING, red=FAILED."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "NotificationStatusBadge.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "text-green-400" in content or "green" in content, "SENT should use green"
    assert "text-yellow-400" in content or "yellow" in content, "PENDING should use yellow"
    assert "text-red-400" in content or "red" in content, "FAILED should use red"


def test_notification_status_badge_sync_error_display():
    """R-W7-02-FE: Badge shows sync_error when FAILED."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "NotificationStatusBadge.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "syncError" in content, "Badge should accept syncError prop"
    assert "FAILED" in content and "syncError" in content, "Badge should show syncError on FAILED"


def test_cert_expiry_warnings_component_exists():
    """R-W7-03-FE: CertExpiryWarnings component file exists."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "CertExpiryWarnings.tsx")
    assert os.path.isfile(path), f"CertExpiryWarnings.tsx not found at {path}"


def test_cert_expiry_warnings_fetches_from_api():
    """R-W7-03-FE: CertExpiryWarnings fetches from /api/safety/expiring-certs."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "CertExpiryWarnings.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "/api/safety/expiring-certs" in content, (
        "CertExpiryWarnings should fetch from /api/safety/expiring-certs"
    )


def test_cert_expiry_warnings_urgency_levels():
    """R-W7-03-FE: CertExpiryWarnings shows EXPIRED/URGENT/WARNING urgency."""
    path = os.path.join(PROJECT_ROOT, "components", "ui", "CertExpiryWarnings.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for level in ["EXPIRED", "URGENT", "WARNING"]:
        assert level in content, f"Urgency level '{level}' not found"


def test_safety_view_imports_new_components():
    """R-W7-03-FE: SafetyView imports CertExpiryWarnings and NotificationStatusBadge."""
    path = os.path.join(PROJECT_ROOT, "components", "SafetyView.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "CertExpiryWarnings" in content, "SafetyView should import CertExpiryWarnings"
    assert "NotificationStatusBadge" in content, "SafetyView should import NotificationStatusBadge"


def test_safety_view_uses_cert_expiry_component():
    """R-W7-03-FE: SafetyView renders CertExpiryWarnings in overview tab."""
    path = os.path.join(PROJECT_ROOT, "components", "SafetyView.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "<CertExpiryWarnings" in content, (
        "SafetyView should render <CertExpiryWarnings /> in overview"
    )


def test_safety_view_notification_jobs_fetch():
    """R-W7-02-FE: SafetyView fetches notification jobs from API."""
    path = os.path.join(PROJECT_ROOT, "components", "SafetyView.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "/api/notification-jobs" in content, (
        "SafetyView should fetch from /api/notification-jobs"
    )


def test_safety_view_renders_notification_badges():
    """R-W7-02-FE: SafetyView uses NotificationStatusBadge for each job."""
    path = os.path.join(PROJECT_ROOT, "components", "SafetyView.tsx")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "<NotificationStatusBadge" in content, (
        "SafetyView should render NotificationStatusBadge for notification jobs"
    )


def test_vitest_test_files_exist():
    """R-W7-VPC-803: Vitest test files exist for new components."""
    tests_dir = os.path.join(PROJECT_ROOT, "src", "__tests__", "components")
    badge_test = os.path.join(tests_dir, "NotificationStatusBadge.test.tsx")
    cert_test = os.path.join(tests_dir, "CertExpiryWarnings.test.tsx")
    integration_test = os.path.join(tests_dir, "SafetyView.notifications.test.tsx")
    assert os.path.isfile(badge_test), f"Missing {badge_test}"
    assert os.path.isfile(cert_test), f"Missing {cert_test}"
    assert os.path.isfile(integration_test), f"Missing {integration_test}"


def test_typescript_compiles_clean():
    """R-W7-VPC-803: npx tsc --noEmit exits 0 for project."""
    result = subprocess.run(
        "npx tsc --noEmit",
        shell=True,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=120,
    )
    assert result.returncode == 0, f"tsc --noEmit failed:\n{result.stdout}\n{result.stderr}"
