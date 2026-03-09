# Tests R-FS-03-01, R-FS-03-02, R-FS-03-03, R-FS-03-04, R-FS-03-05, R-FS-03-06
"""
R-FS-03: Critical E2E Implementation — convert placeholder Playwright into real release evidence.

Validates that:
  - R-FS-03-01: auth.spec.ts has real assertions for login, tenant context, unauthorized rejection
  - R-FS-03-02: load-lifecycle.spec.ts has real assertions for create, assign, dispatch, complete
  - R-FS-03-03: settlement.spec.ts exists with real assertions for generation, review, immutability
  - R-FS-03-04: tenant-isolation.spec.ts has cross-tenant isolation assertions
  - R-FS-03-05: At least 5 E2E spec files discovered by playwright
  - R-FS-03-06: server vitest exits 0 (no regression)
"""

import pathlib
import subprocess

E2E_DIR = pathlib.Path(__file__).resolve().parents[3] / "e2e"
SERVER_DIR = pathlib.Path(__file__).resolve().parents[3] / "server"
PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[3]


class TestR_FS_03_01_AuthSpec:
    """R-FS-03-01: auth.spec.ts has real assertions."""

    def test_auth_spec_exists(self):
        spec = E2E_DIR / "auth.spec.ts"
        assert spec.exists(), f"Missing: {spec}"

    def test_auth_spec_has_unauthorized_rejection_test(self):
        spec = E2E_DIR / "auth.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "401" in content, "Missing 401 assertion for unauthorized rejection"
        assert "403" in content, "Missing 403 assertion for unauthorized rejection"

    def test_auth_spec_has_tenant_context_test(self):
        spec = E2E_DIR / "auth.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "tenant" in content.lower(), "Missing tenant context assertion"

    def test_auth_spec_has_login_field_selectors(self):
        spec = E2E_DIR / "auth.spec.ts"
        content = spec.read_text(encoding="utf-8")
        has_email = 'type="email"' in content or 'name="email"' in content
        has_password = 'type="password"' in content or 'name="password"' in content
        assert has_email, "Missing email input selector in auth.spec.ts"
        assert has_password, "Missing password input selector in auth.spec.ts"

    def test_auth_spec_has_real_status_assertions(self):
        spec = E2E_DIR / "auth.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "toContain" in content or "toBe(200)" in content, (
            "Missing real HTTP status assertions in auth.spec.ts"
        )

    def test_auth_spec_has_minimum_real_assertions(self):
        spec = E2E_DIR / "auth.spec.ts"
        content = spec.read_text(encoding="utf-8")
        real_count = content.count("toHaveProperty") + content.count("toContain([401")
        assert real_count >= 3, (
            f"Insufficient real assertions in auth.spec.ts (found {real_count}, need >= 3)"
        )


class TestR_FS_03_02_LoadLifecycleSpec:
    """R-FS-03-02: load-lifecycle.spec.ts has real assertions."""

    def test_load_lifecycle_spec_exists(self):
        spec = E2E_DIR / "load-lifecycle.spec.ts"
        assert spec.exists(), f"Missing: {spec}"

    def test_load_lifecycle_has_create_assertions(self):
        spec = E2E_DIR / "load-lifecycle.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "create" in content.lower() or "POST" in content, (
            "Missing create load assertions"
        )

    def test_load_lifecycle_has_dispatch_assertions(self):
        spec = E2E_DIR / "load-lifecycle.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "dispatch" in content.lower(), "Missing dispatch assertion"

    def test_load_lifecycle_has_canonical_status_assertions(self):
        spec = E2E_DIR / "load-lifecycle.spec.ts"
        content = spec.read_text(encoding="utf-8")
        canonical = ["draft", "dispatched", "in_transit", "completed"]
        found_any = any(s in content for s in canonical)
        assert found_any, "Missing canonical load status assertions"

    def test_load_lifecycle_has_auth_enforcement(self):
        spec = E2E_DIR / "load-lifecycle.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "401" in content, "Missing 401 auth enforcement"

    def test_load_lifecycle_has_real_api_assertions(self):
        spec = E2E_DIR / "load-lifecycle.spec.ts"
        content = spec.read_text(encoding="utf-8")
        has_status_check = "res.status()" in content or "response.status()" in content
        has_body_check = "toHaveProperty" in content or "toContain" in content
        assert has_status_check, "Missing response status assertion"
        assert has_body_check, "Missing response body assertion"


class TestR_FS_03_03_SettlementSpec:
    """R-FS-03-03: settlement.spec.ts exists with real assertions."""

    def test_settlement_spec_exists(self):
        spec = E2E_DIR / "settlement.spec.ts"
        assert spec.exists(), f"Missing: {spec}"

    def test_settlement_spec_has_generation_test(self):
        spec = E2E_DIR / "settlement.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "settlement" in content.lower(), "Missing settlement generation test"
        assert "POST" in content or "create" in content.lower(), (
            "Missing create/POST assertion"
        )

    def test_settlement_spec_has_immutability_assertion(self):
        spec = E2E_DIR / "settlement.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "immutab" in content.lower() or "posted" in content.lower(), (
            "Missing immutability assertion"
        )

    def test_settlement_spec_has_auth_enforcement(self):
        spec = E2E_DIR / "settlement.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "401" in content, "Missing 401 auth enforcement assertion"

    def test_settlement_spec_has_workflow_states(self):
        spec = E2E_DIR / "settlement.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "draft" in content, "Missing draft state"
        assert "review" in content, "Missing review state"
        assert "posted" in content, "Missing posted state"


class TestR_FS_03_04_TenantIsolationSpec:
    """R-FS-03-04: tenant-isolation.spec.ts prevents cross-tenant data access."""

    def test_tenant_isolation_spec_exists(self):
        spec = E2E_DIR / "tenant-isolation.spec.ts"
        assert spec.exists(), f"Missing: {spec}"

    def test_tenant_isolation_has_cross_tenant_test(self):
        spec = E2E_DIR / "tenant-isolation.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "company" in content.lower() or "tenant" in content.lower(), (
            "Missing cross-tenant isolation assertion"
        )

    def test_tenant_isolation_has_api_level_tests(self):
        spec = E2E_DIR / "tenant-isolation.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "request" in content, "Missing API request-level isolation tests"
        assert "401" in content, (
            "Missing auth rejection (401) in tenant isolation tests"
        )

    def test_tenant_isolation_covers_multiple_endpoints(self):
        spec = E2E_DIR / "tenant-isolation.spec.ts"
        content = spec.read_text(encoding="utf-8")
        scoped = ["/api/loads", "/api/equipment", "/api/clients"]
        found = sum(1 for ep in scoped if ep in content)
        assert found >= 2, (
            f"tenant-isolation.spec.ts only covers {found} scoped endpoints (need >= 2)"
        )

    def test_tenant_isolation_has_injection_prevention(self):
        spec = E2E_DIR / "tenant-isolation.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert (
            "EVIL" in content
            or "injection" in content.lower()
            or "other-company" in content
        ), "Missing cross-tenant injection prevention test"

    def test_tenant_isolation_documents_auth_token_contract(self):
        spec = E2E_DIR / "tenant-isolation.spec.ts"
        content = spec.read_text(encoding="utf-8")
        assert "req.user" in content or "auth token" in content.lower(), (
            "Missing auth-token-as-authoritative-source documentation"
        )


class TestR_FS_03_05_SpecCount:
    """R-FS-03-05: At least 5 E2E spec files exist."""

    def test_at_least_5_spec_files_exist(self):
        spec_files = list(E2E_DIR.glob("*.spec.ts"))
        assert len(spec_files) >= 5, (
            f"Only {len(spec_files)} spec files (need >= 5): {[f.name for f in spec_files]}"
        )

    def test_required_specs_all_exist(self):
        required = [
            "auth.spec.ts",
            "load-lifecycle.spec.ts",
            "settlement.spec.ts",
            "tenant-isolation.spec.ts",
        ]
        for name in required:
            assert (E2E_DIR / name).exists(), f"Required spec missing: {name}"

    def test_playwright_discovers_all_specs(self):
        result = subprocess.run(
            "npx playwright test --list",
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(PROJECT_ROOT),
            timeout=60,
        )
        output = (result.stdout or "") + (result.stderr or "")
        for spec in [
            "auth.spec.ts",
            "load-lifecycle.spec.ts",
            "settlement.spec.ts",
            "tenant-isolation.spec.ts",
        ]:
            assert spec in output, f"playwright --list does not discover: {spec}"


class TestR_FS_03_06_ServerRegression:
    """R-FS-03-06: server vitest exits 0 — no regression."""

    def test_server_vitest_passes(self):
        result = subprocess.run(
            "npx vitest run",
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(SERVER_DIR),
            timeout=300,
        )
        assert result.returncode == 0, (
            f"Server vitest failed (exit {result.returncode}):\n"
            f"STDOUT: {(result.stdout or '')[-2000:]}\n"
            f"STDERR: {(result.stderr or '')[-1000:]}"
        )

    def test_server_vitest_reports_pass_count(self):
        result = subprocess.run(
            "npx vitest run",
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(SERVER_DIR),
            timeout=300,
        )
        output = (result.stdout or "") + (result.stderr or "")
        assert "passed" in output, "No 'passed' in vitest output"
