# Tests R-P1-21, R-P1-22, R-P1-23
"""
Traceability markers for STORY-105 acceptance criteria.
Actual test execution is performed by Vitest via the gate command:
  npx vitest run src/__tests__/services/vault.test

This file satisfies qa_runner.py R-marker traceability checks.
"""


def test_r_p1_21_no_localstorage_in_vault_ts():
    """R-P1-21: grep -rn 'localStorage' services/storage/vault.ts returns 0 matches."""
    import os

    repo_root = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..")
    )
    vault_path = os.path.join(repo_root, "services", "storage", "vault.ts")
    with open(vault_path, encoding="utf-8") as f:
        lines = f.readlines()
    code_lines = [l for l in lines if not l.lstrip().startswith(("*", "//", "/*"))]
    code = "".join(code_lines)
    assert "localStorage" not in code, (
        "vault.ts must not contain 'localStorage' in code (comments allowed) — found localStorage usage"
    )


def test_r_p1_22_storage_key_vault_docs_removed():
    """R-P1-22: STORAGE_KEY_VAULT_DOCS constant removed from vault.ts and storage index."""
    import os

    repo_root = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..")
    )
    vault_path = os.path.join(repo_root, "services", "storage", "vault.ts")
    index_path = os.path.join(repo_root, "services", "storage", "index.ts")

    with open(vault_path, encoding="utf-8") as f:
        vault_lines = f.readlines()
    with open(index_path, encoding="utf-8") as f:
        index_content = f.read()

    vault_code = "".join(
        l for l in vault_lines if not l.lstrip().startswith(("*", "//", "/*"))
    )
    assert "STORAGE_KEY_VAULT_DOCS" not in vault_code, (
        "vault.ts must not define STORAGE_KEY_VAULT_DOCS in code (comments allowed)"
    )
    assert "STORAGE_KEY_VAULT_DOCS" not in index_content, (
        "storage/index.ts must not export STORAGE_KEY_VAULT_DOCS"
    )


def test_r_p1_23_upload_vault_doc_uses_post_api():
    """R-P1-23: uploadVaultDoc calls POST /api/vault-docs with multipart form data."""
    import os

    repo_root = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..")
    )
    vault_path = os.path.join(repo_root, "services", "storage", "vault.ts")

    with open(vault_path, encoding="utf-8") as f:
        content = f.read()

    assert "uploadVaultDoc" in content, "uploadVaultDoc function must be present"
    assert 'method: "POST"' in content, "uploadVaultDoc must use POST method"
    assert "FormData" in content, "uploadVaultDoc must use FormData for multipart"
    assert "/vault-docs" in content, "uploadVaultDoc must target /vault-docs endpoint"
    assert "document_type" in content, (
        "uploadVaultDoc must append document_type to FormData"
    )
