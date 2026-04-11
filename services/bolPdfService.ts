// BOL PDF generation — dynamically imports jsPDF to avoid bundling into route chunks.
// Layout modeled on server/scripts/generate-demo-documents.ts generateBillOfLading().

import { LoadData, BolData } from "../types";

/**
 * Find a leg by type from load.legs, falling back to load.pickup / load.dropoff.
 */
function getLegInfo(
  load: LoadData,
  legType: "Pickup" | "Dropoff",
): { facilityName: string; city: string; state: string; address?: string } {
  const leg = load.legs?.find((l) => l.type === legType);
  if (leg) {
    return {
      facilityName: leg.location.facilityName || "N/A",
      city: leg.location.city || "N/A",
      state: leg.location.state || "",
      address: leg.location.address,
    };
  }
  // Fallback to top-level pickup/dropoff
  const fallback = legType === "Pickup" ? load.pickup : load.dropoff;
  if (fallback) {
    return {
      facilityName: fallback.facilityName || "N/A",
      city: fallback.city || "N/A",
      state: fallback.state || "",
    };
  }
  return { facilityName: "N/A", city: "N/A", state: "" };
}

function formatLocation(info: {
  facilityName: string;
  city: string;
  state: string;
  address?: string;
}): string {
  const lines = [info.facilityName];
  if (info.address) lines.push(info.address);
  lines.push(`${info.city}, ${info.state}`);
  return lines.join("\n");
}

/**
 * Check whether a signature string is a usable base64 data URL.
 */
function isValidSignature(sig: string | undefined): sig is string {
  return typeof sig === "string" && sig.startsWith("data:");
}

export const generateBolPdf = async (
  load: LoadData,
  bolData: BolData,
): Promise<void> => {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF() as any;
  const w = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ── 1. Header ──────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("STRAIGHT BILL OF LADING \u2014 SHORT FORM", w / 2, 18, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Original \u2014 Not Negotiable", w / 2, 24, { align: "center" });
  doc.line(margin, 27, w - margin, 27);

  // ── 2. Reference Grid ─────────────────────────────────────────────
  const bolNumber = load.bolNumber || "N/A";
  const dateStr = bolData.generatedAt
    ? new Date(bolData.generatedAt).toLocaleDateString()
    : new Date().toLocaleDateString();
  const loadNumber = load.loadNumber || "N/A";
  const sealNumber = bolData.sealNumber || "N/A";

  doc.autoTable({
    startY: 30,
    head: [["BOL #", "Date", "Load #", "Seal #"]],
    body: [[bolNumber, dateStr, loadNumber, sealNumber]],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  // ── 3. Shipper / Consignee / Carrier ───────────────────────────────
  const shipper = getLegInfo(load, "Pickup");
  const consignee = getLegInfo(load, "Dropoff");

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [["SHIPPER (FROM)", "CONSIGNEE (TO)", "CARRIER"]],
    body: [
      [
        formatLocation(shipper),
        formatLocation(consignee),
        `Load: ${loadNumber}\nDriver: ${bolData.signatoryTitle || "N/A"}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  // ── 4. Commodity Table ─────────────────────────────────────────────
  const commodity = load.commodity || "General Freight";
  const weightStr = load.weight ? load.weight.toLocaleString() : "N/A";
  const palletStr = load.palletCount ? `${load.palletCount} PLT` : "";

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [
      [
        "QTY",
        "HM",
        "DESCRIPTION OF ARTICLES",
        "WEIGHT (LBS)",
        "CLASS",
        "NMFC #",
      ],
    ],
    body: [
      [palletStr, load.isHazMat ? "X" : "", commodity, weightStr, "", ""],
      ["", "", "", "", "", ""],
      ["", "", "TOTAL:", `${weightStr} lbs`, "", ""],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 12 },
      3: { halign: "right" as const, cellWidth: 28 },
      4: { halign: "center" as const, cellWidth: 16 },
      5: { cellWidth: 20 },
    },
    didParseCell: (data: any) => {
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── 5. Operations Section ──────────────────────────────────────────
  const opsY = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("OPERATIONAL DETAILS:", margin, opsY);
  doc.setFont("helvetica", "normal");

  const opsLines = [
    `Type: ${bolData.type}`,
    `Arrival Time: ${bolData.timeArrived || "N/A"}`,
    `Loading/Unloading Start: ${bolData.timeLoadingStart || "N/A"}`,
    `Loading/Unloading End: ${bolData.timeLoadingEnd || "N/A"}`,
  ];
  opsLines.forEach((line, i) => {
    doc.text(line, margin, opsY + 5 + i * 5);
  });

  // ── 6. Signatures ─────────────────────────────────────────────────
  const sigStartY = opsY + 5 + opsLines.length * 5 + 8;
  const sigWidth = 50;
  const sigHeight = 20;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("SIGNATURES:", margin, sigStartY);

  const sigRowY = sigStartY + 4;

  // Driver signature
  if (isValidSignature(bolData.driverSignature)) {
    doc.addImage(
      bolData.driverSignature,
      "PNG",
      margin,
      sigRowY,
      sigWidth,
      sigHeight,
    );
  }
  doc.line(
    margin,
    sigRowY + sigHeight + 2,
    margin + sigWidth,
    sigRowY + sigHeight + 2,
  );
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Driver Signature / Date", margin, sigRowY + sigHeight + 6);

  // Shipper signature
  const shipperSigX = margin + sigWidth + 10;
  if (isValidSignature(bolData.shipperSignature)) {
    doc.addImage(
      bolData.shipperSignature,
      "PNG",
      shipperSigX,
      sigRowY,
      sigWidth,
      sigHeight,
    );
  }
  doc.line(
    shipperSigX,
    sigRowY + sigHeight + 2,
    shipperSigX + sigWidth,
    sigRowY + sigHeight + 2,
  );
  doc.text("Shipper Signature / Date", shipperSigX, sigRowY + sigHeight + 6);

  // Receiver signature
  const receiverSigX = shipperSigX + sigWidth + 10;
  if (isValidSignature(bolData.receiverSignature)) {
    doc.addImage(
      bolData.receiverSignature,
      "PNG",
      receiverSigX,
      sigRowY,
      sigWidth,
      sigHeight,
    );
  }
  doc.line(
    receiverSigX,
    sigRowY + sigHeight + 2,
    receiverSigX + sigWidth,
    sigRowY + sigHeight + 2,
  );
  doc.text("Consignee Signature / Date", receiverSigX, sigRowY + sigHeight + 6);

  // ── 7. Legal Footer ───────────────────────────────────────────────
  const legalY = sigRowY + sigHeight + 14;
  doc.setFontSize(6);
  doc.text(
    "Subject to the classifications and lawfully filed tariffs in effect on the date of this Bill of Lading.",
    margin,
    legalY,
  );
  doc.text(
    "The shipper hereby certifies that the above-named materials are properly classified, described, packaged, marked, and labeled.",
    margin,
    legalY + 4,
  );

  doc.save(`BOL-${load.loadNumber || "DRAFT"}.pdf`);
};
