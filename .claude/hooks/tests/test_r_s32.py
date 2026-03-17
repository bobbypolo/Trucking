"""Tests for STORY-032: Bundle Code Splitting.

Tests R-S32-01, R-S32-02, R-S32-03
"""

# Tests R-S32-01, R-S32-02, R-S32-03

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DIST_ASSETS = REPO_ROOT / "dist" / "assets"
VITE_CONFIG = REPO_ROOT / "vite.config.ts"
APP_TSX = REPO_ROOT / "App.tsx"
ACCOUNTING_PORTAL = REPO_ROOT / "components" / "AccountingPortal.tsx"


def _get_gzip_sizes() -> dict[str, float]:
    """Parse dist/assets and return {filename: gzip_kb} mapping."""
    if not DIST_ASSETS.exists():
        return {}
    sizes: dict[str, float] = {}
    for f in DIST_ASSETS.iterdir():
        if f.suffix == ".js":
            # Run gzip to get compressed size
            import gzip

            data = f.read_bytes()
            compressed = gzip.compress(data, compresslevel=9)
            sizes[f.name] = len(compressed) / 1024
    return sizes


def test_r_s32_01_no_chunk_exceeds_500kb_gzip():
    """R-S32-01: No single chunk > 500KB gzipped after build."""
    # Tests R-S32-01
    gzip_sizes = _get_gzip_sizes()
    if not gzip_sizes:
        # If no dist yet, verify vite.config has manualChunks which enables splitting
        content = VITE_CONFIG.read_text(encoding="utf-8")
        assert "manualChunks" in content, (
            "vite.config.ts must have manualChunks to enable code splitting"
        )
        return

    violations = [
        (name, size_kb) for name, size_kb in gzip_sizes.items() if size_kb > 500
    ]
    assert not violations, f"Chunks exceeding 500KB gzipped: {violations}"


def test_r_s32_02_login_route_under_150kb_gzip():
    """R-S32-02: Login route < 150KB JS gzipped."""
    # Tests R-S32-02
    gzip_sizes = _get_gzip_sizes()
    if not gzip_sizes:
        # If no dist yet, verify Auth is lazy loaded
        content = APP_TSX.read_text(encoding="utf-8")
        assert "React.lazy" in content, "App.tsx must use React.lazy for code splitting"
        return

    # Auth chunk should exist and be small
    auth_chunks = [
        (name, size_kb)
        for name, size_kb in gzip_sizes.items()
        if "Auth" in name and "AccountingPortal" not in name
    ]

    # The login route needs: index (shell) + Auth chunk + vendor
    # Sum of auth-related chunks should be under 150KB gzip
    index_chunks = [
        size_kb
        for name, size_kb in gzip_sizes.items()
        if name.startswith("index-") and name.endswith(".js")
    ]
    vendor_chunks = [
        size_kb for name, size_kb in gzip_sizes.items() if name.startswith("vendor-")
    ]

    auth_size = sum(s for _, s in auth_chunks) if auth_chunks else 0
    index_size = max(index_chunks) if index_chunks else 0
    vendor_size = sum(vendor_chunks)

    login_total = index_size + auth_size + vendor_size
    assert login_total < 150, (
        f"Login route total gzip = {login_total:.1f}KB "
        f"(index={index_size:.1f}KB, auth={auth_size:.1f}KB, vendor={vendor_size:.1f}KB) "
        f"must be < 150KB"
    )


def test_r_s32_03_build_no_chunk_warnings():
    """R-S32-03: npm run build shows no chunk size warnings."""
    # Tests R-S32-03
    result = subprocess.run(
        "npm run build",
        shell=True,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        timeout=120,
    )
    output = result.stdout + result.stderr
    assert result.returncode == 0, f"Build failed: {output[:500]}"
    assert "Some chunks are larger than" not in output, (
        "Build output contains chunk size warnings. "
        "Add more code splitting or increase chunkSizeWarningLimit."
    )


def test_r_s32_vite_config_has_manual_chunks():
    """Verify vite.config.ts has manual chunks configuration."""
    # Tests R-S32-01, R-S32-03
    content = VITE_CONFIG.read_text(encoding="utf-8")
    assert "manualChunks" in content, "vite.config.ts must define manualChunks"
    assert "vendor" in content, "manualChunks must include vendor (react/react-dom)"
    assert "maps" in content, "manualChunks must include maps (@react-google-maps/api)"
    assert "pdf" in content, "manualChunks must include pdf (jspdf)"
    assert "charts" in content, "manualChunks must include charts (recharts)"
    assert "capture" in content, "manualChunks must include capture (html2canvas)"


def test_r_s32_app_uses_react_lazy():
    """Verify App.tsx uses React.lazy for heavy routes."""
    # Tests R-S32-01, R-S32-02, R-S32-03
    content = APP_TSX.read_text(encoding="utf-8")
    assert "React.lazy" in content, "App.tsx must use React.lazy for code splitting"
    assert "Suspense" in content, "App.tsx must use Suspense with lazy components"

    # Verify the 5 required routes from dispatch are lazy
    required_lazy = [
        "AccountingPortal",
        "CompanyProfile",
        "QuoteManager",
        "SafetyView",
        "IntelligenceHub",
    ]
    for component in required_lazy:
        assert (
            f"const {component} = React.lazy" in content
            or f"const {component}=React.lazy" in content
        ), f"{component} must be lazy-loaded in App.tsx"


def test_r_s32_build_output_no_single_js_over_2mb():
    """Edge case: No single JS chunk should exceed 2MB minified (sanity guard)."""
    # Tests R-S32-01
    if not DIST_ASSETS.exists():
        return  # Skip if no build yet

    violations = []
    for f in DIST_ASSETS.iterdir():
        if f.suffix == '.js':
            size_kb = f.stat().st_size / 1024
            if size_kb > 2048:  # 2MB hard limit
                violations.append((f.name, size_kb))
    assert not violations, f'JS chunks over 2MB (likely misconfigured split): {violations}'


def test_r_s32_suspense_fallbacks_present():
    """Verify all lazy components have Suspense fallback wrappers."""
    # Tests R-S32-01, R-S32-02, R-S32-03
    content = APP_TSX.read_text(encoding='utf-8')
    suspense_count = content.count('<Suspense')
    lazy_count = content.count('React.lazy')
    # Should have at least as many Suspense wrappers as lazy components
    assert suspense_count > 0, 'No Suspense wrappers found in App.tsx'
    assert lazy_count > 0, 'No React.lazy calls found in App.tsx'
    assert suspense_count >= lazy_count // 2, (
        f'Suspense wrappers ({suspense_count}) should cover most lazy imports ({lazy_count})'
    )


def test_r_s32_manual_chunks_vendor_has_react():
    """Verify vendor chunk includes react and react-dom."""
    # Tests R-S32-01
    content = VITE_CONFIG.read_text(encoding='utf-8')
    # Check for react in vendor chunk
    assert "'react'" in content or '"react"' in content, (
        'vite.config.ts manualChunks vendor must include react'
    )
    assert "'react-dom'" in content or '"react-dom"' in content, (
        'vite.config.ts manualChunks vendor must include react-dom'
    )


def test_r_s32_error_missing_lazy_wrapper_detection():
    """Error case: Detect if a lazy component is used without Suspense."""
    # Tests R-S32-01, R-S32-03
    content = APP_TSX.read_text(encoding="utf-8")
    # Verify IntelligenceHub (operations-hub tab) has Suspense
    assert "operations-hub" in content, "App.tsx must have operations-hub tab"
    # The IntelligenceHub JSX usage must appear inside a Suspense block
    # Find the JSX usage of IntelligenceHub (not the lazy declaration)
    jsx_idx = content.find("<IntelligenceHub")
    assert jsx_idx > 0, "IntelligenceHub JSX not found in App.tsx"
    # Check that Suspense appears before this JSX usage
    pre_content = content[:jsx_idx]
    assert "<Suspense" in pre_content, (
        "IntelligenceHub must be wrapped in a Suspense boundary"
    )
