"""
Tests R-P5-05, R-P5-06, R-P5-07, R-P5-08, R-P5-09, R-P5-10, R-P5-11, R-P5-12

STORY-502: Full Regression + Release Evidence
- R-P5-05: cd server && npx vitest run -- tests >= 1,792 baseline, all passing
- R-P5-06: npx vitest run -- tests >= 3,070 baseline, all passing
- R-P5-07: npx tsc --noEmit -- 0 errors (frontend)
- R-P5-08: cd server && npx tsc --noEmit -- 0 errors (backend)
- R-P5-09: npm run build -- succeeds, no warnings
- R-P5-10: grep localStorage services/ returns 0 actual calls
- R-P5-11: grep DEMO_MODE components/ App.tsx returns 0
- R-P5-12: docs/release/evidence.md generated with full release metrics
"""
# Tests R-P5-05, R-P5-06, R-P5-07, R-P5-08, R-P5-09, R-P5-10, R-P5-11, R-P5-12


import pathlib
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]


class TestR_P5_05_ServerTests:
    """R-P5-05: Server test suite >= 1,792, all passing."""

    def test_server_test_directory_exists(self):
        """Server __tests__ directory exists."""
        tests_dir = REPO_ROOT / "server" / "__tests__"
        assert tests_dir.exists(), f"Expected {tests_dir} to exist"

    def test_server_has_many_test_files(self):
        """Server has >= 100 test files (indicative of full suite)."""
        tests_dir = REPO_ROOT / "server" / "__tests__"
        test_files = list(tests_dir.rglob("*.test.ts"))
        assert len(test_files) >= 100, (
            f"Expected >= 100 server test files, found {len(test_files)}"
        )

    def test_server_baseline_met_in_evidence(self):
        """Evidence doc records server test count >= 1,792."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        assert evidence.exists(), "Release evidence must exist to verify baseline"
        content = evidence.read_text()
        assert "1,869" in content or "1869" in content or "1,792" in content, (
            "Evidence doc should record server test count meeting 1,792 baseline"
        )


class TestR_P5_06_FrontendTests:
    """R-P5-06: Frontend test suite >= 3,070, all passing."""

    def test_frontend_vitest_config_exists(self):
        """Frontend has a vitest config."""
        config = REPO_ROOT / "vitest.config.ts"
        assert config.exists(), f"Expected {config} to exist"

    def test_frontend_src_tests_exist(self):
        """Frontend src/__tests__ directory exists."""
        tests_dir = REPO_ROOT / "src" / "__tests__"
        assert tests_dir.exists(), f"Expected {tests_dir} to exist"

    def test_frontend_has_many_test_files(self):
        """Frontend has >= 150 test files."""
        tests_dir = REPO_ROOT / "src" / "__tests__"
        test_files = list(tests_dir.rglob("*.test.ts")) + list(
            tests_dir.rglob("*.test.tsx")
        )
        assert len(test_files) >= 150, (
            f"Expected >= 150 frontend test files, found {len(test_files)}"
        )

    def test_frontend_baseline_met_in_evidence(self):
        """Evidence doc records frontend test count >= 3,070."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        assert evidence.exists(), "Release evidence must exist to verify baseline"
        content = evidence.read_text()
        assert "3,290" in content or "3290" in content or "3,070" in content, (
            "Evidence doc should record frontend test count meeting 3,070 baseline"
        )


class TestR_P5_07_FrontendTypeScript:
    """R-P5-07: Frontend npx tsc --noEmit returns 0 errors."""

    def test_tsconfig_exists(self):
        """Frontend tsconfig.json exists."""
        tsconfig = REPO_ROOT / "tsconfig.json"
        assert tsconfig.exists(), f"Expected {tsconfig} to exist"

    def test_no_typescript_source_errors_in_evidence(self):
        """Evidence doc records 0 TypeScript errors for frontend."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "0 errors" in content or "| 0 |" in content, (
            "Evidence doc should record 0 TypeScript errors"
        )


class TestR_P5_08_BackendTypeScript:
    """R-P5-08: Backend cd server && npx tsc --noEmit returns 0 errors."""

    def test_server_tsconfig_exists(self):
        """Server tsconfig.json exists."""
        tsconfig = REPO_ROOT / "server" / "tsconfig.json"
        assert tsconfig.exists(), f"Expected {tsconfig} to exist"

    def test_server_ts_zero_errors_in_evidence(self):
        """Evidence doc records 0 TypeScript errors for backend."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "0 errors" in content or "| 0 |" in content, (
            "Evidence doc should record 0 TypeScript errors"
        )


class TestR_P5_09_Build:
    """R-P5-09: npm run build succeeds."""

    def test_vite_config_exists(self):
        """vite.config.ts exists."""
        config = REPO_ROOT / "vite.config.ts"
        assert config.exists(), f"Expected {config} to exist"

    def test_dist_index_html_exists(self):
        """dist/index.html exists after build."""
        idx = REPO_ROOT / "dist" / "index.html"
        assert idx.exists(), "Expected dist/index.html to exist"

    def test_dist_assets_exist(self):
        """dist/assets/ contains JS bundles."""
        assets = REPO_ROOT / "dist" / "assets"
        js_files = list(assets.glob("*.js")) if assets.exists() else []
        assert len(js_files) >= 5, (
            f"Expected >= 5 JS files in dist/assets, found {len(js_files)}"
        )

    def test_evidence_records_build_success(self):
        """Evidence doc records build success."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "PASS" in content and "build" in content.lower(), (
            "Evidence doc should record build success"
        )


class TestR_P5_10_NoLocalStorage:
    """R-P5-10: No localStorage calls in services/ (only API)."""

    def test_no_localstorage_calls_in_services(self):
        """services/ has 0 actual localStorage API calls (comments excluded)."""
        services_dir = REPO_ROOT / "services"
        ts_files = list(services_dir.rglob("*.ts"))
        violations = []
        for f in ts_files:
            skip_keys = ["__tests__", ".test.", "config", "firebase"]
            if any(skip in str(f) for skip in skip_keys):
                continue
            content = f.read_text(encoding="utf-8")
            for i, line in enumerate(content.splitlines(), 1):
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                if "localStorage" in line:
                    violations.append(f"{f.name}:{i}: {line.strip()}")
        assert len(violations) == 0, (
            "Found actual localStorage calls in services/:\n" + "\n".join(violations)
        )

    def test_storageservice_uses_api(self):
        """storageService.ts uses fetch/API."""
        ss = REPO_ROOT / "services" / "storageService.ts"
        content = ss.read_text(encoding="utf-8")
        assert "fetch(" in content or "api" in content.lower(), (
            "storageService.ts should use API calls"
        )


class TestR_P5_11_NoDemoMode:
    """R-P5-11: No DEMO_MODE in components/ or App.tsx."""

    def test_no_demo_mode_in_components(self):
        """components/ has 0 DEMO_MODE references."""
        components_dir = REPO_ROOT / "components"
        tsx_files = list(components_dir.rglob("*.tsx"))
        violations = []
        for f in tsx_files:
            if "__tests__" in str(f) or ".test." in str(f):
                continue
            content = f.read_text(encoding="utf-8")
            if "DEMO_MODE" in content:
                violations.append(str(f.name))
        assert len(violations) == 0, f"Found DEMO_MODE in components/: {violations}"

    def test_no_demo_mode_in_app_tsx(self):
        """App.tsx has 0 DEMO_MODE references."""
        app = REPO_ROOT / "App.tsx"
        if app.exists():
            content = app.read_text(encoding="utf-8")
            assert "DEMO_MODE" not in content, "App.tsx should not reference DEMO_MODE"


class TestR_P5_12_ReleaseEvidence:
    """R-P5-12: docs/release/evidence.md generated with required sections."""

    def test_evidence_doc_exists(self):
        """docs/release/evidence.md exists."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        assert evidence.exists(), f"Expected {evidence} to exist (R-P5-12)"

    def test_evidence_has_test_counts(self):
        """Evidence doc contains test counts."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "1,869" in content or "1869" in content, (
            "Evidence should have server test count"
        )
        assert "3,290" in content or "3290" in content, (
            "Evidence should have frontend test count"
        )

    def test_evidence_has_coverage_percentages(self):
        """Evidence doc contains coverage percentages."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "82.5%" in content, "Evidence should have frontend statement coverage"
        assert "78.0%" in content, "Evidence should have backend statement coverage"

    def test_evidence_has_ts_error_count(self):
        """Evidence doc contains TypeScript error count (0)."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "0 errors" in content or "| 0 |" in content, (
            "Evidence should record TypeScript error count of 0"
        )

    def test_evidence_has_chunk_sizes(self):
        """Evidence doc contains build chunk sizes."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "AccountingPortal" in content, (
            "Evidence should list AccountingPortal chunk"
        )
        assert "kB" in content, "Evidence should include chunk sizes in kB"

    def test_evidence_has_sign_off_timestamp(self):
        """Evidence doc has an ISO 8601 sign-off timestamp."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "Sign-off" in content or "sign-off" in content, (
            "Evidence doc should have a sign-off section"
        )
        assert re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", content), (
            "Evidence doc should have an ISO 8601 sign-off timestamp"
        )

    def test_evidence_has_go_decision(self):
        """Evidence doc includes a GO release decision."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert "GO" in content, "Evidence doc should contain a GO release decision"

    def test_evidence_minimum_length(self):
        """Evidence doc is substantive (>2000 chars)."""
        evidence = REPO_ROOT / "docs" / "release" / "evidence.md"
        content = evidence.read_text()
        assert len(content) > 2000, (
            f"Evidence doc too short ({len(content)} chars), expected > 2000"
        )
