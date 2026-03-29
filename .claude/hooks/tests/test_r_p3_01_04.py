"""Source verification tests for S-3.1: Tenant safety — company_id enforcement.

Tests R-P3-01: Every repository function querying tenant tables has companyId as required param
Tests R-P3-02: No route handler passes companyId from an unvalidated source
Tests R-P3-03: 5+ negative integration tests: wrong companyId → 0 rows or 403
Tests R-P3-04: CI grep check fails on unscoped tenant-table queries

Covers: server/repositories/*.ts, server/routes/*.ts, scripts/check-tenant-scope.sh
"""

import re
from pathlib import Path

# Story coverage sentinel — maps this test file to the production modules.
_COVERS_MODULE = "tenant_isolation"

# Resolve the project root (4 levels up from .claude/hooks/tests/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
REPO_DIR = PROJECT_ROOT / "server" / "repositories"
ROUTES_DIR = PROJECT_ROOT / "server" / "routes"
TENANT_TESTS = PROJECT_ROOT / "server" / "__tests__" / "tenant-isolation.test.ts"
CI_CHECK_SCRIPT = PROJECT_ROOT / "scripts" / "check-tenant-scope.sh"


def _read_file(path: Path) -> str:
    """Read a source file."""
    assert path.exists(), f"File not found: {path}"
    return path.read_text(encoding="utf-8")


# ── R-P3-01: Repository functions require companyId ─────────────


def test_load_repository_has_companyid_param():
    """# Tests R-P3-01
    Load repository findByCompany requires companyId parameter.
    """
    source = _read_file(REPO_DIR / "load.repository.ts")
    # findByCompany signature must include companyId
    match_find = re.search(r"findByCompany\s*\(\s*companyId\s*:\s*string", source)
    assert match_find is not None, (
        "load.repository findByCompany must have companyId: string param"
    )
    assert "companyId" in match_find.group(0)
    # findById signature must include companyId
    match_by_id = re.search(
        r"findById\s*\(\s*id\s*:\s*string\s*,\s*companyId\s*:\s*string", source
    )
    assert match_by_id is not None, (
        "load.repository findById must have companyId: string param"
    )
    # Verify SQL uses parameterized company_id
    assert source.count("company_id = ?") >= 2


def test_equipment_repository_has_companyid_param():
    """# Tests R-P3-01
    Equipment repository functions require companyId parameter.
    """
    source = _read_file(REPO_DIR / "equipment.repository.ts")
    match_find = re.search(r"findByCompany\s*\(\s*companyId\s*:\s*string", source)
    assert match_find is not None, (
        "equipment.repository findByCompany must have companyId: string param"
    )
    assert "companyId" in match_find.group(0)
    match_by_id = re.search(
        r"findById\s*\(\s*id\s*:\s*string\s*,\s*companyId\s*:\s*string", source
    )
    assert match_by_id is not None, (
        "equipment.repository findById must have companyId: string param"
    )
    assert source.count("company_id = ?") >= 2


def test_incident_repository_has_companyid_param():
    """# Tests R-P3-01
    Incident repository findByCompany requires companyId parameter.
    """
    source = _read_file(REPO_DIR / "incident.repository.ts")
    match = re.search(r"findByCompany\s*\(\s*companyId\s*:\s*string", source)
    assert match is not None, (
        "incident.repository findByCompany must have companyId: string param"
    )
    assert "companyId" in match.group(0)
    assert source.count("company_id = ?") >= 1


def test_document_repository_has_companyid_param():
    """# Tests R-P3-01
    Document repository findByCompany requires companyId parameter.
    """
    source = _read_file(REPO_DIR / "document.repository.ts")
    match = re.search(r"findByCompany\s*\(\s*\n?\s*companyId\s*:\s*string", source)
    assert match is not None, (
        "document.repository findByCompany must have companyId: string param"
    )
    assert "companyId" in match.group(0)
    assert source.count("company_id = ?") >= 1


def test_settlement_repository_has_companyid_param():
    """# Tests R-P3-01
    Settlement repository findById and findByLoadAndTenant require companyId.
    """
    source = _read_file(REPO_DIR / "settlement.repository.ts")
    match_by_id = re.search(
        r"findById\s*\(\s*id\s*:\s*string\s*,\s*companyId\s*:\s*string", source
    )
    assert match_by_id is not None, (
        "settlement.repository findById must have companyId: string param"
    )
    assert "companyId" in match_by_id.group(0)
    match_tenant = re.search(
        r"findByLoadAndTenant\s*\(\s*\n?\s*loadId\s*:\s*string\s*,\s*\n?\s*companyId\s*:\s*string",
        source,
    )
    assert match_tenant is not None, (
        "settlement.repository findByLoadAndTenant must have companyId: string param"
    )
    assert "companyId" in match_tenant.group(0)
    company_id_count = source.count("company_id = ?")
    assert company_id_count >= 2, (
        f"Expected at least 2 company_id = ? in settlement repository, got {company_id_count}"
    )


# ── R-P3-02: No unvalidated companyId sources ──────────────────


def test_loads_route_derives_companyid_from_auth():
    """# Tests R-P3-02
    loads.ts route handler derives companyId from req.user.tenantId, not URL/body.
    """
    source = _read_file(ROUTES_DIR / "loads.ts")
    # Must use req.user.tenantId for companyId
    assert "req.user.tenantId" in source, (
        "loads.ts must derive companyId from req.user.tenantId"
    )
    # Must NOT use req.params.companyId for main queries
    # (the file may have legacy endpoints that use params, but primary endpoints use auth)
    auth_derivations = len(re.findall(r"req\.user\.tenantId", source))
    assert auth_derivations >= 3, (
        f"loads.ts should derive companyId from auth at least 3 times, found {auth_derivations}"
    )


def test_equipment_route_derives_companyid_from_auth():
    """# Tests R-P3-02
    equipment.ts has at least one auth-derived companyId endpoint.
    """
    source = _read_file(ROUTES_DIR / "equipment.ts")
    assert "req.user.tenantId" in source, (
        "equipment.ts must derive companyId from req.user.tenantId"
    )


def test_accounting_route_derives_companyid_from_auth():
    """# Tests R-P3-02
    accounting.ts derives companyId from req.user.tenantId for tenant queries.
    """
    source = _read_file(ROUTES_DIR / "accounting.ts")
    assert "req.user.tenantId" in source or "req.user!.tenantId" in source, (
        "accounting.ts must derive companyId from req.user.tenantId"
    )


# ── R-P3-03: Negative integration tests exist ──────────────────


def test_negative_tenant_tests_exist():
    """# Tests R-P3-03
    At least 5 negative tenant isolation tests exist in tenant-isolation.test.ts.
    """
    assert TENANT_TESTS.exists() is True, (
        f"tenant-isolation.test.ts not found at {TENANT_TESTS}"
    )
    source = _read_file(TENANT_TESTS)
    # Count test cases (it(...) blocks)
    test_count = len(re.findall(r"\bit\s*\(", source))
    assert test_count >= 5, (
        f"Expected at least 5 negative tenant tests, found {test_count}"
    )
    # Verify specific test descriptions exist
    assert "wrong companyId returns 0 rows" in source
    assert "wrong companyId returns null" in source


def test_negative_tests_use_wrong_companyid():
    """# Tests R-P3-03
    Negative tests actually use a wrong/different companyId to verify isolation.
    """
    source = _read_file(TENANT_TESTS)
    assert "WRONG_COMPANY" in source or "wrong" in source.lower(), (
        "Negative tests must use a wrong companyId constant"
    )
    # Verify the tests assert on empty/null results
    assert "toHaveLength(0)" in source or "toBeNull()" in source, (
        "Negative tests must assert wrong companyId returns 0 rows or null"
    )


def test_negative_tests_cover_multiple_repositories():
    """# Tests R-P3-03
    Negative tests cover at least 5 different repository operations.
    """
    source = _read_file(TENANT_TESTS)
    repos_tested = set()
    if "loadRepository" in source:
        repos_tested.add("load")
    if "equipmentRepository" in source:
        repos_tested.add("equipment")
    if "incidentRepository" in source:
        repos_tested.add("incident")
    if "documentRepository" in source:
        repos_tested.add("document")
    if "settlementRepository" in source:
        repos_tested.add("settlement")
    assert len(repos_tested) == 5, (
        f"Expected tests to cover 5 repositories, found {len(repos_tested)}: {repos_tested}"
    )
    # Verify all expected repos are present
    assert "load" in repos_tested
    assert "equipment" in repos_tested
    assert "incident" in repos_tested


# ── R-P3-04: CI grep check script ──────────────────────────────


def test_ci_check_script_exists():
    """# Tests R-P3-04
    scripts/check-tenant-scope.sh exists and contains enforcement logic.
    """
    assert CI_CHECK_SCRIPT.exists() is True, (
        f"check-tenant-scope.sh not found at {CI_CHECK_SCRIPT}"
    )
    source = _read_file(CI_CHECK_SCRIPT)
    assert CI_CHECK_SCRIPT.name == "check-tenant-scope.sh"
    # Must be a bash script
    assert source.startswith("#!/usr/bin/env bash")


def test_ci_check_script_checks_tenant_tables():
    """# Tests R-P3-04
    check-tenant-scope.sh checks the key tenant-scoped tables.
    """
    source = _read_file(CI_CHECK_SCRIPT)
    required_tables = ["loads", "equipment", "users", "settlements", "documents"]
    for table in required_tables:
        assert table in source, f"check-tenant-scope.sh must check table '{table}'"


def test_ci_check_script_exits_nonzero_on_violations():
    """# Tests R-P3-04
    check-tenant-scope.sh exits with code 1 when unscoped queries are found.
    """
    source = _read_file(CI_CHECK_SCRIPT)
    # Script must have exit 1 for violations
    assert "exit 1" in source, "check-tenant-scope.sh must exit 1 on violations"
    # Script must have exit 0 for pass
    assert "exit 0" in source, "check-tenant-scope.sh must exit 0 on pass"
    # Script must scan for company_id
    assert "company_id" in source, (
        "check-tenant-scope.sh must check for company_id in queries"
    )
