import pre_bash_guard


def test_check_command_allows_safe_commands():
    allowed, reason = pre_bash_guard.check_command("python -m pytest .claude/hooks/tests/ -v")
    assert allowed is True
    assert reason == ""


def test_check_command_blocks_recursive_delete():
    allowed, reason = pre_bash_guard.check_command("rm -rf /")
    assert allowed is False
    assert "Recursive delete" in reason


def test_check_command_unwraps_shell_wrapper():
    allowed, reason = pre_bash_guard.check_command("bash -c 'rm -rf /'")
    assert allowed is False
    assert reason

