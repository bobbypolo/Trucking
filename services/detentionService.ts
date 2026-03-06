import { LoadData, OperationalEvent, KCIRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * DetentionService handles the automated detection and billing of driver detention at facilities.
 */
export const DetentionService = {
    /**
     * Monitors facility dwell time and trigger auto-billing if free time is exceeded.
     */
    processGeofenceEvent: async (load: LoadData, event: 'ENTRY' | 'EXIT', timestamp: string): Promise<any> => {
        console.log(`[DetentionService] Geofence ${event} for Load #${load.loadNumber} at ${timestamp}`);

        // Mocked check for existing entry event
        if (event === 'EXIT') {
            const entryTime = new Date(Date.now() - 3.5 * 3600000); // Mocking 3.5 hours dwell time
            const exitTime = new Date(timestamp);
            const dwellHours = (exitTime.getTime() - entryTime.getTime()) / 3600000;
            const freeTime = 2.0;

            if (dwellHours > freeTime) {
                const billableHours = Math.ceil(dwellHours - freeTime);
                const rate = 50.00;
                const totalAmount = billableHours * rate;

                console.log(`[DetentionService] DETENTION DETECTED: ${billableHours} hours billable ($${totalAmount})`);

                const detentionRequest: any = {
                    id: `DET-${uuidv4().slice(0, 6).toUpperCase()}`,
                    loadId: load.id,
                    type: 'DETENTION',
                    requestedAmount: totalAmount,
                    status: 'PENDING_APPROVAL',
                    notes: `Automated detection: ${dwellHours.toFixed(1)}h dwell time. ${freeTime}h free time exceeded.`,
                    createdAt: new Date().toISOString(),
                    createdBy: 'Detention-Bot'
                };

                return {
                    isBillable: true,
                    request: detentionRequest,
                    dwellTime: dwellHours
                };
            }
        }

        return { isBillable: false };
    }
};
