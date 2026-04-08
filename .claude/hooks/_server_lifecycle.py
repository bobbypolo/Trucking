"""Server lifecycle management for dev server startup and teardown.

Provides managed_server() context manager for use in smoke testing and
frontend verification workflows.

Consumers: qa_runner.py _step_smoke_test(), ralph-worker frontend verification.
"""

import socket
import subprocess
import time
from collections.abc import Generator
from contextlib import contextmanager


@contextmanager
def managed_server(
    cmd: str,
    host: str = "127.0.0.1",
    port: int = 3000,
    timeout: int = 30,
) -> Generator[subprocess.Popen, None, None]:
    """Start a dev server subprocess, wait for it to be ready, then kill it on exit.

    Args:
        cmd: Shell command to start the server (e.g., 'npm start').
        host: Host to poll for readiness. Default: '127.0.0.1'.
        port: Port to poll for readiness. Default: 3000.
        timeout: Seconds to wait for port readiness before raising TimeoutError.

    Yields:
        subprocess.Popen: The running server process.

    Raises:
        TimeoutError: When the port does not become available within timeout seconds.
        OSError: When the server command fails to start.
    """
    proc = subprocess.Popen(
        cmd,
        shell=True,  # noqa: S603
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        _wait_for_port(host, port, timeout)
        yield proc
    finally:
        _kill_tree(proc)


def _wait_for_port(host: str, port: int, timeout: int) -> None:
    """Poll host:port until it accepts a TCP connection.

    Args:
        host: Hostname or IP to connect to.
        port: TCP port to connect to.
        timeout: Maximum seconds to wait.

    Raises:
        TimeoutError: When the port does not accept connections within timeout seconds.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.1)
    raise TimeoutError(
        f"Port {host}:{port} did not become available within {timeout} seconds"
    )


def _kill_tree(proc: subprocess.Popen) -> None:
    """Terminate the entire process tree rooted at proc.

    Uses psutil to kill child processes when available.
    Falls back to proc.kill() when psutil is not installed.

    Args:
        proc: The Popen process whose tree to terminate.
    """
    try:
        import psutil

        try:
            parent = psutil.Process(proc.pid)
        except psutil.NoSuchProcess:
            return
        children = parent.children(recursive=True)
        for child in children:
            try:
                child.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        try:
            parent.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    except (ImportError, ProcessLookupError, OSError):
        # psutil unavailable or process already dead — fall back to basic kill
        try:
            proc.kill()
        except OSError:
            pass
    finally:
        try:
            proc.wait(timeout=3)
        except (subprocess.TimeoutExpired, OSError):
            pass
