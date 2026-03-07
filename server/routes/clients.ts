import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken } from '../auth';
import pool from '../db';
import db from '../firestore';
import { redactData, getVisibilitySettings } from '../helpers';

const router = Router();
const authenticateToken = verifyFirebaseToken;

// Clients / Brokers Routes
router.get('/api/clients/:companyId', authenticateToken, async (req: any, res) => {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        const [rows]: any = await pool.query('SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC', [req.params.companyId]);
        const settings = await getVisibilitySettings(req.params.companyId);
        res.json(redactData(rows, req.user.role, settings));
    } catch (error) {
        console.error('SERVER ERROR [GET /api/clients]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/api/clients', authenticateToken, async (req: any, res) => {
    const { id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, chassis_requirements } = req.body;
    if (req.user.companyId !== company_id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized company access' });
    }
    try {
        await pool.query(
            'REPLACE INTO customers (id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, chassis_requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, JSON.stringify(chassis_requirements)]
        );
        res.status(201).json({ message: 'Client saved' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/clients]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Companies
router.get('/api/companies/:id', async (req, res) => {
    try {
        const doc = await db.collection('companies').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Company not found' });
        res.json(doc.data());
    } catch (error) {
        console.error('SERVER ERROR [GET /api/companies]:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    }
});

router.post('/api/companies', async (req, res) => {
    const { id, name, account_type, email, address, city, state, zip, tax_id, phone, mc_number, dot_number, load_numbering_config, accessorial_rates } = req.body;
    try {
        await db.collection('companies').doc(id).set({
            id, name, account_type, email, address, city, state, zip, tax_id, phone, mc_number, dot_number,
            load_numbering_config: typeof load_numbering_config === 'string' ? JSON.parse(load_numbering_config) : load_numbering_config,
            accessorial_rates: typeof accessorial_rates === 'string' ? JSON.parse(accessorial_rates) : accessorial_rates,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.status(201).json({ message: 'Company created' });
    } catch (error) {
        console.error('SERVER ERROR [POST /api/companies]:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Party Onboarding / Network Routes
router.get('/api/parties', async (req, res) => {
    try {
        const [parties]: any = await pool.query('SELECT * FROM parties WHERE company_id = ?', [req.query.companyId]);
        const enrichedParties = await Promise.all(parties.map(async (p: any) => {
            const [contacts] = await pool.query('SELECT * FROM party_contacts WHERE party_id = ?', [p.id]);
            const [docs] = await pool.query('SELECT * FROM party_documents WHERE party_id = ?', [p.id]);

            // Unified Engine Fetching
            const [rates]: any = await pool.query(`
                SELECT r.*, t.id as tier_id, t.tier_start, t.tier_end, t.unit_amount as tier_unit_amount, t.base_amount as tier_base_amount
                FROM rate_rows r
                LEFT JOIN rate_tiers t ON r.id = t.rate_row_id
                WHERE r.party_id = ?
            `, [p.id]);

            const groupedRates = rates.reduce((acc: any, row: any) => {
                let r = acc.find((item: any) => item.id === row.id);
                if (!r) {
                    r = {
                        id: row.id,
                        catalogItemId: row.catalog_item_id,
                        variantId: row.variant_id,
                        direction: row.direction,
                        currency: row.currency,
                        priceType: row.price_type,
                        unitType: row.unit_type,
                        baseAmount: row.base_amount,
                        unitAmount: row.unit_amount,
                        minCharge: row.min_charge,
                        maxCharge: row.max_charge,
                        freeUnits: row.free_units,
                        effectiveStart: row.effective_start,
                        effectiveEnd: row.effective_end,
                        taxableFlag: !!row.taxable_flag,
                        roundingRule: row.rounding_rule,
                        notes: row.notes_internal,
                        approvalRequired: !!row.approval_required,
                        tiers: []
                    };
                    acc.push(r);
                }
                if (row.tier_id) {
                    r.tiers.push({
                        id: row.tier_id,
                        rateRowId: row.id,
                        tierStart: row.tier_start,
                        tierEnd: row.tier_end,
                        unitAmount: row.tier_unit_amount,
                        baseAmount: row.tier_base_amount
                    });
                }
                return acc;
            }, []);

            const [constraintSets]: any = await pool.query('SELECT * FROM constraint_sets WHERE party_id = ?', [p.id]);
            const enrichedConstraints = await Promise.all(constraintSets.map(async (cs: any) => {
                const [rules]: any = await pool.query('SELECT * FROM constraint_rules WHERE constraint_set_id = ?', [cs.id]);
                return {
                    id: cs.id,
                    appliesTo: cs.applies_to,
                    priority: cs.priority,
                    status: cs.status,
                    effectiveStart: cs.effective_start,
                    rules: rules.map((r: any) => ({
                        id: r.id,
                        type: r.rule_type,
                        field: r.field_key,
                        operator: r.operator,
                        value: r.value_text,
                        enforcement: r.enforcement,
                        message: r.message
                    }))
                };
            }));

            const [catalogLinks]: any = await pool.query('SELECT catalog_item_id FROM party_catalog_links WHERE party_id = ?', [p.id]);

            return {
                ...p,
                isCustomer: !!p.is_customer,
                isVendor: !!p.is_vendor,
                mcNumber: p.mc_number,
                dotNumber: p.dot_number,
                contacts,
                documents: docs,
                rates: groupedRates,
                constraintSets: enrichedConstraints,
                catalogLinks: catalogLinks.map((cl: any) => cl.catalog_item_id)
            };
        }));
        res.json(enrichedParties);
    } catch (error) {
        console.error('SERVER ERROR [GET /api/parties]:', error);
    }
});

router.post('/api/parties', async (req, res) => {
    const { id, company_id, companyId, tenantId, name, type, status, mcNumber, dotNumber, rating, isCustomer, isVendor, contacts, rates, constraintSets, catalogLinks } = req.body;
    const finalCompanyId = companyId || company_id;
    const finalTenantId = tenantId || 'DEFAULT';
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(
            'REPLACE INTO parties (id, company_id, name, type, is_customer, is_vendor, status, mc_number, dot_number, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, finalCompanyId, name, type, isCustomer, isVendor, status, mcNumber, dotNumber, rating]
        );

        // Contacts
        await connection.query('DELETE FROM party_contacts WHERE party_id = ?', [id]);
        if (contacts) {
            for (const c of contacts) {
                await connection.query(
                    'INSERT INTO party_contacts (id, party_id, name, role, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [c.id || uuidv4(), id, c.name, c.role, c.email, c.phone, c.isPrimary]
                );
            }
        }

        // Unified Rates
        await connection.query('DELETE FROM rate_rows WHERE party_id = ?', [id]);
        if (rates) {
            for (const r of rates) {
                const rid = r.id || uuidv4();
                await connection.query(
                    'INSERT INTO rate_rows (id, tenant_id, party_id, catalog_item_id, variant_id, direction, currency, price_type, unit_type, base_amount, unit_amount, min_charge, max_charge, free_units, effective_start, effective_end, taxable_flag, rounding_rule, notes_internal, approval_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [rid, finalTenantId, id, r.catalogItemId, r.variantId, r.direction, r.currency || 'USD', r.priceType, r.unitType, r.baseAmount, r.unitAmount, r.minCharge, r.maxCharge, r.freeUnits, r.effectiveStart, r.effectiveEnd, r.taxableFlag, r.roundingRule, r.notes, r.approvalRequired]
                );
                if (r.tiers) {
                    for (const t of r.tiers) {
                        await connection.query(
                            'INSERT INTO rate_tiers (id, rate_row_id, tier_start, tier_end, unit_amount, base_amount) VALUES (?, ?, ?, ?, ?, ?)',
                            [uuidv4(), rid, t.tierStart, t.tierEnd, t.unitAmount, t.baseAmount]
                        );
                    }
                }
            }
        }

        // Operational Constraints
        await connection.query('DELETE FROM constraint_sets WHERE party_id = ?', [id]);
        if (constraintSets) {
            for (const cs of constraintSets) {
                const csid = cs.id || uuidv4();
                await connection.query(
                    'INSERT INTO constraint_sets (id, tenant_id, party_id, applies_to, priority, status, effective_start, effective_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [csid, finalTenantId, id, cs.appliesTo, cs.priority, cs.status, cs.effectiveStart, cs.effectiveEnd]
                );
                if (cs.rules) {
                    for (const rule of cs.rules) {
                        await connection.query(
                            'INSERT INTO constraint_rules (id, constraint_set_id, rule_type, field_key, operator, value_text, enforcement, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [uuidv4(), csid, rule.type, rule.field, rule.operator, rule.value, rule.enforcement, rule.message]
                        );
                    }
                }
            }
        }

        // Catalog Links
        await connection.query('DELETE FROM party_catalog_links WHERE party_id = ?', [id]);
        if (catalogLinks) {
            for (const itemId of catalogLinks) {
                await connection.query(
                    'INSERT INTO party_catalog_links (id, party_id, catalog_item_id) VALUES (?, ?, ?)',
                    [uuidv4(), id, itemId]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Party synced with Unified Engine' });
    } catch (error) {
        await connection.rollback();
        console.error('SERVER ERROR [POST /api/parties]:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    } finally {
        connection.release();
    }
});

// GLOBAL SEARCH ENGINE (360 Degree Intelligence)
router.get('/api/global-search', authenticateToken, async (req: any, res) => {
    const { query } = req.query;
    const companyId = req.user.companyId;

    if (!query || query.length < 2) return res.json([]);
    const q = `%${query}%`;
    const results: any[] = [];

    try {
        // 1. Search Loads (MySQL)
        const [loadRows]: any = await pool.query(
            'SELECT id, load_number, status, pickup_date FROM loads WHERE company_id = ? AND (load_number LIKE ? OR container_number LIKE ? OR bol_number LIKE ?)',
            [companyId, q, q, q]
        );
        loadRows.forEach((l: any) => {
            results.push({
                id: l.id,
                type: 'LOAD',
                label: `Load #${l.load_number}`,
                subLabel: `Status: ${l.status} | Date: ${l.pickup_date || 'N/A'}`,
                status: l.status,
                chips: [{ label: l.status, color: 'blue' }]
            });
        });

        // 2. Search Customers (MySQL)
        const [customerRows]: any = await pool.query(
            'SELECT id, name, type, mc_number FROM customers WHERE company_id = ? AND (name LIKE ? OR mc_number LIKE ? OR email LIKE ?)',
            [companyId, q, q, q]
        );
        customerRows.forEach((c: any) => {
            results.push({
                id: c.id,
                type: 'BROKER',
                label: c.name,
                subLabel: `${c.type} | MC: ${c.mc_number || 'N/A'}`,
                chips: [{ label: c.type, color: 'purple' }]
            });
        });

        // 3. Search Users (Firestore)
        const userSnapshot = await db.collection('users')
            .where('company_id', '==', companyId)
            .get();

        userSnapshot.docs.forEach(doc => {
            const u = doc.data();
            if (u.name?.toLowerCase().includes(query.toLowerCase()) || u.email?.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    id: u.id,
                    type: u.role === 'driver' ? 'DRIVER' : 'USER',
                    label: u.name,
                    subLabel: `${u.role.toUpperCase()} | ${u.email}`,
                    chips: [{ label: u.role, color: 'green' }]
                });
            }
        });

        // 4. Search Quotes (MySQL)
        const [quoteRows]: any = await pool.query(
            'SELECT id, pickup_city, dropoff_city, status FROM quotes WHERE company_id = ? AND (id LIKE ? OR pickup_city LIKE ? OR dropoff_city LIKE ?)',
            [companyId, q, q, q]
        );
        quoteRows.forEach((q: any) => {
            results.push({
                id: q.id,
                type: 'QUOTE',
                label: `Quote #${q.id.slice(0, 8)}`,
                subLabel: `${q.pickup_city} -> ${q.dropoff_city}`,
                status: q.status,
                chips: [{ label: 'Quote', color: 'orange' }]
            });
        });

        res.json(results.slice(0, 20));
    } catch (error) {
        console.error('SEARCH ERROR:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
