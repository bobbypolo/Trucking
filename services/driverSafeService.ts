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

export const generateDriverLoadSheet = (load: LoadData): string => {
    // Mocking the auto-generation of a PDF/HTML Load Sheet
    console.log(`[DRIVER_SAFE_PACK] Generating Load Sheet for Load #${load.loadNumber}`);
    return `load-sheets/LD-${load.loadNumber}-safe.pdf`;
};
