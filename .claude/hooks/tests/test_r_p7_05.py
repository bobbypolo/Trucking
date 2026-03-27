# Tests R-P7-05
"""
Dead button audit: verify no button elements lack onClick handlers
in remediated components (LoadDetailView, AccountingPortal, SafetyView,
Settlements, IntelligenceHub, QuoteManager).

Checks for:
- <button> elements without any onClick handler
- onClick={undefined}
- onClick={() => {}} (empty no-op)
- onClick that only calls console.log
"""

import os
import re
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
COMPONENTS = os.path.join(ROOT, "components")

TARGET_FILES = [
    "LoadDetailView.tsx",
    "AccountingPortal.tsx",
    "SafetyView.tsx",
    "Settlements.tsx",
    "IntelligenceHub.tsx",
    "QuoteManager.tsx",
]


def _read(filename: str) -> str:
    """Read a component file. Return '' if missing."""
    path = os.path.join(COMPONENTS, filename)
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def _find_dead_buttons(content: str) -> list[dict]:
    """
    Find <button> elements that lack functional onClick handlers.

    Returns list of dicts with 'line' and 'reason' keys.
    """
    dead = []
    lines = content.split("\n")

    # Pattern 1: onClick={undefined}
    for i, line in enumerate(lines, 1):
        if re.search(r"onClick=\{undefined\}", line):
            dead.append({"line": i, "reason": "onClick={undefined}"})

    # Pattern 2: onClick={() => {}} (empty body)
    for i, line in enumerate(lines, 1):
        if re.search(r"onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}", line):
            dead.append({"line": i, "reason": "onClick={() => {}} (no-op)"})

    # Pattern 3: onClick that only calls console.log
    for i, line in enumerate(lines, 1):
        m = re.search(r"onClick=\{\s*\(\)\s*=>\s*console\.log\([^)]*\)\s*\}", line)
        if m:
            dead.append({"line": i, "reason": "onClick only calls console.log"})

    # Pattern 4: <button> without onClick in element context
    # Parse multi-line button elements
    i = 0
    while i < len(lines):
        line = lines[i]
        if "<button" in line and "onClick" not in line:
            # Collect the full element opening tag
            tag_content = line
            j = i + 1
            tag_closed = ">" in line.split("<button", 1)[-1]
            while not tag_closed and j < len(lines) and j < i + 10:
                tag_content += "\n" + lines[j]
                if ">" in lines[j]:
                    tag_closed = True
                j += 1

            if "onClick" not in tag_content:
                # Exclude type="submit" buttons (form submit buttons are valid)
                # Exclude disabled buttons (intentionally non-interactive)
                if 'type="submit"' not in tag_content and "disabled" not in tag_content:
                    dead.append(
                        {
                            "line": i + 1,
                            "reason": "button element without onClick handler",
                        }
                    )
        i += 1

    return dead


class TestDeadButtonAudit:
    """Verify no dead buttons exist in remediated components."""

    @pytest.mark.parametrize("filename", TARGET_FILES)
    def test_no_dead_buttons(self, filename: str):
        content = _read(filename)
        assert content, f"{filename} not found or empty"
        dead = _find_dead_buttons(content)
        if dead:
            details = "\n".join(f"  Line {d['line']}: {d['reason']}" for d in dead)
            pytest.fail(f"{filename} has {len(dead)} dead button(s):\n{details}")

    @pytest.mark.parametrize("filename", TARGET_FILES)
    def test_no_onclick_undefined(self, filename: str):
        content = _read(filename)
        assert content, f"{filename} not found or empty"
        matches = re.findall(r"onClick=\{undefined\}", content)
        assert len(matches) == 0, (
            f"{filename} has {len(matches)} onClick={{undefined}} occurrence(s)"
        )

    @pytest.mark.parametrize("filename", TARGET_FILES)
    def test_no_empty_onclick(self, filename: str):
        content = _read(filename)
        assert content, f"{filename} not found or empty"
        matches = re.findall(r"onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}", content)
        assert len(matches) == 0, (
            f"{filename} has {len(matches)} empty onClick handler(s)"
        )
