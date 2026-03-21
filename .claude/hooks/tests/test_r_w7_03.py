# Tests R-W7-03a, R-W7-03b, R-W7-03c, R-W7-VPC-802
"""
QA tests for H-802: Driver Certificate Expiry Alerts
Validates cert-expiry-checker.ts service and safety route.
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[3]
SERVER = ROOT / "server"


def test_r_w7_03a_cert_expiry_checker_exports_check_expiring():
    """R-W7-03a: cert-expiry-checker.ts exports checkExpiring() querying certs within N days"""
    src = (SERVER / "services" / "cert-expiry-checker.ts").read_text(encoding="utf-8")
    assert "export async function checkExpiring" in src or "export function checkExpiring" in src, (
        "cert-expiry-checker.ts must export checkExpiring"
    )
    assert "expiry_date" in src, "Query must reference expiry_date column"
    assert "company_id" in src, "Query must scope by company_id"
    assert "INTERVAL" in src or "daysAhead" in src.lower() or "days_ahead" in src.lower(), (
        "Query must accept days-ahead parameter"
    )


def test_r_w7_03b_returns_typed_array():
    """R-W7-03b: Returns array of {driverId, certType, expiryDate, daysRemaining}"""
    src = (SERVER / "services" / "cert-expiry-checker.ts").read_text(encoding="utf-8")
    assert "driverId" in src, "Must map to driverId"
    assert "certType" in src, "Must map to certType"
    assert "expiryDate" in src, "Must map to expiryDate"
    assert "daysRemaining" in src, "Must map to daysRemaining"
    assert "ExpiringCert" in src, "Must define ExpiringCert interface"


def test_r_w7_03c_safety_route_exposes_expiring_certs():
    """R-W7-03c: safety.ts route exposes GET /api/safety/expiring-certs"""
    src = (SERVER / "routes" / "safety.ts").read_text(encoding="utf-8")
    assert "/api/safety/expiring-certs" in src, (
        "safety.ts must have /api/safety/expiring-certs route"
    )
    assert "checkExpiring" in src, (
        "safety.ts must import and call checkExpiring"
    )
    assert "requireAuth" in src, "Route must use requireAuth"
    assert "requireTenant" in src, "Route must use requireTenant"


def test_r_w7_vpc_802_unit_tests_exist():
    """R-W7-VPC-802: unit tests exist for cert-expiry-checker"""
    test_svc = (SERVER / "__tests__" / "services" / "cert-expiry-checker.test.ts")
    assert test_svc.exists(), "Unit test file for cert-expiry-checker must exist"
    content = test_svc.read_text(encoding="utf-8")
    assert "checkExpiring" in content, "Tests must import and test checkExpiring"
    # Verify R-marker
    assert re.search(r"R-W7-03", content), "Test file must have R-W7-03 marker"

    test_route = (SERVER / "__tests__" / "routes" / "safety-expiring-certs.test.ts")
    assert test_route.exists(), "Route test file for safety expiring-certs must exist"
    route_content = test_route.read_text(encoding="utf-8")
    assert "expiring-certs" in route_content, "Route test must test expiring-certs endpoint"
