# Tests R-W6-02a, R-W6-02b, R-W6-02c, R-W6-VPC-702
"""
QA traceability tests for H-702: Wire FileVault Upload-Download Round Trip.

R-W6-02a: POST /api/documents/upload stores file via DiskStorageAdapter and returns metadata
R-W6-02b: GET /api/documents/:id/download retrieves file from DiskStorageAdapter
R-W6-02c: FileVault component calls upload/download endpoints
R-W6-VPC-702: VPC: server unit tests pass, tsc clean
"""

import os
import subprocess

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def test_r_w6_02a_documents_route_uses_disk_storage_adapter():
    """R-W6-02a: POST /api/documents stores file via DiskStorageAdapter."""
    route_path = os.path.join(PROJECT_ROOT, "server", "routes", "documents.ts")
    assert os.path.isfile(route_path), f"Route file not found: {route_path}"

    with open(route_path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Verify DiskStorageAdapter is imported and used
    assert "createDiskStorageAdapter" in content, (
        "documents.ts must import createDiskStorageAdapter"
    )
    # Verify no-op memoryStorageAdapter is replaced
    assert "memoryStorageAdapter" not in content, (
        "documents.ts should no longer use memoryStorageAdapter"
    )
    # Verify the factory uses disk storage by default
    assert "defaultStorageAdapter" in content, (
        "documents.ts must define defaultStorageAdapter using createDiskStorageAdapter"
    )


def test_r_w6_02a_vault_docs_route_uses_disk_storage_adapter():
    """R-W6-02a: vault-docs route also wired to DiskStorageAdapter."""
    route_path = os.path.join(
        PROJECT_ROOT, "server", "routes", "vault-docs.ts"
    )
    assert os.path.isfile(route_path), f"Route file not found: {route_path}"

    with open(route_path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Verify DiskStorageAdapter is imported and used
    assert "createDiskStorageAdapter" in content, (
        "vault-docs.ts must import createDiskStorageAdapter"
    )
    assert "memoryStorageAdapter" not in content, (
        "vault-docs.ts should no longer use memoryStorageAdapter"
    )


def test_r_w6_02b_download_endpoint_exists():
    """R-W6-02b: GET /api/documents/:id/download endpoint exists."""
    route_path = os.path.join(PROJECT_ROOT, "server", "routes", "documents.ts")

    with open(route_path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    assert "/api/documents/:id/download" in content, (
        "Download endpoint must exist in documents.ts"
    )
    # Verify the endpoint uses getDownloadUrl which goes through DiskStorageAdapter
    assert "getDownloadUrl" in content, (
        "Download endpoint must call getDownloadUrl"
    )


def test_r_w6_02b_roundtrip_test_exists():
    """R-W6-02b: Round-trip test file exists and covers upload+download."""
    test_path = os.path.join(
        PROJECT_ROOT,
        "server",
        "__tests__",
        "routes",
        "documents-disk-roundtrip.test.ts",
    )
    assert os.path.isfile(test_path), f"Round-trip test file not found: {test_path}"

    with open(test_path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Verify upload and download test coverage
    assert "R-W6-02a" in content, "Test must reference R-W6-02a acceptance criterion"
    assert "R-W6-02b" in content, "Test must reference R-W6-02b acceptance criterion"
    assert "POST" in content or "post(" in content, "Test must cover upload (POST)"
    assert "download" in content.lower(), "Test must cover download endpoint"


def test_r_w6_02c_filevault_calls_download_endpoint():
    """R-W6-02c: FileVault component calls upload/download endpoints."""
    component_path = os.path.join(PROJECT_ROOT, "components", "FileVault.tsx")
    assert os.path.isfile(component_path), (
        f"FileVault component not found: {component_path}"
    )

    with open(component_path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Verify download function is imported and used
    assert "downloadVaultDoc" in content, (
        "FileVault must import downloadVaultDoc"
    )
    # Verify upload function is imported and used
    assert "uploadVaultDoc" in content, (
        "FileVault must import uploadVaultDoc"
    )
    # Verify download handler is wired to a button
    assert "handleDownload" in content, (
        "FileVault must have a handleDownload handler"
    )
    assert "onClick" in content and "handleDownload" in content, (
        "FileVault download button must have an onClick handler"
    )


def test_r_w6_02c_vault_service_has_download_function():
    """R-W6-02c: Vault service exports download function for FileVault."""
    service_path = os.path.join(
        PROJECT_ROOT, "services", "storage", "vault.ts"
    )
    assert os.path.isfile(service_path), (
        f"Vault service not found: {service_path}"
    )

    with open(service_path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    assert "downloadVaultDoc" in content, (
        "vault.ts must export downloadVaultDoc function"
    )
    assert "getDocumentDownloadUrl" in content, (
        "vault.ts must export getDocumentDownloadUrl function"
    )
    # Verify it calls the download API endpoint
    assert "/documents/" in content and "/download" in content, (
        "vault.ts download function must call /documents/:id/download endpoint"
    )


def test_r_w6_vpc_702_roundtrip_tests_pass():
    """R-W6-VPC-702: Server unit tests pass for round-trip."""
    result = subprocess.run(
        "npx vitest run __tests__/routes/documents-disk-roundtrip.test.ts",
        cwd=os.path.join(PROJECT_ROOT, "server"),
        shell=True,
        capture_output=True,
        text=True,
        timeout=60,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, (
        f"Round-trip tests failed:\n{result.stdout}\n{result.stderr}"
    )


def test_r_w6_vpc_702_tsc_clean():
    """R-W6-VPC-702: TypeScript compilation is clean (no errors)."""
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
    assert result.returncode == 0, f"tsc failed:\n{result.stdout}\n{result.stderr}"
