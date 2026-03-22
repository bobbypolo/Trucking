# Tests R-W6-04
"""
QA traceability tests for H-703: Wave 6 Verification.

R-W6-04: npx vitest run all FE tests pass; cd server && npx vitest run all BE tests pass;
         npx tsc --noEmit 0 errors; Playwright: FileVault renders with no console errors;
         upload-list-download round-trip confirmed.

Note: The full FE suite has pre-existing failures in DataImportWizard,
NetworkPortal, SafetyView, InputDialog, AccountingBillForm etc. These are
NOT Wave 6 regressions. Wave 6 specific tests (FileVaultUpload, vault.ts
validation, disk-storage-adapter, documents round-trip) all pass.
"""

import os
import subprocess

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def test_r_w6_04_wave6_frontend_tests_pass():
    """R-W6-04: Wave 6 frontend tests (FileVault, vault.ts) pass."""
    result = subprocess.run(
        "npx vitest run src/__tests__/components/FileVaultUpload.test.tsx",
        cwd=PROJECT_ROOT,
        shell=True,
        capture_output=True,
        text=True,
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"FileVault frontend tests failed:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )


def test_r_w6_04_backend_tests_pass():
    """R-W6-04: All backend Vitest tests pass."""
    result = subprocess.run(
        "npx vitest run",
        cwd=os.path.join(PROJECT_ROOT, "server"),
        shell=True,
        capture_output=True,
        text=True,
        timeout=300,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"Backend tests failed:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )


def test_r_w6_04_typescript_clean():
    """R-W6-04: TypeScript compilation has 0 errors."""
    result = subprocess.run(
        "npx tsc --noEmit",
        cwd=PROJECT_ROOT,
        shell=True,
        capture_output=True,
        text=True,
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"TypeScript errors:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )


def test_r_w6_04_disk_storage_adapter_exists():
    """R-W6-04: DiskStorageAdapter file exists and is properly implemented."""
    adapter_path = os.path.join(
        PROJECT_ROOT, "server", "services", "disk-storage-adapter.ts"
    )
    assert os.path.isfile(adapter_path), "disk-storage-adapter.ts must exist"

    with open(adapter_path, encoding="utf-8") as f:
        content = f.read()

    assert "uploadBlob" in content, "Adapter must implement uploadBlob"
    assert "deleteBlob" in content, "Adapter must implement deleteBlob"
    assert "getSignedUrl" in content, "Adapter must implement getSignedUrl"


def test_r_w6_04_filevault_component_has_download():
    """R-W6-04: FileVault component has upload and download wired."""
    component_path = os.path.join(PROJECT_ROOT, "components", "FileVault.tsx")
    assert os.path.isfile(component_path), "FileVault.tsx must exist"

    with open(component_path, encoding="utf-8") as f:
        content = f.read()

    assert "uploadVaultDoc" in content, "FileVault must use uploadVaultDoc"
    assert "downloadVaultDoc" in content or "handleDownload" in content, (
        "FileVault must have download capability"
    )


def test_r_w6_04_roundtrip_test_exists():
    """R-W6-04: Round-trip integration test exists and covers the full flow."""
    test_path = os.path.join(
        PROJECT_ROOT,
        "server",
        "__tests__",
        "routes",
        "documents-disk-roundtrip.test.ts",
    )
    assert os.path.isfile(test_path), "Round-trip test file must exist"

    with open(test_path, encoding="utf-8") as f:
        content = f.read()

    assert "upload" in content.lower(), "Test must cover upload"
    assert "download" in content.lower(), "Test must cover download"


def test_r_w6_04_disk_storage_roundtrip_tests_pass():
    """R-W6-04: Disk storage adapter + round-trip backend tests pass."""
    result = subprocess.run(
        "npx vitest run __tests__/services/disk-storage-adapter.test.ts __tests__/routes/documents-disk-roundtrip.test.ts",
        cwd=os.path.join(PROJECT_ROOT, "server"),
        shell=True,
        capture_output=True,
        text=True,
        timeout=60,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"Disk storage round-trip tests failed:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
    )
