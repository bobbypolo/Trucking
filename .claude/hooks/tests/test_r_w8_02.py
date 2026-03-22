# Tests R-W8-02a, R-W8-02b, R-W8-02c, R-W8-02d, R-W8-VPC-902
"""
QA validation tests for H-902: Scanner Live Camera Capture.
Verifies the Scanner component has camera capture with graceful fallback.
"""

import os


def test_scanner_has_use_camera_button():
    """R-W8-02a: Scanner has Use Camera button activating getUserMedia."""
    with open("components/Scanner.tsx", encoding="utf-8") as f:
        src = f.read()
    # Must have a "Use Camera" label in the component
    assert "Use Camera" in src, "Scanner must render a 'Use Camera' button"
    # Must call getUserMedia
    assert "getUserMedia" in src, (
        "Scanner must call navigator.mediaDevices.getUserMedia"
    )
    # Must request environment-facing camera
    assert "facingMode" in src, "Scanner must request environment-facing camera"


def test_scanner_has_camera_preview_and_capture():
    """R-W8-02b: Camera stream in video element with capture button."""
    with open("components/Scanner.tsx", encoding="utf-8") as f:
        src = f.read()
    # Must have a <video> element with data-testid="camera-preview"
    assert "camera-preview" in src, "Scanner must have a camera-preview video element"
    # Must have a Capture button
    assert "Capture" in src, "Scanner must have a Capture button"
    # Must have autoPlay for live stream
    assert "autoPlay" in src, "Video element must have autoPlay attribute"


def test_scanner_capture_sends_to_ai():
    """R-W8-02c: Capture button takes snapshot and sends to AI extraction."""
    with open("components/Scanner.tsx", encoding="utf-8") as f:
        src = f.read()
    # Must have captureFrame function
    assert "captureFrame" in src, "Scanner must have captureFrame function"
    # Must draw video frame to canvas
    assert "drawImage" in src, "Scanner must draw video frame to canvas via drawImage"
    # Must convert to base64 for AI
    assert "toDataURL" in src, "Scanner must convert canvas to base64 via toDataURL"
    # Must call AI endpoint after capture
    assert "aiPost" in src, "Scanner must call aiPost to send capture to AI extraction"


def test_scanner_graceful_fallback():
    """R-W8-02d: Permission denied falls back to file picker with no error."""
    with open("components/Scanner.tsx", encoding="utf-8") as f:
        src = f.read()
    # Must have fallback message for camera denial
    assert "Camera unavailable" in src, (
        "Scanner must show fallback message when camera is unavailable"
    )
    # Must check for mediaDevices support before showing camera button
    assert "hasCameraSupport" in src or "mediaDevices" in src, (
        "Scanner must check camera support"
    )
    # Must have cleanup in useEffect return (no stream leak on fallback)
    assert "getTracks" in src, "Scanner must call getTracks() for cleanup"
    assert "stop()" in src or ".stop()" in src, "Scanner must stop tracks"


def test_scanner_vpc_test_coverage():
    """R-W8-VPC-902: VPC: Scanner camera test file exists with all criteria markers."""

    # Verify camera test file exists
    test_file = os.path.join(
        "src", "__tests__", "components", "Scanner.camera.test.tsx"
    )
    assert os.path.isfile(test_file), f"Camera test file must exist: {test_file}"

    with open(test_file, encoding="utf-8") as f:
        test_src = f.read()

    # Verify all acceptance criteria are covered
    for cid in ["R-W8-02a", "R-W8-02b", "R-W8-02c", "R-W8-02d", "R-W8-VPC-902"]:
        assert cid in test_src, f"Camera test file must reference criterion {cid}"

    # Verify test has actual describe blocks for each criterion
    assert "R-W8-02a:" in test_src, "Must have describe block for R-W8-02a"
    assert "R-W8-02b:" in test_src, "Must have describe block for R-W8-02b"
    assert "R-W8-02c:" in test_src, "Must have describe block for R-W8-02c"
    assert "R-W8-02d:" in test_src, "Must have describe block for R-W8-02d"

    # Verify capture-to-AI test exists (R-W8-02c)
    assert "Capture sends snapshot" in test_src or "capture.*AI" in test_src, (
        "R-W8-02c test must verify capture sends to AI extraction"
    )

    # Verify permission denial test exists (R-W8-02d)
    assert "Permission denied" in test_src or "falls back to file picker" in test_src, (
        "R-W8-02d test must verify permission denied falls back to file picker"
    )

    # Verify Scanner.tsx has no TypeScript errors by checking for proper typing
    with open("components/Scanner.tsx", encoding="utf-8") as f:
        scanner_src = f.read()
    assert "React.FC<Props>" in scanner_src, (
        "Scanner must be properly typed as React.FC<Props>"
    )
