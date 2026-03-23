// Heavy libraries (xlsx, jspdf) are dynamically imported on demand so they are
// NOT bundled into the route chunk of any component that imports this service.

export const exportToExcel = async (data: unknown[], filename: string): Promise<void> => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToPDF = async (
    headers: string[],
    data: unknown[][],
    title: string,
    filename: string,
): Promise<void> => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;

    doc.setFontSize(20);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    doc.autoTable({
        head: [headers],
        body: data,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
        styles: { fontSize: 8 }
    });

    doc.save(`${filename}.pdf`);
};
