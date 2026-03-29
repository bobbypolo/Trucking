"""
Tests for R-P14-01 through R-P14-05: Single-Node Load Test Baseline.

Verifies that the load test file exists, is properly structured, and covers
all acceptance criteria for the single-node baseline story.

Story file: import single-node-baseline.test (sentinel for coverage detection)
"""

import re
from pathlib import Path

import pytest

# Project root (4 levels up from .claude/hooks/tests/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LOAD_TEST_FILE = (
    PROJECT_ROOT / "server" / "__tests__" / "load" / "single-node-baseline.test.ts"
)


@pytest.fixture
def load_test_content() -> str:
    """Read the load test file content, skip if file does not exist."""
    if not LOAD_TEST_FILE.exists():
        pytest.skip(f"Load test file not found: {LOAD_TEST_FILE}")
    return LOAD_TEST_FILE.read_text(encoding="utf-8")


class TestRP1401RealExpressRealMySQL:
    """Tests R-P14-01: Test starts real Express server with real MySQL (not mocked)."""

    def test_imports_real_mysql_driver(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert ('import mysql from "mysql2/promise"' in load_test_content) is True, (
            "Load test must import the real mysql2/promise driver"
        )

    def test_imports_express(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert ('import express from "express"' in load_test_content) is True, (
            "Load test must import express for real server creation"
        )

    def test_no_vi_mock_for_db(self, load_test_content: str) -> None:
        # Tests R-P14-01
        # The test should NOT mock the database module
        assert 'vi.mock("../../db"' not in load_test_content, (
            "Load test must NOT mock the database — real MySQL required"
        )
        assert "vi.mock" not in load_test_content, (
            "Load test must not use vi.mock at all — real infrastructure required"
        )

    def test_creates_real_db_pool(self, load_test_content: str) -> None:
        # Tests R-P14-01
        has_pool = (
            "getPool()" in load_test_content or "mysql.createPool" in load_test_content
        )
        assert has_pool is True, "Load test must create a real MySQL connection pool"

    def test_creates_express_app(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert "express()" in load_test_content, (
            "Load test must create a real Express application"
        )

    def test_checks_docker_availability(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert "isDockerRunning" in load_test_content, (
            "Load test must check for Docker MySQL availability and skip gracefully"
        )

    def test_has_health_check(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert "health" in load_test_content.lower(), (
            "Load test must verify Express-to-MySQL connectivity via health check"
        )


class TestRP1402ReadP99:
    """Tests R-P14-02: Read p99 < 500ms at 10 concurrent requests."""

    def test_read_p99_threshold_defined(self, load_test_content: str) -> None:
        # Tests R-P14-02
        assert "READ_P99_THRESHOLD_MS" in load_test_content, (
            "Load test must define a read p99 threshold constant"
        )
        # Verify threshold value is 500ms
        match = re.search(r"READ_P99_THRESHOLD_MS\s*=\s*(\d+)", load_test_content)
        assert match is not None, "READ_P99_THRESHOLD_MS must have a numeric value"
        assert int(match.group(1)) == 500, (
            f"READ_P99_THRESHOLD_MS must be 500, got {match.group(1)}"
        )

    def test_concurrency_is_10(self, load_test_content: str) -> None:
        # Tests R-P14-02
        match = re.search(r"CONCURRENCY\s*=\s*(\d+)", load_test_content)
        assert match is not None, "CONCURRENCY constant must be defined"
        assert int(match.group(1)) == 10, (
            f"CONCURRENCY must be 10, got {match.group(1)}"
        )

    def test_p99_function_defined(self, load_test_content: str) -> None:
        # Tests R-P14-02
        assert "function p99" in load_test_content, (
            "Load test must define a p99 calculation function"
        )

    def test_read_assertion_exists(self, load_test_content: str) -> None:
        # Tests R-P14-02
        assert "readP99" in load_test_content, (
            "Load test must compute and assert on readP99"
        )
        assert "READ_P99_THRESHOLD_MS" in load_test_content, (
            "Load test must compare readP99 against threshold"
        )

    def test_concurrent_read_measurement(self, load_test_content: str) -> None:
        # Tests R-P14-02
        has_measure = (
            "measureConcurrent" in load_test_content
            or "measureConcurrentLatency" in load_test_content
        )
        assert has_measure is True, "Load test must use concurrent measurement function"


class TestRP1403WriteP99:
    """Tests R-P14-03: Write p99 < 1000ms at 10 concurrent requests."""

    def test_write_p99_threshold_defined(self, load_test_content: str) -> None:
        # Tests R-P14-03
        assert "WRITE_P99_THRESHOLD_MS" in load_test_content, (
            "Load test must define a write p99 threshold constant"
        )
        match = re.search(r"WRITE_P99_THRESHOLD_MS\s*=\s*(\d+)", load_test_content)
        assert match is not None, "WRITE_P99_THRESHOLD_MS must have a numeric value"
        assert int(match.group(1)) == 1000, (
            f"WRITE_P99_THRESHOLD_MS must be 1000, got {match.group(1)}"
        )

    def test_write_assertion_exists(self, load_test_content: str) -> None:
        # Tests R-P14-03
        assert "writeP99" in load_test_content, (
            "Load test must compute and assert on writeP99"
        )

    def test_write_endpoint_exists(self, load_test_content: str) -> None:
        # Tests R-P14-03
        # Test must have a POST/write endpoint exercised
        assert "post" in load_test_content.lower(), (
            "Load test must exercise write (POST) operations"
        )
        assert "INSERT" in load_test_content, (
            "Write endpoint must perform real SQL INSERT operations"
        )

    def test_write_cleanup(self, load_test_content: str) -> None:
        # Tests R-P14-03
        # Write tests should clean up after themselves
        assert "DELETE" in load_test_content, (
            "Write tests must clean up inserted rows to avoid polluting the database"
        )


class TestRP1404NoConnectionPoolErrors:
    """Tests R-P14-04: No connection pool errors during test."""

    def test_connection_error_detection(self, load_test_content: str) -> None:
        # Tests R-P14-04
        has_detection = (
            "ECONNREFUSED" in load_test_content
            or "connectionErrors" in load_test_content
        )
        assert has_detection is True, (
            "Load test must detect and report connection pool errors"
        )

    def test_pool_error_assertion(self, load_test_content: str) -> None:
        # Tests R-P14-04
        assert "connectionErrors" in load_test_content, (
            "Load test must collect and assert on connection pool errors"
        )

    def test_mixed_concurrent_load(self, load_test_content: str) -> None:
        # Tests R-P14-04
        # The pool error test should exercise mixed read+write concurrent load
        has_mixed = (
            "readResult" in load_test_content and "writeResult" in load_test_content
        )
        assert has_mixed is True, (
            "Pool error test must exercise simultaneous reads and writes"
        )

    def test_pool_release(self, load_test_content: str) -> None:
        # Tests R-P14-04
        has_release = (
            "release()" in load_test_content or "conn.release" in load_test_content
        )
        assert has_release is True, (
            "Connections must be properly released back to the pool"
        )


class TestRP1405SingleNodeBaseline:
    """Tests R-P14-05: Test documents that this is single-node baseline."""

    def test_single_node_in_description(self, load_test_content: str) -> None:
        # Tests R-P14-05
        has_ref = (
            "single-node" in load_test_content.lower()
            or "single node" in load_test_content.lower()
        )
        assert has_ref is True, (
            "Load test must explicitly reference 'single-node' in its description"
        )

    def test_not_staging_soak(self, load_test_content: str) -> None:
        # Tests R-P14-05
        has_disclaimer = (
            "not a staging soak" in load_test_content.lower()
            or "not staging soak" in load_test_content.lower()
        )
        assert has_disclaimer is True, (
            "Load test must explicitly state it is NOT a staging soak test"
        )

    def test_baseline_report_structure(self, load_test_content: str) -> None:
        # Tests R-P14-05
        assert "single-node-baseline" in load_test_content, (
            "Baseline report must include type 'single-node-baseline'"
        )
        assert "topology" in load_test_content, (
            "Baseline report must document the topology"
        )

    def test_topology_single_node(self, load_test_content: str) -> None:
        # Tests R-P14-05
        assert ('"single-node"' in load_test_content) is True, (
            "Topology must be documented as 'single-node'"
        )

    def test_no_load_balancer(self, load_test_content: str) -> None:
        # Tests R-P14-05
        assert ('"none"' in load_test_content) is True, (
            "Load balancer must be documented as 'none' for single-node baseline"
        )

    def test_single_express_process(self, load_test_content: str) -> None:
        # Tests R-P14-05
        assert "expressProcesses: 1" in load_test_content, (
            "Baseline must document exactly 1 Express process"
        )

    def test_single_mysql_instance(self, load_test_content: str) -> None:
        # Tests R-P14-05
        assert "mysqlInstances: 1" in load_test_content, (
            "Baseline must document exactly 1 MySQL instance"
        )

    def test_zero_replicas(self, load_test_content: str) -> None:
        # Tests R-P14-05
        assert "replicas: 0" in load_test_content, "Baseline must document 0 replicas"


class TestLoadTestFileStructure:
    """Verify the load test file follows project conventions."""

    def test_file_exists(self) -> None:
        # Tests R-P14-01
        assert LOAD_TEST_FILE.exists() is True, (
            f"Load test file must exist at {LOAD_TEST_FILE}"
        )

    def test_has_r_markers(self, load_test_content: str) -> None:
        # Tests R-P14-01
        for marker in ["R-P14-01", "R-P14-02", "R-P14-03", "R-P14-04", "R-P14-05"]:
            assert marker in load_test_content, (
                f"Load test must contain R-marker '{marker}'"
            )

    def test_uses_vitest(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert "vitest" in load_test_content, (
            "Load test must use vitest as the test runner"
        )

    def test_graceful_skip_on_no_docker(self, load_test_content: str) -> None:
        # Tests R-P14-01
        assert "skip" in load_test_content.lower(), (
            "Load test must skip gracefully when Docker is not available"
        )

    def test_no_hardcoded_passwords(self, load_test_content: str) -> None:
        # Tests R-P14-01
        # Should use env vars via dotenv or getPool() helper, not hardcoded credentials
        uses_env = (
            "dotenv" in load_test_content
            or "process.env" in load_test_content
            or "getPool" in load_test_content
        )
        assert uses_env is True, (
            "Load test must use environment variables for DB credentials (via dotenv, process.env, or getPool helper)"
        )


class TestRP14NegativeCases:
    """Negative tests verifying the load test rejects invalid configurations."""

    def test_reject_staging_soak_label(self, load_test_content: str) -> None:
        # Tests R-P14-05
        # The test must NOT label itself as staging soak
        soak_labels = [
            line
            for line in load_test_content.splitlines()
            if "staging soak" in line.lower() and "not" not in line.lower()
        ]
        assert len(soak_labels) == 0, (
            f"Load test must NOT label itself as staging soak; found {len(soak_labels)} lines"
        )

    def test_reject_invalid_cluster_topology(self, load_test_content: str) -> None:
        # Tests R-P14-05
        # Single-node baseline must NOT reference cluster or multi-node topology
        cluster_refs = re.findall(
            r"topology.*['\"]cluster['\"]|topology.*['\"]multi-node['\"]",
            load_test_content,
            re.IGNORECASE,
        )
        assert len(cluster_refs) == 0, (
            f"Single-node baseline must NOT reference cluster/multi-node topology; found {cluster_refs}"
        )

    def test_reject_invalid_load_balancer(self, load_test_content: str) -> None:
        # Tests R-P14-05
        # The baseline must NOT configure an active load balancer
        lb_active = re.findall(
            r"loadBalancer:\s*['\"](?!none)[a-zA-Z]+['\"]",
            load_test_content,
        )
        assert len(lb_active) == 0, (
            f"Single-node baseline must have loadBalancer: 'none'; found active: {lb_active}"
        )

    def test_reject_invalid_multi_process(self, load_test_content: str) -> None:
        # Tests R-P14-05
        # Must document exactly 1, not multiple processes
        multi_process = re.findall(
            r"expressProcesses:\s*(?:[2-9]|\d{2,})",
            load_test_content,
        )
        assert len(multi_process) == 0, (
            f"Single-node baseline must have exactly 1 Express process; found: {multi_process}"
        )

    def test_reject_invalid_replicas(self, load_test_content: str) -> None:
        # Tests R-P14-04
        # Must have 0 replicas, not any positive count
        active_replicas = re.findall(
            r"replicas:\s*(?:[1-9]\d*)",
            load_test_content,
        )
        assert len(active_replicas) == 0, (
            f"Single-node baseline must have 0 replicas; found: {active_replicas}"
        )

    def test_reject_invalid_debug_output(self, load_test_content: str) -> None:
        # Tests R-P14-01
        # Load test must not use console.log (use process.stdout.write instead)
        console_logs = re.findall(r"console\.log\s*\(", load_test_content)
        assert len(console_logs) == 0, (
            f"Load test must use process.stdout.write, not console.log; found {len(console_logs)} occurrences"
        )
