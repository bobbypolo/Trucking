# Tests R-P1-16, R-P1-17, R-P1-18, R-P1-19, R-P1-20
# Modules under test (import traceability for story file coverage):
# import safetyService
"""
Acceptance criteria verification for STORY-104:
Frontend — Migrate safetyService to API
"""

import subprocess
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SAFETY_SERVICE = REPO_ROOT / "services" / "safetyService.ts"


def test_r_p1_16_no_localstorage():
    """R-P1-16: grep -rn 'localStorage' services/safetyService.ts returns 0 matches"""
    content = SAFETY_SERVICE.read_text(encoding="utf-8")
    matches = [line for line in content.splitlines() if "localStorage" in line]
    assert matches == [], f"Found localStorage references: {matches}"


def test_r_p1_17_no_key_constants():
    """R-P1-17: No KEY constants in safetyService.ts"""
    content = SAFETY_SERVICE.read_text(encoding="utf-8")
    pattern = r"QUIZZES_KEY|QUIZ_RESULTS_KEY|MAINTENANCE_KEY|TICKETS_KEY|VENDORS_KEY|SAFETY_ACTIVITY_KEY"
    matches = re.findall(pattern, content)
    assert matches == [], f"Found key constants: {matches}"


def test_r_p1_18_functions_are_async():
    """R-P1-18: All safetyService functions are async and fetch from API"""
    content = SAFETY_SERVICE.read_text(encoding="utf-8")
    # All exported getter/saver functions should be async
    async_exports = re.findall(r"export const \w+ = async", content)
    assert len(async_exports) >= 10, (
        f"Expected at least 10 async exported functions, found {len(async_exports)}"
    )
    # Should use fetch
    assert "fetch(" in content, "No fetch() calls found in safetyService.ts"
    assert "getAuthHeaders()" in content, (
        "getAuthHeaders() not used in safetyService.ts"
    )


def test_r_p1_19_getequipment_uses_getauthheaders():
    """R-P1-19: getEquipment and getComplianceRecords use getAuthHeaders() instead of localStorage.getItem('token')"""
    content = SAFETY_SERVICE.read_text(encoding="utf-8")

    # Extract getEquipment function body
    equip_match = re.search(
        r"export const getEquipment = async.*?^};",
        content,
        re.DOTALL | re.MULTILINE,
    )
    assert equip_match, "getEquipment function not found"
    equip_body = equip_match.group(0)
    assert "localStorage" not in equip_body, "getEquipment still uses localStorage"
    assert "getAuthHeaders" in equip_body, "getEquipment does not use getAuthHeaders()"

    # Extract getComplianceRecords function body
    compliance_match = re.search(
        r"export const getComplianceRecords = async.*?^};",
        content,
        re.DOTALL | re.MULTILINE,
    )
    assert compliance_match, "getComplianceRecords function not found"
    compliance_body = compliance_match.group(0)
    assert "localStorage" not in compliance_body, (
        "getComplianceRecords still uses localStorage"
    )
    assert "getAuthHeaders" in compliance_body, (
        "getComplianceRecords does not use getAuthHeaders()"
    )


def test_r_p1_20_tests_pass():
    """R-P1-20: Existing safetyService tests pass with updated mocks"""
    result = subprocess.run(
        "npx vitest run src/__tests__/services/safetyService",
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"safetyService tests failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
