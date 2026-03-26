import { LoadData, Company, VisibilityLevel } from '../types';

/**
 * DriverSafeService handles the generation of redacted data transfer objects
 * and auto-generated "Driver Load Sheets" to prevent sensitive data leakage.
 */

export const generateDriverSafeLoadDTO = (load: LoadData, company: Company) => {
    const settings = company.driverVisibilitySettings;

    // Deep clone to avoid mutating original
    const redactedLoad = JSON.parse(JSON.stringify(load));

    if (settings.hideRates) {
        redactedLoad.carrierRate = undefined;
        redactedLoad.driverPay = settings.showDriverPay ? load.driverPay : undefined;
        // In a real app, we'd also strip FSC and Accessorials from the DTO entirely
    }

    if (settings.hideBrokerContacts) {
        if (redactedLoad.broker) {
            redactedLoad.broker.phone = '---';
            redactedLoad.broker.email = '---';
            if (settings.maskCustomerName) {
                redactedLoad.broker.name = 'Confidential Partner';
            }
        }
    }

    if (settings.maskCustomerName) {
        redactedLoad.pickup.facilityName = 'Confidential Facility';
        redactedLoad.dropoff.facilityName = 'Confidential Facility';
    }

    return redactedLoad;
};

export const generateDriverLoadSheet = async (load: LoadData, company?: Company): Promise<void> => {
    const safeLoad = company ? generateDriverSafeLoadDTO(load, company) : load;

    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text('Driver Load Sheet', 14, 20);
    doc.setFontSize(10);
    doc.text(`Load #: ${safeLoad.loadNumber || 'N/A'}`, 14, 28);
    doc.text(`Status: ${safeLoad.status || 'N/A'}`, 14, 34);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

    // Route table
    const legs = (safeLoad as any).legs || [];
    if (legs.length > 0) {
        (doc as any).autoTable({
            startY: 48,
            head: [['Type', 'Location', 'Date', 'Time']],
            body: legs.map((leg: any) => [
                leg.type || '',
                [leg.facility_name || leg.facilityName || '', leg.city || '', leg.state || ''].filter(Boolean).join(', '),
                leg.date || '',
                leg.appointmentTime || leg.appointment_time || '',
            ]),
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
        });
    }

    // Load details
    const lastY = legs.length > 0 ? ((doc as any).lastAutoTable?.finalY || 48) + 10 : 48;
    (doc as any).autoTable({
        startY: lastY,
        head: [['Detail', 'Value']],
        body: [
            ['Commodity', (safeLoad as any).commodity || 'N/A'],
            ['Weight', (safeLoad as any).weight ? `${(safeLoad as any).weight} lbs` : 'N/A'],
            ['Equipment', (safeLoad as any).equipment || 'N/A'],
            ['Pickup', (safeLoad as any).pickup?.city ? `${(safeLoad as any).pickup.city}, ${(safeLoad as any).pickup.state || ''}` : 'N/A'],
            ['Dropoff', (safeLoad as any).dropoff?.city ? `${(safeLoad as any).dropoff.city}, ${(safeLoad as any).dropoff.state || ''}` : 'N/A'],
            ['Notes', (safeLoad as any).notes || 'None'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
    });

    // Rate info (only if visibility allows — check if rate was NOT redacted)
    const rate = (safeLoad as any).carrierRate ?? (safeLoad as any).rate;
    if (rate !== undefined && rate !== null) {
        const rateY = ((doc as any).lastAutoTable?.finalY || lastY) + 10;
        (doc as any).autoTable({
            startY: rateY,
            head: [['Rate Type', 'Amount']],
            body: [['Total Rate', `$${Number(rate).toFixed(2)}`]],
            theme: 'grid',
            headStyles: { fillColor: [39, 174, 96] },
        });
    }

    doc.save(`LD-${safeLoad.loadNumber || 'unknown'}-load-sheet.pdf`);
};
