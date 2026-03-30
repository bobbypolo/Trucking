# Tests R-P6-01, R-P6-02, R-P6-03, R-P6-04, R-P6-05, R-P6-06
"""
Verification tests for Firebase Storage adapter and factory.

R-P6-01: FirebaseStorageAdapter implements StorageAdapter interface
R-P6-02: Upload paths are tenant-scoped
R-P6-03: getSignedUrl returns time-limited signed URL
R-P6-04: STORAGE_BACKEND=firebase selects Firebase adapter
R-P6-05: STORAGE_BACKEND=disk (default) selects disk adapter
R-P6-06: createStorageAdapter() factory exported from document.service.ts
"""
import os
import re

REPO_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)

ADAPTER_PATH = os.path.join(
    REPO_ROOT, "server", "services", "firebase-storage-adapter.ts"
)
SERVICE_PATH = os.path.join(
    REPO_ROOT, "server", "services", "document.service.ts"
)
TEST_PATH = os.path.join(
    REPO_ROOT,
    "server",
    "__tests__",
    "services",
    "firebase-storage-adapter.test.ts",
)


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_r_p6_01_adapter_implements_interface():
    """R-P6-01: FirebaseStorageAdapter implements StorageAdapter interface."""
    content = _read(ADAPTER_PATH)
    assert "StorageAdapter" in content, (
        "firebase-storage-adapter.ts must reference StorageAdapter interface"
    )
    assert "async uploadBlob(" in content, (
        "firebase-storage-adapter.ts must implement uploadBlob"
    )
    assert "async deleteBlob(" in content, (
        "firebase-storage-adapter.ts must implement deleteBlob"
    )
    assert "async getSignedUrl(" in content, (
        "firebase-storage-adapter.ts must implement getSignedUrl"
    )


def test_r_p6_02_tenant_scoped_paths():
    """R-P6-02: Upload paths are tenant-scoped."""
    # Verify the adapter and test reference tenant-scoped paths
    test_content = _read(TEST_PATH)
    pattern = r"tenants/[^/]+/documents/[^/]+/[^/]+"
    matches = re.findall(pattern, test_content)
    assert len(matches) >= 3, (
        f"Tests must verify tenant-scoped path format "
        f"tenants/{{companyId}}/documents/{{docId}}/{{filename}}, "
        f"found {len(matches)} path references"
    )


def test_r_p6_03_signed_url():
    """R-P6-03: getSignedUrl returns time-limited signed URL."""
    content = _read(ADAPTER_PATH)
    assert "getSignedUrl" in content, (
        "firebase-storage-adapter.ts must implement getSignedUrl"
    )
    assert "expires" in content, (
        "getSignedUrl must use expiry/expires parameter"
    )
    assert "action" in content and "read" in content, (
        "getSignedUrl must use action: 'read' for download URLs"
    )


def test_r_p6_04_firebase_backend_selection():
    """R-P6-04: STORAGE_BACKEND=firebase selects Firebase adapter."""
    content = _read(SERVICE_PATH)
    assert "firebase" in content.lower(), (
        "document.service.ts must reference 'firebase' backend"
    )
    assert "createFirebaseStorageAdapter" in content, (
        "document.service.ts must call createFirebaseStorageAdapter"
    )
    # Verify test coverage
    test_content = _read(TEST_PATH)
    assert "STORAGE_BACKEND" in test_content, (
        "Tests must verify STORAGE_BACKEND env var"
    )
    assert "firebase" in test_content.lower(), (
        "Tests must verify firebase backend selection"
    )


def test_r_p6_05_disk_default():
    """R-P6-05: STORAGE_BACKEND=disk (default) selects disk adapter."""
    content = _read(SERVICE_PATH)
    assert "disk" in content.lower(), (
        "document.service.ts must reference 'disk' backend"
    )
    assert "createDiskStorageAdapter" in content, (
        "document.service.ts must call createDiskStorageAdapter"
    )
    # Verify default behavior
    assert '"disk"' in content, (
        "document.service.ts must default to 'disk'"
    )


def test_r_p6_06_factory_exported():
    """R-P6-06: createStorageAdapter() factory exported from document.service.ts."""
    content = _read(SERVICE_PATH)
    assert "export" in content and "createStorageAdapter" in content, (
        "createStorageAdapter must be exported from document.service.ts"
    )
    # Verify test coverage exists
    test_content = _read(TEST_PATH)
    assert "createStorageAdapter" in test_content, (
        "Tests must verify createStorageAdapter factory"
    )


def test_vitest_test_file_exists():
    """Vitest test file for firebase-storage-adapter exists."""
    assert os.path.isfile(TEST_PATH), (
        f"Test file not found at {TEST_PATH}"
    )
    content = _read(TEST_PATH)
    assert "R-P6-01" in content, "Test file must contain R-P6-01 marker"
    assert "R-P6-02" in content, "Test file must contain R-P6-02 marker"
    assert "R-P6-03" in content, "Test file must contain R-P6-03 marker"
    assert "R-P6-04" in content, "Test file must contain R-P6-04 marker"
    assert "R-P6-05" in content, "Test file must contain R-P6-05 marker"
    assert "R-P6-06" in content, "Test file must contain R-P6-06 marker"
