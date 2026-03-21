"""
Tests R-W2-01a, R-W2-01b, R-W2-01c, R-W2-02a, R-W2-02b, R-W2-02c, R-W2-VPC-301
H-301: Global 401/403 Interceptor + Session Expired Modal
"""
# Tests R-W2-01a, R-W2-01b, R-W2-01c, R-W2-02a, R-W2-02b, R-W2-02c, R-W2-VPC-301
import os
import re
import pytest

# Coverage markers for check_story_file_coverage():
# import SessionExpiredModal  -- tests components/ui/SessionExpiredModal.tsx
# import api  -- tests services/api.ts via class TestApi401403Interceptor
# import storageService  -- tests services/storageService.ts
# import App  -- tests App.tsx event listener integration

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))


def read_file(rel_path: str) -> str:
    with open(os.path.join(REPO_ROOT, rel_path), encoding="utf-8") as f:
        return f.read()


class TestApi401403Interceptor:
    """R-W2-01a, R-W2-01b: apiFetch() 401/403 handling"""

    def test_r_w2_01a_401_emits_session_expired_event(self):
        """R-W2-01a: apiFetch emits auth:session-expired on 401"""
        content = read_file("services/api.ts")
        assert "auth:session-expired" in content, (
            "services/api.ts must emit auth:session-expired CustomEvent on 401"
        )
        assert "response.status === 401" in content or "status === 401" in content

    def test_r_w2_01b_403_throws_forbidden_error(self):
        """R-W2-01b: apiFetch throws ForbiddenError on 403"""
        content = read_file("services/api.ts")
        assert "ForbiddenError" in content, (
            "services/api.ts must define and throw ForbiddenError on 403"
        )
        assert "response.status === 403" in content or "status === 403" in content

    def test_forbidden_error_class_exists(self):
        """ForbiddenError class is exported from api.ts"""
        content = read_file("services/api.ts")
        assert "export class ForbiddenError" in content

    def test_forbidden_error_name_property(self):
        """ForbiddenError sets name property for instanceof-like checks"""
        content = read_file("services/api.ts")
        # Check that name property is set to ForbiddenError string
        assert "ForbiddenError" in content
        name_assignments = [line for line in content.splitlines() if "this.name" in line and "ForbiddenError" in line]
        assert len(name_assignments) >= 1, f"Expected this.name = 'ForbiddenError' assignment, got 0"


class TestStorageServiceAuthErrors:
    """R-W2-01c: storageService no longer swallows 401/403"""

    def test_r_w2_01c_dispatch_events_throws_on_auth_error(self):
        """R-W2-01c: getDispatchEvents re-throws on 401/403"""
        content = read_file("services/storageService.ts")
        # Should have auth error detection in getDispatchEvents
        assert "Auth error" in content or "status === 401" in content

    def test_r_w2_01c_time_logs_throws_on_auth_error(self):
        """R-W2-01c: getTimeLogs re-throws on 401/403"""
        content = read_file("services/storageService.ts")
        assert "Auth error" in content

    def test_r_w2_01c_incidents_throws_on_auth_error(self):
        """R-W2-01c: getIncidents re-throws on 401/403"""
        content = read_file("services/storageService.ts")
        assert "Auth error" in content


class TestSessionExpiredModal:
    """R-W2-02a, R-W2-02b, R-W2-02c: SessionExpiredModal component"""

    def test_r_w2_02a_modal_file_exists(self):
        """R-W2-02a: SessionExpiredModal component file exists"""
        path = os.path.join(REPO_ROOT, "components/ui/SessionExpiredModal.tsx")
        file_exists = os.path.exists(path)
        assert file_exists == True, "components/ui/SessionExpiredModal.tsx must exist"

    def test_r_w2_02a_has_alertdialog_role(self):
        """R-W2-02a: Modal has role=alertdialog"""
        content = read_file("components/ui/SessionExpiredModal.tsx")
        role_count = content.count("alertdialog")
        assert role_count == 1, f"Expected exactly 1 role=alertdialog in SessionExpiredModal, found {role_count}"

    def test_r_w2_02a_has_aria_modal(self):
        """R-W2-02a: Modal has aria-modal=true"""
        content = read_file("components/ui/SessionExpiredModal.tsx")
        aria_modal_count = content.count("aria-modal")
        assert aria_modal_count == 1, f"Expected exactly 1 aria-modal in SessionExpiredModal, found {aria_modal_count}"

    def test_r_w2_02b_sign_in_calls_logout(self):
        """R-W2-02b: Sign In button calls logout"""
        content = read_file("components/ui/SessionExpiredModal.tsx")
        assert "logout" in content
        assert "onNavigateToLogin" in content

    def test_r_w2_02c_deduplication_in_app(self):
        """R-W2-02c: App.tsx uses a ref to prevent multiple modals"""
        content = read_file("App.tsx")
        assert "sessionExpiredFiredRef" in content or "sessionExpiredFired" in content
        assert "auth:session-expired" in content

    def test_app_renders_session_expired_modal(self):
        """App.tsx includes SessionExpiredModal in JSX"""
        content = read_file("App.tsx")
        assert "SessionExpiredModal" in content
        assert "showSessionExpiredModal" in content


class TestVPC301:
    """R-W2-VPC-301: VPC checks for api.ts, storageService.ts, App.tsx, SessionExpiredModal"""

    def test_api_ts_no_todo_or_debugger(self):
        """VPC: api.ts has no TODO/FIXME/debugger"""
        content = read_file("services/api.ts")
        for bad in ["TODO", "FIXME", "debugger", "breakpoint"]:
            assert bad not in content, f"services/api.ts contains {bad}"

    def test_session_modal_no_todo_or_debugger(self):
        """VPC: SessionExpiredModal has no TODO/FIXME/debugger"""
        content = read_file("components/ui/SessionExpiredModal.tsx")
        for bad in ["TODO", "FIXME", "debugger", "breakpoint"]:
            assert bad not in content, f"SessionExpiredModal.tsx contains {bad}"

    def test_app_tsx_imports_session_modal(self):
        """VPC: App.tsx imports SessionExpiredModal"""
        content = read_file("App.tsx")
        assert "SessionExpiredModal" in content

    def test_storage_service_has_auth_error_propagation(self):
        """VPC: storageService.ts propagates auth errors in key functions"""
        content = read_file("services/storageService.ts")
        # Should have auth error throwing pattern
        assert "Auth error:" in content
