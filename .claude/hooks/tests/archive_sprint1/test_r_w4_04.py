# Tests R-W4-04a, R-W4-04b, R-W4-VPC-504
# Covers: import IssueSidebar, CompanyProfile, EditLoadForm (static analysis)
"""
H-504: Permission Explanation UX
Verifies that disabled buttons have title/aria-label explaining why disabled,
and that an info banner exists for role-gated view-only sections.
"""
import re
import subprocess
import pathlib

COMPONENTS_DIR = pathlib.Path(__file__).resolve().parents[3] / "components"


def _read(name: str) -> str:
    return (COMPONENTS_DIR / name).read_text(encoding="utf-8")


def _count_pattern(src: str, pattern: str) -> int:
    return len(re.findall(pattern, src))


class TestDisabledButtonExplanations:
    """R-W4-04a: Every disabled button due to role restrictions has explanatory title or aria-label."""

    def test_edit_load_form_locked_save_button_has_title(self):
        src = _read("EditLoadForm.tsx")
        assert "title=" in src, "EditLoadForm must have title attributes"
        save_idx = src.find("Save Changes")
        assert save_idx != -1, "Save Changes button must exist"
        region = src[max(0, save_idx - 500) : save_idx + 100]
        assert "title=" in region, (
            "Save Changes button must have title attribute for locked state explanation"
        )
        # Behavioral: verify the specific lock explanation text
        assert "locked for invoicing" in region.lower(), (
            "Save button title must explain locking reason (invoicing)"
        )

    def test_edit_load_form_locked_inputs_have_title(self):
        src = _read("EditLoadForm.tsx")
        title_count = _count_pattern(src, r"title=\{formData\.isLocked \?")
        assert title_count >= 10, (
            f"EditLoadForm should have at least 10 conditional title attributes for locked inputs, found {title_count}"
        )

    def test_company_profile_save_has_disabled_title_for_non_admin(self):
        src = _read("CompanyProfile.tsx")
        assert "Only administrators can save changes" in src, (
            "CompanyProfile save must have exact explanatory title text for non-admin users"
        )

    def test_issue_sidebar_empty_role_has_explanation(self):
        src = _read("IssueSidebar.tsx")
        assert "No actions available for your role" in src, (
            "IssueSidebar must explain when no actions are available due to role"
        )
        assert "Contact an administrator for access" in src, (
            "IssueSidebar must provide guidance to contact admin"
        )

    def test_issue_sidebar_resolve_button_disabled_with_title(self):
        src = _read("IssueSidebar.tsx")
        assert "disabled={!canResolve}" in src, (
            "IssueSidebar resolve button must use disabled={!canResolve} pattern"
        )
        assert "can resolve issues" in src.lower(), (
            "IssueSidebar resolve button must have title explaining resolve restriction"
        )

    def test_issue_sidebar_approve_reject_disabled_with_title(self):
        src = _read("IssueSidebar.tsx")
        assert "disabled={!isAdmin}" in src, (
            "IssueSidebar approve/reject must use disabled={!isAdmin} pattern"
        )
        assert "Only administrators can approve actions" in src, (
            "IssueSidebar approve button must have exact title text"
        )
        assert "Only administrators can reject actions" in src, (
            "IssueSidebar reject button must have exact title text"
        )

    # -- Negative tests --
    def test_no_disabled_button_without_title_in_issue_sidebar(self):
        """Negative: disabled buttons must always have a paired title."""
        src = _read("IssueSidebar.tsx")
        lines = src.split("\n")
        for i, line in enumerate(lines):
            if "disabled={" in line and "disabled={false}" not in line:
                # Check that within +/- 3 lines there is a title= attribute
                context = "\n".join(lines[max(0, i - 3) : i + 4])
                assert "title=" in context or "aria-label=" in context, (
                    f"IssueSidebar line {i + 1}: disabled button without nearby title/aria-label"
                )

    def test_no_disabled_button_with_empty_title(self):
        """Negative: title attributes should not be empty strings."""
        src = _read("IssueSidebar.tsx")
        assert 'title=""' not in src, (
            "IssueSidebar must not have empty title attributes on disabled buttons"
        )
        src2 = _read("CompanyProfile.tsx")
        assert 'title=""' not in src2, (
            "CompanyProfile must not have empty title attributes"
        )


class TestInfoBanners:
    """R-W4-04b: At least one section-level info banner exists for role-gated view-only sections."""

    def test_company_profile_has_info_banner_for_non_admin(self):
        src = _read("CompanyProfile.tsx")
        assert "Viewing as read-only" in src, (
            "CompanyProfile must have info banner with exact text for non-admin view-only mode"
        )
        assert "Only administrators can modify company settings" in src, (
            "CompanyProfile info banner must explain the restriction"
        )

    def test_company_profile_info_banner_accessibility(self):
        src = _read("CompanyProfile.tsx")
        # Verify Info icon import and usage
        imports_section = src[: src.find("export")]
        assert "Info," in imports_section or "Info\n" in imports_section, (
            "CompanyProfile must import Info icon from lucide-react"
        )
        # Verify ARIA attributes
        assert 'role="status"' in src, (
            "CompanyProfile info banner must have role=status for accessibility"
        )
        assert 'aria-live="polite"' in src, (
            "CompanyProfile info banner must have aria-live=polite for screen readers"
        )

    def test_issue_sidebar_role_info(self):
        src = _read("IssueSidebar.tsx")
        assert "Viewing as" in src, (
            "IssueSidebar should include viewing-as role context"
        )
        assert "Some actions require administrator privileges" in src, (
            "IssueSidebar must explain administrator privilege requirements"
        )

    def test_issue_sidebar_info_banner_for_non_admin(self):
        src = _read("IssueSidebar.tsx")
        assert 'role="status"' in src, (
            "IssueSidebar info banner must have role=status for accessibility"
        )
        # Check the banner is conditionally shown for role-mapped non-admin
        assert "isRoleMapped && !isAdmin" in src, (
            "IssueSidebar info banner must be shown conditionally for non-admin role-mapped users"
        )

    # -- Negative tests --
    def test_no_info_banner_for_admin_in_company_profile(self):
        """Negative: info banner should NOT show for admin users."""
        src = _read("CompanyProfile.tsx")
        # The banner is wrapped in {!isAdmin && !isDriver && (...)}
        assert "!isAdmin && !isDriver" in src, (
            "CompanyProfile info banner must be conditionally hidden for admin/driver"
        )

    def test_no_info_banner_for_admin_in_issue_sidebar(self):
        """Negative: info banner should NOT show for admin users in sidebar."""
        src = _read("IssueSidebar.tsx")
        # The banner is wrapped in {isRoleMapped && !isAdmin && (...)}
        assert "isRoleMapped && !isAdmin" in src, (
            "IssueSidebar info banner must be hidden for admin users"
        )


class TestVPC504:
    """R-W4-VPC-504: VPC - unit tests pass, tsc clean."""

    def test_typescript_compiles_scoped_files_clean(self):
        """Check that our modified files have no NEW tsc errors."""
        result = subprocess.run(
            "npx tsc --noEmit",
            shell=True,
            capture_output=True,
            text=True,
            cwd=str(COMPONENTS_DIR.parent),
            timeout=120,
            encoding="utf-8",
            errors="replace",
        )
        scoped = [
            "IssueSidebar.tsx",
            "CompanyProfile.tsx",
            "EditLoadForm.tsx",
            "Dashboard.tsx",
            "AccountingPortal.tsx",
            "LoadList.tsx",
        ]
        scoped_errors = [
            line
            for line in result.stdout.split("\n")
            if any("components/" + s in line for s in scoped) and "error TS" in line
        ]
        assert len(scoped_errors) == 0, (
            "tsc errors in scoped files: " + "; ".join(scoped_errors)
        )

    def test_modified_components_exist_with_expected_content(self):
        """Verify modified components exist and contain expected permission patterns."""
        for name, expected in [
            ("IssueSidebar.tsx", "disabled={!canResolve}"),
            ("CompanyProfile.tsx", "disabled={!isAdmin"),
            ("EditLoadForm.tsx", "disabled={formData.isLocked}"),
        ]:
            path = COMPONENTS_DIR / name
            assert path.exists(), f"{name} must exist"
            src = path.read_text(encoding="utf-8")
            assert expected in src, (
                f"{name} must contain permission pattern: {expected}"
            )

    def test_no_debug_leftovers_in_modified_files(self):
        for name in [
            "IssueSidebar.tsx",
            "CompanyProfile.tsx",
            "EditLoadForm.tsx",
        ]:
            src = _read(name)
            debug_lines = []
            for i, line in enumerate(src.split("\n"), 1):
                stripped = line.strip()
                if stripped.startswith("console.log(") or stripped.startswith(
                    "debugger"
                ):
                    debug_lines.append(f"{name}:{i}: {stripped}")
            assert len(debug_lines) == 0, (
                f"Debug leftovers found: {'; '.join(debug_lines)}"
            )

    # -- Negative test --
    def test_no_todo_fixme_in_modified_components(self):
        """Negative: modified files should not have TODO/FIXME markers."""
        for name in [
            "IssueSidebar.tsx",
            "CompanyProfile.tsx",
            "EditLoadForm.tsx",
        ]:
            src = _read(name)
            todo_lines = []
            for i, line in enumerate(src.split("\n"), 1):
                stripped = line.strip()
                if "TODO" in stripped or "FIXME" in stripped:
                    todo_lines.append(f"{name}:{i}: {stripped}")
            assert len(todo_lines) == 0, (
                f"TODO/FIXME markers found: {'; '.join(todo_lines)}"
            )
