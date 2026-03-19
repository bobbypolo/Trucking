import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock jsPDF with a proper class constructor
const mockAutoTable = vi.fn();
const mockSave = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();

vi.mock("jspdf", () => ({
  jsPDF: function (this: any) {
    this.setFontSize = mockSetFontSize;
    this.text = mockText;
    this.setTextColor = mockSetTextColor;
    this.autoTable = mockAutoTable;
    this.save = mockSave;
  },
}));

vi.mock("jspdf-autotable", () => ({}));

// Mock XLSX
const mockWriteFile = vi.fn();
const mockJsonToSheet = vi.fn().mockReturnValue({ "!ref": "A1" });
const mockBookNew = vi.fn().mockReturnValue({});
const mockBookAppendSheet = vi.fn();

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (...args: any[]) => mockJsonToSheet(...args),
    book_new: () => mockBookNew(),
    book_append_sheet: (...args: any[]) => mockBookAppendSheet(...args),
  },
  writeFile: (...args: any[]) => mockWriteFile(...args),
}));

import { exportToExcel, exportToPDF } from "../../../services/exportService";

describe("exportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- exportToExcel ---
  describe("exportToExcel", () => {
    it("converts data to worksheet and writes an xlsx file", async () => {
      const data = [
        { name: "Load 1", amount: 100 },
        { name: "Load 2", amount: 200 },
      ];
      await exportToExcel(data, "test-report");

      expect(mockJsonToSheet).toHaveBeenCalledWith(data);
      expect(mockBookNew).toHaveBeenCalled();
      expect(mockBookAppendSheet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "Report",
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.anything(),
        "test-report.xlsx",
      );
    });

    it("handles empty data array", async () => {
      await exportToExcel([], "empty-report");
      expect(mockJsonToSheet).toHaveBeenCalledWith([]);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.anything(),
        "empty-report.xlsx",
      );
    });
  });

  // --- exportToPDF ---
  describe("exportToPDF", () => {
    it("creates a PDF with title, date, and autoTable", async () => {
      const headers = ["Name", "Amount"];
      const data = [
        ["Load 1", "100"],
        ["Load 2", "200"],
      ];
      await exportToPDF(headers, data, "Loads Report", "loads-report");

      expect(mockSetFontSize).toHaveBeenCalledWith(20);
      expect(mockText).toHaveBeenCalledWith("Loads Report", 14, 22);
      expect(mockSetFontSize).toHaveBeenCalledWith(11);
      expect(mockSetTextColor).toHaveBeenCalledWith(100);
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining("Generated on"),
        14,
        30,
      );
    });

    it("calls autoTable with correct head, body, and styling", async () => {
      const headers = ["Col A", "Col B"];
      const data = [["val1", "val2"]];
      await exportToPDF(headers, data, "Title", "file");

      expect(mockAutoTable).toHaveBeenCalledWith(
        expect.objectContaining({
          head: [["Col A", "Col B"]],
          body: [["val1", "val2"]],
          startY: 35,
          theme: "grid",
          headStyles: { fillColor: [44, 62, 80] },
          styles: { fontSize: 8 },
        }),
      );
    });

    it("saves the PDF with the correct filename", async () => {
      await exportToPDF(["H"], [["D"]], "Title", "my-report");
      expect(mockSave).toHaveBeenCalledWith("my-report.pdf");
    });

    it("handles empty data array", async () => {
      await exportToPDF(["H1"], [], "Empty", "empty");
      expect(mockAutoTable).toHaveBeenCalledWith(
        expect.objectContaining({
          head: [["H1"]],
          body: [],
        }),
      );
      expect(mockSave).toHaveBeenCalledWith("empty.pdf");
    });
  });
});
