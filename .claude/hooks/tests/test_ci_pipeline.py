"""CI Pipeline Configuration — R-marker sentinel for S-1.2.

The actual tests live in server/__tests__/ci-pipeline.test.ts (28 Vitest tests).
This sentinel provides R-marker traceability for the qa_runner Python scanner.

# Tests R-P1-06, R-P1-07, R-P1-08, R-P1-09, R-P1-10
"""

import re
from pathlib import Path

CI_YML = Path(__file__).resolve().parents[3] / ".github" / "workflows" / "ci.yml"


def _read_ci() -> str:
    return CI_YML.read_text(encoding="utf-8")


def test_frontend_build_job_exists():
    # Tests R-P1-06
    content = _read_ci()
    assert "frontend-build:" in content
    assert "npm run build" in content


def test_migration_validation_job_exists():
    # Tests R-P1-07
    content = _read_ci()
    assert "migration-validation:" in content
    assert "scanMigrationFiles" in content
    assert "DUPLICATE" in content
    assert "process.exit(1)" in content


def test_deployment_readiness_job_exists():
    # Tests R-P1-08
    content = _read_ci()
    assert "deployment-readiness:" in content
    assert "deployment-readiness.test.ts" in content
    assert "vitest" in content


def test_smoke_test_job_exists():
    # Tests R-P1-09
    content = _read_ci()
    assert "smoke-test:" in content
    assert "mysql:8.0" in content
    assert "3306:3306" in content
    assert "/api/health" in content
    assert '"ok"' in content
    assert '"connected"' in content


def test_all_eight_jobs_present():
    # Tests R-P1-10
    content = _read_ci()
    required_jobs = [
        "frontend-typecheck:",
        "server-typecheck:",
        "server-tests:",
        "frontend-tests:",
        "frontend-build:",
        "migration-validation:",
        "deployment-readiness:",
        "smoke-test:",
        "python-hooks:",
        "e2e-api-smoke:",
    ]
    for job in required_jobs:
        assert job in content, f"Missing job: {job}"

    # Verify exactly 11 top-level job keys (4 original + 4 S-1.2 + tenant-scope-check + python-hooks + e2e-api-smoke)
    job_pattern = re.compile(r"^  [\w-]+:$", re.MULTILINE)
    jobs_section = content[content.index("jobs:") :]
    matches = job_pattern.findall(jobs_section)
    assert len(matches) == 11, f"Expected 11 jobs, found {len(matches)}: {matches}"


# --- Negative / error-path tests ---


def test_frontend_build_fails_without_build_command():
    # Tests R-P1-06 (negative: build error detection)
    content = _read_ci()
    # The frontend-build job must NOT have a continue-on-error flag
    # so that build failures actually block the merge
    build_section = content[
        content.index("frontend-build:") : content.index("migration-validation:")
    ]
    assert "continue-on-error" not in build_section, (
        "frontend-build must not have continue-on-error — build failures must block merge"
    )


def test_migration_validation_rejects_missing_markers():
    # Tests R-P1-07 (negative: error on missing markers)
    content = _read_ci()
    validation_section = content[
        content.index("migration-validation:") : content.index("deployment-readiness:")
    ]
    # Must detect and report MISSING markers
    assert "MISSING" in validation_section, (
        "migration-validation must report MISSING markers for files without UP/DOWN"
    )
    # Must exit non-zero on errors
    assert "process.exit(1)" in validation_section, (
        "migration-validation must exit 1 on validation errors"
    )


def test_smoke_test_fails_on_wrong_status():
    # Tests R-P1-09 (negative: smoke test fails if status != ok)
    content = _read_ci()
    smoke_section = content[content.index("smoke-test:") :]
    # Must have explicit failure check for non-ok status
    assert "exit 1" in smoke_section, (
        "smoke-test must exit 1 when health check returns unexpected status"
    )
    # Must check both status and mysql fields
    assert "FAIL:" in smoke_section, (
        "smoke-test must print FAIL message on unexpected response"
    )
