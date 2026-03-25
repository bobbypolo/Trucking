import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import { createPartySchema } from "../schemas/parties";
import { createClientSchema } from "../schemas/client";
import pool from "../db";
import db from "../firestore";
import { redactData, getVisibilitySettings } from "../helpers";
import { createChildLogger } from "../lib/logger";
import { ForbiddenError } from "../errors/AppError";
import {
  ensureMySqlCompany,
  findSqlCompanyById,
  mapCompanyRowToApiCompany,
} from "../lib/sql-auth";

const router = Router();

const isMissingTableError = (error: unknown, tableName?: string) => {
  const err = error as { code?: string; message?: string };
  if (!err) return false;
  const codeMatches =
    err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR";
  if (!codeMatches) return false;
  if (!tableName) return true;
  return (err.message || "").includes(tableName);
};

// Clients / Brokers Routes
router.get(
  "/api/clients/:companyId",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const includeArchived = req.query.include_archived === "true";
      const sql = includeArchived
        ? "SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC"
        : "SELECT * FROM customers WHERE company_id = ? AND archived_at IS NULL ORDER BY name ASC";
      const [rows]: any = await pool.query(sql, [req.params.companyId]);
      const settings = await getVisibilitySettings(req.params.companyId);
      res.json(redactData(rows, req.user.role, settings));
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/clients",
      });
      if (isMissingTableError(error, "customers") || isMissingTableError(error, "archived_at")) {
        try {
          const [rows]: any = await pool.query(
            "SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC",
            [req.params.companyId],
          );
          const settings = await getVisibilitySettings(req.params.companyId);
          return res.json(redactData(rows, req.user.role, settings));
        } catch (fallbackError) {
          log.error(
            { err: fallbackError },
            "Fallback GET /api/clients without archived_at failed",
          );
        }
      }
      log.error({ err: error }, "SERVER ERROR [GET /api/clients]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

const ARCHIVE_ALLOWED_ROLES = ["admin", "dispatcher"];

// PATCH /api/clients/:id/archive — soft-delete a customer
router.patch(
  "/api/clients/:id/archive",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "PATCH /api/clients/:id/archive",
    });

    if (!ARCHIVE_ALLOWED_ROLES.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }

    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
      const [result]: any = await pool.query(
        "UPDATE customers SET archived_at = NOW(), archived_by = ? WHERE id = ? AND company_id = ?",
        [req.user.uid, id, tenantId],
      );

      if (result.affectedRows === 0) {
        res.status(404).json({ error: "Client not found" });
        return;
      }

      log.info({ clientId: id, archivedBy: req.user.uid }, "Client archived");
      res.json({ message: "Client archived" });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [PATCH /api/clients/:id/archive]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/clients/:id/unarchive — restore an archived customer
router.patch(
  "/api/clients/:id/unarchive",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "PATCH /api/clients/:id/unarchive",
    });

    if (!ARCHIVE_ALLOWED_ROLES.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }

    const { id } = req.params;
    const tenantId = req.user.tenantId;

    try {
      const [result]: any = await pool.query(
        "UPDATE customers SET archived_at = NULL, archived_by = NULL WHERE id = ? AND company_id = ?",
        [id, tenantId],
      );

      if (result.affectedRows === 0) {
        res.status(404).json({ error: "Client not found" });
        return;
      }

      log.info({ clientId: id }, "Client unarchived");
      res.json({ message: "Client unarchived" });
    } catch (error) {
      log.error(
        { err: error },
        "SERVER ERROR [PATCH /api/clients/:id/unarchive]",
      );
      res.status(500).json({ error: "Database error" });
    }
  },
);

router.post(
  "/api/clients",
  requireAuth,
  requireTenant,
  validateBody(createClientSchema),
  async (req: any, res) => {
    const tenantId = req.user!.tenantId;
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/clients",
    });

    // Security: reject body with foreign company_id
    if (req.body.company_id && req.body.company_id !== tenantId) {
      log.warn(
        {
          bodyCompanyId: req.body.company_id,
          authTenantId: tenantId,
        },
        "Cross-tenant client creation attempt blocked",
      );
      res.status(403).json({ error: "company_id mismatch" });
      return;
    }

    const {
      id,
      name,
      type,
      mc_number,
      dot_number,
      email,
      phone,
      address,
      payment_terms,
      chassis_requirements,
    } = req.body;

    // Server derives company_id exclusively from auth context
    const companyId = tenantId;

    try {
      await pool.query(
        "REPLACE INTO customers (id, name, type, mc_number, dot_number, email, phone, address, payment_terms, company_id, chassis_requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id || uuidv4(),
          name,
          type,
          mc_number,
          dot_number,
          email,
          phone,
          address,
          payment_terms,
          companyId,
          JSON.stringify(chassis_requirements),
        ],
      );
      res.status(201).json({ message: "Client saved" });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [POST /api/clients]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// Companies
router.get(
  "/api/companies/:id",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "GET /api/companies",
    });
    try {
      // Try Firestore first (primary source for company settings)
      try {
        const doc = await db.collection("companies").doc(req.params.id).get();
        if (doc.exists) {
          return res.json(doc.data());
        }
      } catch (firestoreError) {
        log.warn(
          { err: firestoreError },
          "Firestore company lookup failed — falling back to MySQL",
        );
      }

      // Fallback to MySQL — company may have been created during signup
      // but not yet mirrored to Firestore
      const sqlCompany = await findSqlCompanyById(req.params.id);
      if (sqlCompany) {
        return res.json(mapCompanyRowToApiCompany(sqlCompany));
      }

      // Self-heal missing company rows so settings can still render and save.
      const displayName = (req.user?.name || req.user?.email || "Company")
        .split("@")[0]
        .trim();
      const safeDisplayName = displayName
        ? displayName.charAt(0).toUpperCase() + displayName.slice(1)
        : "Company";
      await ensureMySqlCompany({
        id: req.params.id,
        name: `${safeDisplayName}'s Company`,
        accountType: "owner_operator",
        email: req.user?.email || null,
        subscriptionStatus: "active",
      });

      const provisionedCompany = await findSqlCompanyById(req.params.id);
      if (provisionedCompany) {
        return res.json(mapCompanyRowToApiCompany(provisionedCompany));
      }

      return res.status(404).json({ error: "Company not found" });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [GET /api/companies]");
      res.status(500).json({
        error: "Database error",
        details: "Internal error",
      });
    }
  },
);

router.post(
  "/api/companies",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "POST /api/companies",
    });
    const {
      id,
      name,
      account_type,
      email,
      address,
      city,
      state,
      zip,
      tax_id,
      phone,
      mc_number,
      dot_number,
      load_numbering_config,
      accessorial_rates,
    } = req.body;
    try {
      const normalizedLoadNumberingConfig =
        typeof load_numbering_config === "string"
          ? JSON.parse(load_numbering_config)
          : load_numbering_config;
      const normalizedAccessorialRates =
        typeof accessorial_rates === "string"
          ? JSON.parse(accessorial_rates)
          : accessorial_rates;

      await pool.query(
        `INSERT INTO companies (
          id,
          name,
          account_type,
          email,
          address,
          city,
          state,
          zip,
          tax_id,
          phone,
          mc_number,
          dot_number,
          load_numbering_config,
          accessorial_rates
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          account_type = VALUES(account_type),
          email = VALUES(email),
          address = VALUES(address),
          city = VALUES(city),
          state = VALUES(state),
          zip = VALUES(zip),
          tax_id = VALUES(tax_id),
          phone = VALUES(phone),
          mc_number = VALUES(mc_number),
          dot_number = VALUES(dot_number),
          load_numbering_config = VALUES(load_numbering_config),
          accessorial_rates = VALUES(accessorial_rates)`,
        [
          id,
          name,
          account_type,
          email ?? null,
          address ?? null,
          city ?? null,
          state ?? null,
          zip ?? null,
          tax_id ?? null,
          phone ?? null,
          mc_number ?? null,
          dot_number ?? null,
          normalizedLoadNumberingConfig
            ? JSON.stringify(normalizedLoadNumberingConfig)
            : null,
          normalizedAccessorialRates
            ? JSON.stringify(normalizedAccessorialRates)
            : null,
        ],
      );

      try {
        await db
          .collection("companies")
          .doc(id)
          .set(
            {
              id,
              name,
              account_type,
              email,
              address,
              city,
              state,
              zip,
              tax_id,
              phone,
              mc_number,
              dot_number,
              load_numbering_config: normalizedLoadNumberingConfig,
              accessorial_rates: normalizedAccessorialRates,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
      } catch (firestoreError) {
        log.warn(
          { err: firestoreError },
          "Firestore company mirror failed; MySQL settings remain authoritative",
        );
      }
      res.status(201).json({ message: "Company created" });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [POST /api/companies]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// Party Onboarding / Network Routes
router.get(
  "/api/parties",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    try {
      const [parties]: any = await pool.query(
        "SELECT * FROM parties WHERE company_id = ?",
        [req.user!.tenantId],
      );
      const enrichedParties = await Promise.all(
        parties.map(async (p: any) => {
          const [contacts] = await pool.query(
            "SELECT * FROM party_contacts WHERE party_id = ?",
            [p.id],
          );
          const [docs] = await pool.query(
            "SELECT * FROM party_documents WHERE party_id = ?",
            [p.id],
          );

          // Unified Engine Fetching
          const [rates]: any = await pool.query(
            `
                SELECT r.*, t.id as tier_id, t.tier_start, t.tier_end, t.unit_amount as tier_unit_amount, t.base_amount as tier_base_amount
                FROM rate_rows r
                LEFT JOIN rate_tiers t ON r.id = t.rate_row_id
                WHERE r.party_id = ?
            `,
            [p.id],
          );

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
                tiers: [],
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
                baseAmount: row.tier_base_amount,
              });
            }
            return acc;
          }, []);

          const [constraintSets]: any = await pool.query(
            "SELECT * FROM constraint_sets WHERE party_id = ?",
            [p.id],
          );
          const enrichedConstraints = await Promise.all(
            constraintSets.map(async (cs: any) => {
              const [rules]: any = await pool.query(
                "SELECT * FROM constraint_rules WHERE constraint_set_id = ?",
                [cs.id],
              );
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
                  message: r.message,
                })),
              };
            }),
          );

          const [catalogLinks]: any = await pool.query(
            "SELECT catalog_item_id FROM party_catalog_links WHERE party_id = ?",
            [p.id],
          );

          // Parse entity_class from the type field (unified entity model)
          // Entity classes: Customer, Broker, Vendor, Facility, Contractor
          // Legacy types (Shipper, Vendor_Service, etc.) map to the new model
          const entityClass = p.entity_class || p.type;
          const tags = p.tags
            ? typeof p.tags === "string"
              ? JSON.parse(p.tags)
              : p.tags
            : [];

          return {
            ...p,
            entityClass,
            tags,
            isCustomer: !!p.is_customer,
            isVendor: !!p.is_vendor,
            mcNumber: p.mc_number,
            dotNumber: p.dot_number,
            contacts,
            documents: docs,
            rates: groupedRates,
            constraintSets: enrichedConstraints,
            catalogLinks: catalogLinks.map((cl: any) => cl.catalog_item_id),
          };
        }),
      );
      res.json(enrichedParties);
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/parties",
      });
      if (isMissingTableError(error, "parties")) {
        try {
          const [customers]: any = await pool.query(
            "SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC",
            [req.user!.tenantId],
          );
          const fallbackParties = customers.map((p: any) => {
            const tags = p.tags
              ? typeof p.tags === "string"
                ? JSON.parse(p.tags)
                : p.tags
              : [];

            return {
              ...p,
              entityClass: p.entity_class || p.type || "Customer",
              tags,
              isCustomer:
                p.is_customer === 1 || p.isCustomer === 1 || p.type === "Customer",
              isVendor:
                p.is_vendor === 1 || p.isVendor === 1 || p.type === "Vendor",
              mcNumber: p.mc_number,
              dotNumber: p.dot_number,
              contacts: [],
              documents: [],
              rates: [],
              constraintSets: [],
              catalogLinks: [],
            };
          });
          return res.json(fallbackParties);
        } catch (fallbackError) {
          log.error(
            { err: fallbackError },
            "Fallback GET /api/parties via customers failed",
          );
        }
      }
      log.error({ err: error }, "SERVER ERROR [GET /api/parties]");
      res.status(500).json({ error: "Database error" });
    }
  },
);

// PATCH /api/parties/:id/status — update party onboarding status
router.patch(
  "/api/parties/:id/status",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const { status } = req.body;
    const tenantId = req.user.tenantId;
    const log = createChildLogger({
      correlationId: req.correlationId,
      route: "PATCH /api/parties/:id/status",
    });

    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }

    try {
      const [result]: any = await pool.query(
        "UPDATE parties SET status = ? WHERE id = ? AND company_id = ?",
        [status, req.params.id, tenantId],
      );

      if (result.affectedRows === 0) {
        res.status(404).json({ error: "Party not found" });
        return;
      }

      log.info({ partyId: req.params.id, status }, "Party status updated");
      res.json({ message: "Party status updated" });
    } catch (error) {
      log.error({ err: error }, "Failed to update party status");
      res.status(500).json({ error: "Database error" });
    }
  },
);

router.post(
  "/api/parties",
  requireAuth,
  requireTenant,
  validateBody(createPartySchema),
  async (req: any, res) => {
    const {
      id,
      name,
      type,
      status,
      mcNumber,
      dotNumber,
      rating,
      isCustomer,
      isVendor,
      contacts,
      rates,
      constraintSets,
      catalogLinks,
    } = req.body;

    // Entity class and tags — passed alongside validated fields.
    // entityClass maps to the `type` column for unified entity model.
    // tags are stored as JSON in the `type` field metadata for future
    // migration to a dedicated column when the DB schema is extended.
    const entityClass = req.body.entityClass || type;
    const tags = req.body.tags || [];
    const partyId = id || uuidv4();

    const finalCompanyId = req.user.tenantId;
    const finalTenantId = req.user.tenantId;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Use entityClass as the type value for unified entity model
      // Tags stored as JSON string in the tags column
      const tagsJson = tags && tags.length > 0 ? JSON.stringify(tags) : null;
      await connection.query(
        "REPLACE INTO parties (id, company_id, name, type, is_customer, is_vendor, status, mc_number, dot_number, rating, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          partyId,
          finalCompanyId,
          name,
          entityClass || type,
          isCustomer,
          isVendor,
          status,
          mcNumber,
          dotNumber,
          rating,
          tagsJson,
        ],
      );

      // Contacts
      await connection.query("DELETE FROM party_contacts WHERE party_id = ?", [
        partyId,
      ]);
      if (contacts) {
        for (const c of contacts) {
          await connection.query(
            "INSERT INTO party_contacts (id, party_id, name, role, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              c.id || uuidv4(),
              partyId,
              c.name,
              c.role,
              c.email,
              c.phone,
              c.isPrimary,
            ],
          );
        }
      }

      // Unified Rates
      await connection.query("DELETE FROM rate_rows WHERE party_id = ?", [
        partyId,
      ]);
      if (rates) {
        for (const r of rates) {
          const rid = r.id || uuidv4();
          await connection.query(
            "INSERT INTO rate_rows (id, company_id, party_id, catalog_item_id, variant_id, direction, currency, price_type, unit_type, base_amount, unit_amount, min_charge, max_charge, free_units, effective_start, effective_end, taxable_flag, rounding_rule, notes_internal, approval_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              rid,
              finalTenantId,
              partyId,
              r.catalogItemId,
              r.variantId,
              r.direction,
              r.currency || "USD",
              r.priceType,
              r.unitType,
              r.baseAmount,
              r.unitAmount,
              r.minCharge,
              r.maxCharge,
              r.freeUnits,
              r.effectiveStart,
              r.effectiveEnd,
              r.taxableFlag,
              r.roundingRule,
              r.notes,
              r.approvalRequired,
            ],
          );
          if (r.tiers) {
            for (const t of r.tiers) {
              await connection.query(
                "INSERT INTO rate_tiers (id, rate_row_id, tier_start, tier_end, unit_amount, base_amount) VALUES (?, ?, ?, ?, ?, ?)",
                [
                  uuidv4(),
                  rid,
                  t.tierStart,
                  t.tierEnd,
                  t.unitAmount,
                  t.baseAmount,
                ],
              );
            }
          }
        }
      }

      // Operational Constraints
      await connection.query("DELETE FROM constraint_sets WHERE party_id = ?", [
        partyId,
      ]);
      if (constraintSets) {
        for (const cs of constraintSets) {
          const csid = cs.id || uuidv4();
          await connection.query(
            "INSERT INTO constraint_sets (id, company_id, party_id, applies_to, priority, status, effective_start, effective_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              csid,
              finalTenantId,
              partyId,
              cs.appliesTo,
              cs.priority,
              cs.status,
              cs.effectiveStart,
              cs.effectiveEnd,
            ],
          );
          if (cs.rules) {
            for (const rule of cs.rules) {
              await connection.query(
                "INSERT INTO constraint_rules (id, constraint_set_id, rule_type, field_key, operator, value_text, enforcement, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  uuidv4(),
                  csid,
                  rule.type,
                  rule.field,
                  rule.operator,
                  rule.value,
                  rule.enforcement,
                  rule.message,
                ],
              );
            }
          }
        }
      }

      // Catalog Links
      await connection.query(
        "DELETE FROM party_catalog_links WHERE party_id = ?",
        [partyId],
      );
      if (catalogLinks) {
        for (const itemId of catalogLinks) {
          await connection.query(
            "INSERT INTO party_catalog_links (id, party_id, catalog_item_id) VALUES (?, ?, ?)",
            [uuidv4(), partyId, itemId],
          );
        }
      }

      await connection.commit();
      res
        .status(201)
        .json({ message: "Party synced with Unified Engine", id: partyId });
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "POST /api/parties",
      });
      await connection.rollback();

      if (isMissingTableError(error, "parties")) {
        try {
          const tagsJson =
            tags && tags.length > 0 ? JSON.stringify(tags) : null;
          const fallbackCustomerType =
            entityClass === "Customer" ? "Direct Customer" : "Broker";
          await pool.query(
            "REPLACE INTO customers (id, company_id, name, type, mc_number, dot_number, email, phone, address, payment_terms, chassis_requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              id || uuidv4(),
              finalTenantId,
              name,
              fallbackCustomerType,
              mcNumber || null,
              dotNumber || null,
              req.body.email || null,
              req.body.phone || null,
              req.body.address || null,
              req.body.payment_terms || null,
              tagsJson,
            ],
          );
          return res.status(201).json({
            message: "Party synced with Unified Engine",
            fallback: "customers",
          });
        } catch (fallbackError) {
          log.error(
            { err: fallbackError },
            "Fallback POST /api/parties via customers failed",
          );
        }
      }
      log.error({ err: error }, "SERVER ERROR [POST /api/parties]");
      res.status(500).json({
        error: "Database error",
        details: "Internal error",
      });
    } finally {
      connection.release();
    }
  },
);

// GLOBAL SEARCH ENGINE (360 Degree Intelligence)
router.get(
  "/api/global-search",
  requireAuth,
  requireTenant,
  async (req: any, res) => {
    const { query } = req.query;
    const companyId = req.user.companyId;

    if (!query || query.length < 2) return res.json([]);
    const q = `%${query}%`;
    const results: any[] = [];

    try {
      // 1. Search Loads (MySQL)
      const [loadRows]: any = await pool.query(
        "SELECT id, load_number, status, pickup_date FROM loads WHERE company_id = ? AND (load_number LIKE ? OR container_number LIKE ? OR bol_number LIKE ?)",
        [companyId, q, q, q],
      );
      loadRows.forEach((l: any) => {
        results.push({
          id: l.id,
          type: "LOAD",
          label: `Load #${l.load_number}`,
          subLabel: `Status: ${l.status} | Date: ${l.pickup_date || "N/A"}`,
          status: l.status,
          chips: [{ label: l.status, color: "blue" }],
        });
      });

      // 2. Search Customers (MySQL)
      const [customerRows]: any = await pool.query(
        "SELECT id, name, type, mc_number FROM customers WHERE company_id = ? AND (name LIKE ? OR mc_number LIKE ? OR email LIKE ?)",
        [companyId, q, q, q],
      );
      customerRows.forEach((c: any) => {
        results.push({
          id: c.id,
          type: "BROKER",
          label: c.name,
          subLabel: `${c.type} | MC: ${c.mc_number || "N/A"}`,
          chips: [{ label: c.type, color: "purple" }],
        });
      });

      // 3. Search Users (Firestore)
      const userSnapshot = await db
        .collection("users")
        .where("company_id", "==", companyId)
        .get();

      userSnapshot.docs.forEach((doc) => {
        const u = doc.data();
        if (
          u.name?.toLowerCase().includes(query.toLowerCase()) ||
          u.email?.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({
            id: u.id,
            type: u.role === "driver" ? "DRIVER" : "USER",
            label: u.name,
            subLabel: `${u.role.toUpperCase()} | ${u.email}`,
            chips: [{ label: u.role, color: "green" }],
          });
        }
      });

      // 4. Search Quotes (MySQL)
      const [quoteRows]: any = await pool.query(
        "SELECT id, pickup_city, dropoff_city, status FROM quotes WHERE company_id = ? AND (id LIKE ? OR pickup_city LIKE ? OR dropoff_city LIKE ?)",
        [companyId, q, q, q],
      );
      quoteRows.forEach((q: any) => {
        results.push({
          id: q.id,
          type: "QUOTE",
          label: `Quote #${q.id.slice(0, 8)}`,
          subLabel: `${q.pickup_city} -> ${q.dropoff_city}`,
          status: q.status,
          chips: [{ label: "Quote", color: "orange" }],
        });
      });

      res.json(results.slice(0, 20));
    } catch (error) {
      const log = createChildLogger({
        correlationId: req.correlationId,
        route: "GET /api/global-search",
      });
      log.error({ err: error }, "Search failed");
      res.status(500).json({ error: "Search failed" });
    }
  },
);

export default router;
