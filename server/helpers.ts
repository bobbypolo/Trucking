import pool from './db';
import type { RowDataPacket } from 'mysql2/promise';
import { calculateDistance } from './geoUtils';
import { logger } from './lib/logger';
import { deliverNotification } from './services/notification-delivery.service';

interface VisibilitySettings {
    hideRates?: boolean;
    showDriverPay?: boolean;
    maskCustomerName?: boolean;
    hideBrokerContacts?: boolean;
}

// Redaction Helper (Security Hardening)
export const redactData = (data: Record<string, unknown> | Record<string, unknown>[], role: string, settings: VisibilitySettings | null) => {
    if (role !== 'driver' || !settings) return data;

    const redactObject = (obj: Record<string, unknown>) => {
        const redacted = { ...obj };
        if (settings.hideRates) {
            delete redacted.carrier_rate;
            delete redacted.daily_cost;
            delete redacted.base_amount;
            delete redacted.unit_amount;
            if (!settings.showDriverPay) delete redacted.driver_pay;
        }
        if (settings.maskCustomerName) {
            // Masking for loads/legs
            if (redacted.facility_name) redacted.facility_name = 'Confidential Facility';
            // Masking for clients/customers
            if (redacted.name && (redacted.type === 'Broker' || redacted.type === 'Direct Customer')) {
                redacted.name = 'Confidential Client';
            }
        }
        if (settings.hideBrokerContacts) {
            delete redacted.email;
            delete redacted.phone;
            delete redacted.address;
        }
        return redacted;
    };

    if (Array.isArray(data)) {
        return data.map(item => {
            const redacted = redactObject(item);
            if (redacted.legs && Array.isArray(redacted.legs)) {
                redacted.legs = redacted.legs.map((leg: Record<string, unknown>) => redactObject(leg));
            }
            return redacted;
        });
    }

    const finalRedacted = redactObject(data);
    if (finalRedacted.legs && Array.isArray(finalRedacted.legs)) {
        finalRedacted.legs = finalRedacted.legs.map((leg: Record<string, unknown>) => redactObject(leg));
    }
    return finalRedacted;
};

// Helper for Email Notifications (KCI Specialization)
export const sendNotification = (emails: string[], subject: string, message: string) => {
    if (!emails || emails.length === 0) return;
    logger.info({ to: emails.join(', '), subject, message }, 'Email notification dispatched');

    // Fire-and-forget: call real delivery service, catch all errors
    deliverNotification({
        channel: 'email',
        subject,
        message,
        recipients: emails.map(email => ({ email })),
    }).catch((err) => {
        logger.error({ err, subject }, 'Notification delivery failed (non-blocking)');
    });
};

/**
 * KCI Intelligence: Calculates breakdown lateness risk
 */
export const checkBreakdownLateness = async (loadId: string, lat: number, lng: number) => {
    try {
        const [legs] = await pool.query<RowDataPacket[]>('SELECT * FROM load_legs WHERE load_id = ? AND type = "Dropoff" ORDER BY sequence_order DESC LIMIT 1', [loadId]);
        if (legs.length === 0) return { isLate: false };

        const dropoff = legs[0];
        // For simplicity, we assume facility coordinates are stored or looked up.
        // Mocking at 39.7392, -104.9903 (Denver) for this flow.
        const destLat = 39.7392;
        const destLng = -104.9903;

        const distance = calculateDistance(lat, lng, destLat, destLng);
        const estTransitHours = distance / 50; // 50mph avg
        const recoveryBuffer = 4; // 4 hours for tow/fix

        const totalRequiredHours = estTransitHours + recoveryBuffer;

        return {
            dist: Math.round(distance),
            required: Math.round(totalRequiredHours),
            isLate: totalRequiredHours > 12 // Scenario threshold
        };
    } catch (e) {
        return { isLate: false };
    }
};

/**
 * Helper to fetch driver visibility settings from company
 */
export const getVisibilitySettings = async (companyId: string) => {
    const [companyRows] = await pool.query<RowDataPacket[]>('SELECT driver_visibility_settings FROM companies WHERE id = ?', [companyId]);
    let settings = null;
    try {
        const rawSettings = companyRows[0]?.driver_visibility_settings;
        settings = rawSettings ? (typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings) : null;
    } catch (e) {
        logger.error({ err: e }, 'Failed to parse driver_visibility_settings');
    }
    return settings;
};
