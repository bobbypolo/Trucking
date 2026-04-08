import pytest

from _server_lifecycle import _wait_for_port


def test_wait_for_port_times_out(monkeypatch):
    calls = {"count": 0}

    def fake_create_connection(*args, **kwargs):
        calls["count"] += 1
        raise OSError("connection refused")

    monkeypatch.setattr("socket.create_connection", fake_create_connection)

    with pytest.raises(TimeoutError):
        _wait_for_port("127.0.0.1", 65535, timeout=0.01)

    assert calls["count"] >= 1
