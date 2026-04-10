/**
 * Generate professional-looking trucking demo documents using jsPDF.
 *
 * Produces 3 PDFs in server/scripts/sales-demo-fixtures/:
 *   - rate-con.pdf      (Rate Confirmation with tables)
 *   - bol.pdf           (Bill of Lading with VICS-style layout)
 *   - lumper-receipt.pdf (Lumper Receipt with itemized charges)
 *
 * All documents use the Bulletproof Sales Demo continuity values
 * (ACME Logistics LLC, Frozen Beef, Houston TX → Chicago IL, $3,250).
 *
 * Usage:  npx ts-node --transpile-only server/scripts/generate-demo-documents.ts
 */

import * as path from "path";
import * as fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { jsPDF } = require("jspdf");
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("jspdf-autotable");

const FIXTURE_DIR = path.resolve(__dirname, "sales-demo-fixtures");

function generateRateConfirmation(): Buffer {
  const doc = new jsPDF() as any;
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RATE CONFIRMATION", w / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("ACME Logistics LLC", w / 2, 27, { align: "center" });
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(14, 30, w - 14, 30);

  // Reference Grid
  doc.autoTable({
    startY: 34,
    head: [["Load #", "Date", "MC #", "DOT #"]],
    body: [["LP-DEMO-RC-001", "11/08/2025", "MC-ACME-4421", "DOT-ACME-8891"]],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // Parties
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["BROKER", "CARRIER"]],
    body: [
      [
        "ACME Logistics LLC\n1200 Freight Blvd, Suite 400\nDallas, TX 75201\nMC: MC-ACME-4421\nPhone: (214) 555-0100\nEmail: dispatch@acmelogistics.invalid",
        "Sales Demo Carriers LLC\n500 Demo Way\nHouston, TX 77002\nMC: MC-DEMO-7700\nPhone: (713) 555-0100\nEmail: ops@salesdemo-loadpilot.invalid",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
    margin: { left: 14, right: 14 },
  });

  // Shipment Details
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["SHIPMENT DETAILS", "", "", ""]],
    body: [
      ["Commodity:", "Frozen Beef", "Equipment:", "Reefer 53'"],
      ["Weight:", "42,500 lbs", "Temperature:", "28°F"],
      ["Pieces:", "24 Pallets", "Seal Required:", "Yes"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [44, 62, 80],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { fontStyle: "bold", cellWidth: 35 },
      3: { cellWidth: 55 },
    },
    margin: { left: 14, right: 14 },
  });

  // Route
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["", "ORIGIN (PICKUP)", "DESTINATION (DELIVERY)"]],
    body: [
      ["Facility:", "Gulf Coast Meatpacking", "Midwest Cold Storage"],
      ["Address:", "4500 Port Industrial Blvd", "2200 S Halsted St"],
      ["City/State:", "Houston, TX 77029", "Chicago, IL 60608"],
      ["Date:", "11/10/2025", "11/12/2025"],
      ["Appointment:", "06:00 AM CST", "02:00 PM CST"],
      ["Contact:", "(713) 555-0200", "(312) 555-0300"],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 30 } },
    margin: { left: 14, right: 14 },
  });

  // Rate Breakdown
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["RATE BREAKDOWN", "AMOUNT"]],
    body: [
      ["Linehaul", "$3,050.00"],
      ["Fuel Surcharge (6.5%)", "$200.00"],
      ["", ""],
      ["TOTAL CARRIER RATE", "$3,250.00"],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    didParseCell: (data: any) => {
      if (data.row.index === 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Terms
  const termsY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT TERMS:", 14, termsY);
  doc.setFont("helvetica", "normal");
  doc.text("Net 30 days from receipt of signed POD and invoice.", 50, termsY);
  doc.text(
    "Standard carrier liability applies per 49 CFR 370. Carrier responsible for cargo in transit.",
    14,
    termsY + 5,
  );

  // Signature Lines
  const sigY = termsY + 18;
  doc.line(14, sigY, 90, sigY);
  doc.line(110, sigY, w - 14, sigY);
  doc.setFontSize(8);
  doc.text("Broker Signature / Date", 14, sigY + 4);
  doc.text("Carrier Signature / Date", 110, sigY + 4);

  return Buffer.from(doc.output("arraybuffer"));
}

function generateBillOfLading(): Buffer {
  const doc = new jsPDF() as any;
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("STRAIGHT BILL OF LADING — SHORT FORM", w / 2, 18, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Original — Not Negotiable", w / 2, 24, { align: "center" });
  doc.line(14, 27, w - 14, 27);

  // BOL Reference
  doc.autoTable({
    startY: 30,
    head: [["BOL #", "Date", "Load #", "Seal #"]],
    body: [["BOL-DEMO-0001", "11/10/2025", "LP-DEMO-RC-001", "SEAL-88421"]],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  // Shipper / Consignee / Carrier blocks
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [["SHIPPER (FROM)", "CONSIGNEE (TO)", "CARRIER"]],
    body: [
      [
        "Gulf Coast Meatpacking\n4500 Port Industrial Blvd\nHouston, TX 77029\nPhone: (713) 555-0200",
        "Midwest Cold Storage\n2200 S Halsted St\nChicago, IL 60608\nPhone: (312) 555-0300",
        "Sales Demo Carriers LLC\n500 Demo Way\nHouston, TX 77002\nDriver: Demo Driver",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  });

  // Commodity Table
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
      [
        "24 PLT",
        "",
        "FROZEN BEEF — USDA Prime\nKeep Frozen at 28°F\nDo Not Double Stack",
        "42,500",
        "65",
        "17040",
      ],
      ["", "", "", "", "", ""],
      ["", "", "TOTAL:", "42,500 lbs", "", ""],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 12 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "center", cellWidth: 16 },
      5: { cellWidth: 20 },
    },
    didParseCell: (data: any) => {
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Special Instructions
  const instY = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("SPECIAL INSTRUCTIONS:", 14, instY);
  doc.setFont("helvetica", "normal");
  doc.text(
    "1. Maintain reefer temperature at 28°F continuously during transit.",
    14,
    instY + 5,
  );
  doc.text(
    "2. Do not break seal — consignee must verify seal number SEAL-88421 at delivery.",
    14,
    instY + 10,
  );
  doc.text(
    "3. Driver must obtain signed POD with piece count and temperature reading.",
    14,
    instY + 15,
  );

  // Signature Lines
  const sigY = instY + 28;
  doc.line(14, sigY, 65, sigY);
  doc.line(75, sigY, 130, sigY);
  doc.line(140, sigY, w - 14, sigY);
  doc.setFontSize(7);
  doc.text("Shipper Signature / Date", 14, sigY + 4);
  doc.text("Driver Signature / Date", 75, sigY + 4);
  doc.text("Consignee Signature / Date", 140, sigY + 4);

  // Legal
  doc.setFontSize(6);
  doc.text(
    "Subject to the classifications and lawfully filed tariffs in effect on the date of this Bill of Lading.",
    14,
    sigY + 12,
  );

  return Buffer.from(doc.output("arraybuffer"));
}

function generateLumperReceipt(): Buffer {
  const doc = new jsPDF() as any;
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("LUMPER RECEIPT", w / 2, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Midwest Cold Storage — Unloading Services", w / 2, 27, {
    align: "center",
  });
  doc.line(14, 30, w - 14, 30);

  // Receipt Info
  doc.autoTable({
    startY: 34,
    head: [["Receipt #", "Date", "Load #", "BOL #"]],
    body: [["LR-2025-1194", "11/12/2025", "LP-DEMO-RC-001", "BOL-DEMO-0001"]],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // Facility Details
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["FACILITY DETAILS", ""]],
    body: [
      ["Facility:", "Midwest Cold Storage"],
      ["Address:", "2200 S Halsted St, Chicago, IL 60608"],
      ["Dock Door:", "Bay 14"],
      ["Arrival Time:", "02:15 PM CST"],
      ["Departure Time:", "04:45 PM CST"],
      ["Total Dwell Time:", "2 hours 30 minutes"],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    margin: { left: 14, right: 14 },
  });

  // Service Charges
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["SERVICE", "QTY", "RATE", "AMOUNT"]],
    body: [
      ["Unloading — Palletized Freight", "24 PLT", "$4.50/plt", "$108.00"],
      ["Sorting & Staging", "1", "$42.00", "$42.00"],
      ["Temperature Verification", "1", "$15.00", "$15.00"],
      ["Pallet Jack Rental", "1", "$15.00", "$15.00"],
      ["", "", "", ""],
      ["", "", "TOTAL", "$180.00"],
    ],
    theme: "grid",
    headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "center", cellWidth: 22 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 28 },
    },
    didParseCell: (data: any) => {
      if (data.row.index === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Payment Info
  const payY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT METHOD:", 14, payY);
  doc.setFont("helvetica", "normal");
  doc.text("Comdata Card ending in 4421", 55, payY);
  doc.text("Paid by: Sales Demo Carriers LLC", 14, payY + 6);

  // Authorization
  const authY = payY + 18;
  doc.line(14, authY, 90, authY);
  doc.line(110, authY, w - 14, authY);
  doc.setFontSize(8);
  doc.text("Driver Signature", 14, authY + 4);
  doc.text("Facility Representative", 110, authY + 4);

  return Buffer.from(doc.output("arraybuffer"));
}

function main(): void {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  const docs: Array<{ name: string; gen: () => Buffer }> = [
    { name: "rate-con.pdf", gen: generateRateConfirmation },
    { name: "bol.pdf", gen: generateBillOfLading },
    { name: "lumper-receipt.pdf", gen: generateLumperReceipt },
  ];

  for (const { name, gen } of docs) {
    const buf = gen();
    const target = path.join(FIXTURE_DIR, name);
    fs.writeFileSync(target, buf);
    const size = fs.statSync(target).size;
    // eslint-disable-next-line no-console
    console.log(`wrote ${name} (${size} bytes)`);
    if (size < 1024) {
      // eslint-disable-next-line no-console
      console.error(`ERROR: ${name} is below the 1024-byte floor`);
      process.exit(1);
    }
  }

  // eslint-disable-next-line no-console
  console.log("All demo documents generated successfully.");
}

main();
