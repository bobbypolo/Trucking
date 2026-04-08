"""Smoke check CLI — verify HTTP endpoints return 2xx responses.

Usage:
    python .claude/hooks/_smoke_check.py --endpoints /health /ready \\
        --host 127.0.0.1 --port 3000 --timeout 5

Exit codes:
    0  All endpoints returned 2xx.
    1  One or more endpoints failed (non-2xx, connection refused, or timeout).
    2  Invalid CLI arguments (argparse error).
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request


def _check_endpoint(host: str, port: int, endpoint: str, timeout: float) -> str | None:
    """Check a single endpoint. Return None on success, error message on failure."""
    url = f"http://{host}:{port}{endpoint}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            status = resp.status
            if 200 <= status < 300:
                return None
            return f"FAIL {endpoint}: HTTP {status}"
    except urllib.error.HTTPError as exc:
        return f"FAIL {endpoint}: HTTP {exc.code}"
    except urllib.error.URLError as exc:
        reason = str(exc.reason)
        if "refused" in reason.lower() or "connect" in reason.lower():
            return f"FAIL {endpoint}: connection refused — is the dev server running?"
        if "timed out" in reason.lower() or "time" in reason.lower():
            return f"FAIL {endpoint}: timed out after {timeout:.0f}s"
        return f"FAIL {endpoint}: {reason}"
    except TimeoutError:
        return f"FAIL {endpoint}: timed out after {timeout:.0f}s"
    except OSError as exc:
        return f"FAIL {endpoint}: {exc}"


def main(argv: list[str] | None = None) -> int:
    """Entry point. Returns exit code (0 = all OK, 1 = any failure, 2 = bad args)."""
    parser = argparse.ArgumentParser(
        description="Smoke-check HTTP endpoints for 2xx responses.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "--endpoints",
        nargs="+",
        default=["/health"],
        metavar="PATH",
        help="URL paths to check (default: /health)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Hostname or IP (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=3000,
        help="Port number (default: 3000)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5,
        help="Per-request timeout in seconds (default: 5)",
    )

    args = parser.parse_args(argv)

    failures: list[str] = []
    for endpoint in args.endpoints:
        error = _check_endpoint(args.host, args.port, endpoint, args.timeout)
        if error is None:
            sys.stdout.write(f"OK {endpoint}\n")
        else:
            sys.stderr.write(f"{error}\n")
            failures.append(error)

    if failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
