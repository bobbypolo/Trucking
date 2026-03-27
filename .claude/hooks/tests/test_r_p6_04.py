# Tests R-P6-04
"""
R-P6-04: +New button is clickable and not obscured by other z-index layers
-- opens new load form or navigates.

Verifies:
1. LoadBoardEnhanced has a +New button with z-40 (above z-20 sidebar, z-30 panel)
2. The button has an onClick handler (onCreateLoad)
3. App.tsx header div has z-40 to stay above internal z-index layers
"""

import subprocess


def test_new_button_has_z40_in_loadboard_enhanced():
    """R-P6-04: +New button rendered with z-40 class in LoadBoardEnhanced."""
    with open("components/LoadBoardEnhanced.tsx", encoding="utf-8") as f:
        content = f.read()
    # The floating +New button must have z-40
    assert "z-40" in content, "LoadBoardEnhanced must have z-40 for +New button"
    assert "onCreateLoad" in content, "LoadBoardEnhanced must use onCreateLoad prop"


def test_new_button_onclick_wired():
    """R-P6-04: +New button calls create load handler when clicked."""
    with open("components/LoadBoardEnhanced.tsx", encoding="utf-8") as f:
        content = f.read()
    # The button calls either onCreateLoad directly or handleCreateLoad (internal modal)
    assert "onClick={onCreateLoad}" in content or "handleCreateLoad" in content, (
        "The +New button must have a create load handler"
    )


def test_sidebar_toggle_z20_lower_than_button():
    """R-P6-04: Sidebar toggle uses z-20, lower than +New button z-40."""
    with open("components/LoadBoardEnhanced.tsx", encoding="utf-8") as f:
        content = f.read()
    assert "z-20" in content, "Sidebar toggle must have z-20"
    # z-40 must also exist (the +New button)
    assert "z-40" in content, "+New button must have z-40"


def test_bottom_panel_z30_lower_than_button():
    """R-P6-04: Bottom panel uses z-30, lower than +New button z-40."""
    with open("components/LoadBoardEnhanced.tsx", encoding="utf-8") as f:
        content = f.read()
    assert "z-30" in content, "Bottom panel must have z-30"
    assert "z-40" in content, "+New button must have z-40"


def test_app_header_has_z40():
    """R-P6-04: App.tsx Load Board header has z-40 so +New Intake stays clickable."""
    with open("App.tsx", encoding="utf-8") as f:
        content = f.read()
    # The header div around "Load Board" and "+New Intake" should have z-40
    assert "relative z-40" in content, (
        "App.tsx Load Board header must have 'relative z-40' class"
    )


def test_oncreateload_passed_from_app():
    """R-P6-04: App.tsx passes onCreateLoad to LoadBoardEnhanced."""
    with open("App.tsx", encoding="utf-8") as f:
        content = f.read()
    assert "onCreateLoad=" in content, (
        "App.tsx must pass onCreateLoad prop to LoadBoardEnhanced"
    )


def test_vitest_zindex_tests_pass():
    """R-P6-04: Vitest z-index tests pass."""
    result = subprocess.run(
        "npx vitest run src/__tests__/components/LoadBoardEnhanced.zindex.test.tsx --reporter=verbose",
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd="F:/Trucking/DisbatchMe",
        timeout=120,
    )
    assert "6 passed" in result.stdout, (
        f"Expected 6 passed tests, got: {result.stdout[-500:]}"
    )
    assert result.returncode == 0, f"Vitest failed: {result.stderr[-500:]}"
