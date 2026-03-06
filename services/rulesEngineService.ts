import { FuelEntry, VaultDoc, AutomationRule } from '../types';
import { getBills, uploadToVault, getVaultDocs } from './financialService';

export const executeFuelMatchingRule = async (
    purchases: FuelEntry[],
    docs: VaultDoc[],
    rule: AutomationRule
): Promise<{ matched: number, orphaned: number }> => {
    let matchedCount = 0;
    const tolerance = rule.configuration.matchTolerance || 0.05;

    for (const purchase of purchases) {
        // Find a doc that matches criteria
        const matchingDoc = docs.find(doc => {
            if (doc.type !== 'Fuel') return false;

            // Basic matching logic: Same truck, and amount within tolerance if metadata exists
            // In a real OCR app, we'd have extracted 'amount' from the doc.
            // For this simulation, we check if they were uploaded within the lookback window.
            const purchaseDate = new Date(purchase.transactionDate);
            const docDate = new Date(doc.createdAt);
            const daysDiff = Math.abs(purchaseDate.getTime() - docDate.getTime()) / (1000 * 3600 * 24);

            return doc.truckId === purchase.truckId &&
                daysDiff <= (rule.configuration.lookbackDays || 7);
        });

        if (matchingDoc) {
            // "Auto-Link" by updating the doc with the purchase details or vice versa
            // In our system, we'd link the FuelEntry id to the VaultDoc
            matchedCount++;
            console.log(`[Rules Engine] Matched Purchase ${purchase.id} to Doc ${matchingDoc.id}`);
        }
    }

    return {
        matched: matchedCount,
        orphaned: purchases.length - matchedCount
    };
};

export const runRuleAutomation = async (rule: AutomationRule, context: any) => {
    if (!rule.enabled) return;

    switch (rule.trigger) {
        case 'load_status_change':
            if (rule.action === 'update_ifta' && context.status === 'Delivered') {
                console.log(`[Rules Engine] Triggering IFTA Analysis for Load ${context.id}`);
                // Call IFTA Intelligence API
            }
            break;
        case 'doc_upload':
            if (rule.action === 'match_receipt') {
                console.log(`[Rules Engine] New document detected. Running matching logic.`);
            }
            break;
    }
};
