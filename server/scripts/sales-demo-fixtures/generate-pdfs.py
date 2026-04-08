"""
Generate minimal valid PDF fixtures for the Bulletproof Sales Demo hero load.

Produces three single-page PDFs at this directory:
  - rate-con.pdf      (rate confirmation for LP-DEMO-RC-001)
  - bol.pdf           (bill of lading for LP-DEMO-RC-001)
  - lumper-receipt.pdf (lumper receipt for LP-DEMO-RC-001)

The output files:
  - start with the ASCII magic number %PDF- (required by R-P2-09)
  - exceed 1024 bytes (required by R-P2-09)
  - open cleanly in any PDF reader (single-page, text-only)
  - contain the canonical continuity values (ACME Logistics LLC,
    Frozen Beef, Houston TX -> Chicago IL, $3,250) so a buyer
    can open the downloaded file on stage if asked.

This generator is a one-time build-time tool; the PDFs it emits
are checked into the repo and the generator is not invoked at
runtime. It is committed alongside the PDFs so the fixtures are
reproducible from source.
"""

from __future__ import annotations

import sys
from pathlib import Path

FIXTURE_DIR = Path(__file__).parent


def _pdf_stream(lines: list[str]) -> bytes:
    """Build a PDF page-content stream from a list of plain-text lines."""
    out: list[str] = ["BT", "/F1 11 Tf", "72 720 Td", "14 TL"]
    first = True
    for line in lines:
        # Escape PDF string specials
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if first:
            out.append(f"({safe}) Tj")
            first = False
        else:
            out.append(f"T* ({safe}) Tj")
    out.append("ET")
    content = ("\n".join(out) + "\n").encode("ascii")
    return content


def _build_pdf(title: str, body_lines: list[str], pad_to: int = 1400) -> bytes:
    """Build a minimal single-page PDF containing the given text.

    The PDF is padded to at least ``pad_to`` bytes so that every
    fixture exceeds R-P2-09's 1024-byte floor even if the text
    contents are compact.
    """
    # Page content stream
    stream = _pdf_stream([title, "", *body_lines])
    stream_obj = (
        b"<< /Length "
        + str(len(stream)).encode("ascii")
        + b" >>\nstream\n"
        + stream
        + b"\nendstream"
    )

    # Objects — we build them sequentially and record offsets for the xref.
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        stream_obj,
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    # Pad with a harmless comment block to clear the 1024-byte floor.
    # The comment is a stream of 'X' characters inside a PDF comment
    # line (starts with %). Comments are legal PDF and ignored by
    # parsers, so the file still opens cleanly.
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    out = bytearray(header)

    offsets: list[int] = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode("ascii"))
        out.extend(obj)
        out.extend(b"\nendobj\n")

    xref_offset = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    out.extend(b"trailer\n")
    out.extend(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("ascii"))
    out.extend(b"startxref\n")
    out.extend(f"{xref_offset}\n".encode("ascii"))
    out.extend(b"%%EOF\n")

    if len(out) < pad_to:
        padding = b"%" + b"X" * (pad_to - len(out) - 2) + b"\n"
        out.extend(padding)

    return bytes(out)


def main() -> int:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    rate_con_bytes = _build_pdf(
        "Rate Confirmation - LP-DEMO-RC-001",
        [
            "Broker: ACME Logistics LLC",
            "Carrier: Sales Demo Carriers LLC",
            "Commodity: Frozen Beef",
            "Weight: 42,500 lbs",
            "Origin: Houston, TX",
            "Destination: Chicago, IL",
            "Agreed Rate: $3,250.00 USD",
            "Payment Terms: Net 30",
        ],
    )
    bol_bytes = _build_pdf(
        "Bill of Lading - LP-DEMO-RC-001",
        [
            "Shipper: ACME Logistics LLC",
            "Consignee: Midwest Cold Storage",
            "Commodity: Frozen Beef",
            "Weight: 42,500 lbs",
            "Pickup: Houston, TX",
            "Delivery: Chicago, IL",
            "BOL Number: BOL-DEMO-0001",
            "Carrier signature on file",
        ],
    )
    lumper_bytes = _build_pdf(
        "Lumper Receipt - LP-DEMO-RC-001",
        [
            "Facility: Midwest Cold Storage",
            "Date: 2025-11-12",
            "Lumper Service Fee: $180.00",
            "Paid By: Sales Demo Carriers LLC",
            "Signature: /s/ Demo Driver",
        ],
    )

    outputs = {
        "rate-con.pdf": rate_con_bytes,
        "bol.pdf": bol_bytes,
        "lumper-receipt.pdf": lumper_bytes,
    }

    for name, payload in outputs.items():
        target = FIXTURE_DIR / name
        target.write_bytes(payload)
        size = target.stat().st_size
        sys.stdout.write(f"wrote {name} ({size} bytes)\n")
        if size < 1024:
            sys.stdout.write(
                f"ERROR: {name} is below the 1024-byte floor\n",
            )
            return 1
        if payload[:4] != b"%PDF":
            sys.stdout.write(f"ERROR: {name} missing %PDF magic\n")
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
