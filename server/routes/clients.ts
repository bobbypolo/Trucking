import { Router, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/requireAuth";
import { requireTenant } from "../middleware/requireTenant";
import { validateBody } from "../middleware/validate";
import {
  createPartySchema,
  normalizeEntityClass,
  CANONICAL_ENTITY_CLASSES,
} from "../schemas/parties";
import { createClientSchema } from "../schemas/client";
import pool from "../db";
import db from "../firestore";
import { redactData, getVisibilitySettings } from "../helpers";
import { createRequestLogger } from "../lib/logger";
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

// GET /api/clients — list clients for authenticated tenant
router.get(
  "/api/clients",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    const tenantId = req.user!.tenantId;
    try {
      const [rows]: any = await pool.query(
        "SELECT * FROM customers WHERE company_id = ? AND archived_at IS NULL ORDER BY name ASC",
        [tenantId],
      );
      const settings = await getVisibilitySettings(tenantId);
      res.json(redactData(rows, req.user.role, settings));
    } catch (error: any) {
      if (
        isMissingTableError(error, "customers") ||
        isMissingTableError(error, "archived_at")
      ) {
        try {
          const [rows]: any = await pool.query(
            "SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC",
            [tenantId],
          );
          return res.json(rows);
        } catch (_) {
          /* fall through */
        }
      }
      next(error);
    }
  },
);

// GET /api/clients/:companyId — legacy route
router.get(
  "/api/clients/:companyId",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    try {
      const includeArchived = req.query.include_archived === "true";
      const sql = includeArchived
        ? "SELECT * FROM customers WHERE company_id = ? ORDER BY name ASC"
        : "SELECT * FROM customers WHERE company_id = ? AND archived_at IS NULL ORDER BY name ASC";
      const [rows]: any = await pool.query(sql, [req.params.companyId]);
      const settings = await getVisibilitySettings(req.params.companyId);
      res.json(redactData(rows, req.user.role, settings));
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/clients");
      if (
        isMissingTableError(error, "customers") ||
        isMissingTableError(error, "archived_at")
      ) {
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
      next(error);
    }
  },
);

const ARCHIVE_ALLOWED_ROLES = ["admin", "dispatcher"];

// PATCH /api/clients/:id/archive — soft-delete a customer
router.patch(
  "/api/clients/:id/archive",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    const log = createRequestLogger(req, "PATCH /api/clients/:id/archive");

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
      next(error);
    }
  },
);

// PATCH /api/clients/:id/unarchive — restore an archived customer
router.patch(
  "/api/clients/:id/unarchive",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    const log = createRequestLogger(req, "PATCH /api/clients/:id/unarchive");

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
      next(error);
    }
  },
);

router.post(
  "/api/clients",
  requireAuth,
  requireTenant,
  validateBody(createClientSchema),
  async (req: any, res: any, next: NextFunction) => {
    const tenantId = req.user!.tenantId;
    const log = createRequestLogger(req, "POST /api/clients");

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
      next(error);
    }
  },
);

// Companies
router.get(
  "/api/companies/:id",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    const log = createRequestLogger(req, "GET /api/companies");

    // Explicit tenant isolation: :id must match authenticated user's tenant
    const tenantId = req.user?.tenantId || req.user?.companyId;
    if (req.params.id !== tenantId) {
      res.status(403).json({ error: "Access denied: tenant mismatch" });
      return;
    }

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
      next(error);
    }
  },
);

router.post(
  "/api/companies",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    const log = createRequestLogger(req, "POST /api/companies");

    // Enforce admin-only access for company settings changes
    const callerRole = req.user?.role;
    const adminRoles = ["admin", "OWNER_ADMIN", "ORG_OWNER_SUPER_ADMIN"];
    if (!adminRoles.includes(callerRole)) {
      return res
        .status(403)
        .json({ error: "Admin role required to update company settings." });
    }

    // Explicit tenant isolation: body.id must match authenticated user's tenant
    const tenantId = req.user?.tenantId || req.user?.companyId;
    if (req.body.id && req.body.id !== tenantId) {
      return res.status(403).json({ error: "Access denied: tenant mismatch" });
    }

    // Accept both camelCase (frontend) and snake_case field names
    const body = req.body;
    const id = body.id || tenantId;
    const name = body.name;
    const account_type = body.account_type ?? body.accountType;
    const email = body.email;
    const address = body.address;
    const city = body.city;
    const state = body.state;
    const zip = body.zip;
    const tax_id = body.tax_id ?? body.taxId;
    const phone = body.phone;
    const mc_number = body.mc_number ?? body.mcNumber;
    const dot_number = body.dot_number ?? body.dotNumber;
    const load_numbering_config =
      body.load_numbering_config ?? body.loadNumberingConfig;
    const accessorial_rates = body.accessorial_rates ?? body.accessorialRates;
    const operating_mode = body.operating_mode ?? body.operatingMode;
    const driver_visibility_settings =
      body.driver_visibility_settings ?? body.driverVisibilitySettings;

    try {
      const normalizeJson = (val: unknown): string | null => {
        if (val == null) return null;
        if (typeof val === "string") {
          try {
            JSON.parse(val);
            return val;
          } catch {
            return null;
          }
        }
        return JSON.stringify(val);
      };

      const normalizedLoadNumberingConfig = normalizeJson(
        load_numbering_config,
      );
      const normalizedAccessorialRates = normalizeJson(accessorial_rates);
      const normalizedDriverVisibilitySettings = normalizeJson(
        driver_visibility_settings,
      );

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
          accessorial_rates,
          operating_mode,
          driver_visibility_settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          accessorial_rates = VALUES(accessorial_rates),
          operating_mode = VALUES(operating_mode),
          driver_visibility_settings = VALUES(driver_visibility_settings)`,
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
          normalizedLoadNumberingConfig,
          normalizedAccessorialRates,
          operating_mode ?? null,
          normalizedDriverVisibilitySettings,
        ],
      );

      // Mirror all settings to Firestore (full company object) so that
      // GET /api/companies/:id returns governance, permissions, scoring, etc.
      // Fields without a dedicated SQL column are stored only in Firestore.
      const firestorePayload: Record<string, unknown> = {
        id,
        name,
        account_type,
        accountType: account_type,
        email,
        address,
        city,
        state,
        zip,
        tax_id,
        taxId: tax_id,
        phone,
        mc_number,
        mcNumber: mc_number,
        dot_number,
        dotNumber: dot_number,
        load_numbering_config: normalizedLoadNumberingConfig
          ? JSON.parse(normalizedLoadNumberingConfig)
          : null,
        loadNumberingConfig: normalizedLoadNumberingConfig
          ? JSON.parse(normalizedLoadNumberingConfig)
          : null,
        accessorial_rates: normalizedAccessorialRates
          ? JSON.parse(normalizedAccessorialRates)
          : null,
        accessorialRates: normalizedAccessorialRates
          ? JSON.parse(normalizedAccessorialRates)
          : null,
        operating_mode,
        operatingMode: operating_mode,
        driverVisibilitySettings: driver_visibility_settings,
        updatedAt: new Date().toISOString(),
      };

      // Persist settings that have no SQL column into Firestore only
      const firestoreOnlyFields = [
        "governance",
        "scoringConfig",
        "driverPermissions",
        "ownerOpPermissions",
        "dispatcherPermissions",
        "capabilityMatrix",
        "supportedFreightTypes",
        "defaultFreightType",
      ];
      for (const field of firestoreOnlyFields) {
        if (body[field] !== undefined) {
          firestorePayload[field] = body[field];
        }
      }

      try {
        await db
          .collection("companies")
          .doc(id)
          .set(firestorePayload, { merge: true });
      } catch (firestoreError) {
        log.warn(
          { err: firestoreError },
          "Firestore company mirror failed; MySQL settings remain authoritative",
        );
      }
      res.status(201).json({ message: "Company settings saved" });
    } catch (error) {
      log.error({ err: error }, "SERVER ERROR [POST /api/companies]");
      next(error);
    }
  },
);

// Party Onboarding / Network Routes
router.get(
  "/api/parties",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    try {
      const [parties]: any = await pool.query(
        "SELECT * FROM parties WHERE company_id = ?",
        [req.user!.tenantId],
      );

      if (parties.length === 0) {
        res.json([]);
        return;
      }

      const partyIds = parties.map((p: any) => p.id);

      // Batch-fetch all related data in parallel (6 queries instead of 5N+1)
      const [
        [allContacts],
        [allDocs],
        [allRates],
        [allConstraintSets],
        [allConstraintRules],
        [allCatalogLinks],
      ]: any = await Promise.all([
        pool.query("SELECT * FROM party_contacts WHERE party_id IN (?)", [
          partyIds,
        ]),
        pool.query("SELECT * FROM party_documents WHERE party_id IN (?)", [
          partyIds,
        ]),
        pool.query(
          `SELECT r.*, t.id as tier_id, t.tier_start, t.tier_end,
                  t.unit_amount as tier_unit_amount, t.base_amount as tier_base_amount
           FROM rate_rows r
           LEFT JOIN rate_tiers t ON r.id = t.rate_row_id
           WHERE r.party_id IN (?)`,
          [partyIds],
        ),
        pool.query("SELECT * FROM constraint_sets WHERE party_id IN (?)", [
          partyIds,
        ]),
        pool.query(
          `SELECT cr.*, cs.party_id
           FROM constraint_rules cr
           JOIN constraint_sets cs ON cr.constraint_set_id = cs.id
           WHERE cs.party_id IN (?)`,
          [partyIds],
        ),
        pool.query("SELECT * FROM party_catalog_links WHERE party_id IN (?)", [
          partyIds,
        ]),
      ]);

      // Group results by party_id into Maps for O(1) lookup
      const contactsByParty = new Map<string, any[]>();
      for (const c of allContacts) {
        const list = contactsByParty.get(c.party_id) || [];
        list.push(c);
        contactsByParty.set(c.party_id, list);
      }

      const docsByParty = new Map<string, any[]>();
      for (const d of allDocs) {
        const list = docsByParty.get(d.party_id) || [];
        list.push(d);
        docsByParty.set(d.party_id, list);
      }

      const ratesByParty = new Map<string, any[]>();
      for (const row of allRates) {
        const list = ratesByParty.get(row.party_id) || [];
        list.push(row);
        ratesByParty.set(row.party_id, list);
      }

      const constraintSetsByParty = new Map<string, any[]>();
      for (const cs of allConstraintSets) {
        const list = constraintSetsByParty.get(cs.party_id) || [];
        list.push(cs);
        constraintSetsByParty.set(cs.party_id, list);
      }

      const constraintRulesBySetId = new Map<string, any[]>();
      for (const cr of allConstraintRules) {
        const list = constraintRulesBySetId.get(cr.constraint_set_id) || [];
        list.push(cr);
        constraintRulesBySetId.set(cr.constraint_set_id, list);
      }

      const catalogLinksByParty = new Map<string, any[]>();
      for (const cl of allCatalogLinks) {
        const list = catalogLinksByParty.get(cl.party_id) || [];
        list.push(cl);
        catalogLinksByParty.set(cl.party_id, list);
      }

      // Assemble enriched parties from the maps
      const enrichedParties = parties.map((p: any) => {
        const contacts = contactsByParty.get(p.id) || [];
        const docs = docsByParty.get(p.id) || [];
        const rawRates = ratesByParty.get(p.id) || [];

        // Group rate rows with their tiers (same logic as before)
        const groupedRates = rawRates.reduce((acc: any, row: any) => {
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

        // Build constraint sets with their rules from the maps
        const constraintSets = constraintSetsByParty.get(p.id) || [];
        const enrichedConstraints = constraintSets.map((cs: any) => {
          const rules = constraintRulesBySetId.get(cs.id) || [];
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
        });

        const catalogLinks = catalogLinksByParty.get(p.id) || [];

        // Normalize entity class via alias map (handles any legacy data)
        const rawClass = p.entity_class || p.type;
        const entityClass =
          normalizeEntityClass(rawClass) || rawClass || "Customer";
        const tags = p.tags
          ? typeof p.tags === "string"
            ? JSON.parse(p.tags)
            : p.tags
          : [];
        const vendorProfileData = p.vendor_profile
          ? typeof p.vendor_profile === "string"
            ? JSON.parse(p.vendor_profile)
            : p.vendor_profile
          : null;

        return {
          id: p.id,
          companyId: p.company_id,
          name: p.name,
          type: entityClass,
          entityClass,
          tags,
          isCustomer: !!p.is_customer,
          isVendor: !!p.is_vendor,
          status: p.status,
          mcNumber: p.mc_number,
          dotNumber: p.dot_number,
          rating: p.rating,
          vendorProfile: vendorProfileData,
          contacts,
          documents: docs,
          rates: groupedRates,
          constraintSets: enrichedConstraints,
          catalogLinks: catalogLinks.map((cl: any) => cl.catalog_item_id),
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      });

      res.json(enrichedParties);
    } catch (error) {
      const log = createRequestLogger(req, "GET /api/parties");
      if (isMissingTableError(error, "parties")) {
        log.error(
          { err: error },
          "parties table unavailable — returning 503 (no silent fallback to customers)",
        );
        res.status(503).json({
          error: "Party registry unavailable",
          details:
            "The parties table is not available. Please run database migrations.",
        });
        return;
      }
      log.error({ err: error }, "SERVER ERROR [GET /api/parties]");
      next(error);
    }
  },
);

// PATCH /api/parties/:id/status — update party onboarding status
router.patch(
  "/api/parties/:id/status",
  requireAuth,
  requireTenant,
  async (req: any, res: any, next: NextFunction) => {
    const { status } = req.body;
    const tenantId = req.user.tenantId;
    const log = createRequestLogger(req, "PATCH /api/parties/:id/status");

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
      next(error);
    }
  },
);

router.post(
  "/api/parties",
  requireAuth,
  requireTenant,
  validateBody(createPartySchema),
  async (req: any, res: any, next: NextFunction) => {
    const log = createRequestLogger(req, "POST /api/parties");

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
      vendorProfile,
    } = req.body;

    // Alias normalization: resolve legacy type names to canonical entity classes.
    // entityClass from body takes priority, then type field, both normalized.
    const rawEntityClass = req.body.entityClass || type;
    const resolvedEntityClass = normalizeEntityClass(rawEntityClass);

    if (!resolvedEntityClass) {
      log.warn({ rawEntityClass }, "Unrecognized entity class rejected");
      res.status(400).json({
        error: "Invalid entity class",
        details: `"${rawEntityClass}" is not a recognized entity class. Valid classes: ${CANONICAL_ENTITY_CLASSES.join(", ")}. Legacy aliases (Shipper, Carrier, Vendor_Service, Vendor_Equipment, Vendor_Product) are also accepted.`,
      });
      return;
    }

    // Tags are always persisted as JSON — never silently dropped
    const tags: string[] = Array.isArray(req.body.tags) ? req.body.tags : [];
    const tagsJson = JSON.stringify(tags);
    const partyId = id || uuidv4();

    const finalCompanyId = req.user.tenantId;
    const finalTenantId = req.user.tenantId;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Persist party row with canonical entity class and tags
      await connection.query(
        "REPLACE INTO parties (id, company_id, name, type, entity_class, is_customer, is_vendor, status, mc_number, dot_number, rating, tags, vendor_profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          partyId,
          finalCompanyId,
          name,
          resolvedEntityClass,
          resolvedEntityClass,
          isCustomer ??
            (resolvedEntityClass === "Customer" ||
              resolvedEntityClass === "Broker"),
          isVendor ?? resolvedEntityClass === "Vendor",
          status || "Draft",
          mcNumber || null,
          dotNumber || null,
          rating || null,
          tagsJson,
          resolvedEntityClass === "Contractor" && vendorProfile
            ? JSON.stringify({
                capabilities: vendorProfile.capabilities || tags,
                serviceArea: vendorProfile.serviceArea || [],
                equipmentOwnership: vendorProfile.equipmentOwnership || null,
                insuranceProvider: vendorProfile.insuranceProvider || null,
                insurancePolicyNumber:
                  vendorProfile.insurancePolicyNumber || null,
                cdlNumber: vendorProfile.cdlNumber || null,
                cdlState: vendorProfile.cdlState || null,
                cdlExpiry: vendorProfile.cdlExpiry || null,
              })
            : vendorProfile
              ? JSON.stringify(vendorProfile)
              : null,
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

      log.info(
        { partyId, entityClass: resolvedEntityClass, tags },
        "Party created/updated via canonical registry",
      );

      res.status(201).json({
        message: "Party synced with Unified Engine",
        id: partyId,
        entityClass: resolvedEntityClass,
      });
    } catch (error) {
      await connection.rollback();

      if (isMissingTableError(error, "parties")) {
        log.error(
          { err: error },
          "parties table unavailable — returning 503 (no silent fallback to customers)",
        );
        res.status(503).json({
          error: "Party registry unavailable",
          details:
            "The parties table is not available. Please run database migrations.",
        });
        return;
      }

      log.error({ err: error }, "SERVER ERROR [POST /api/parties]");
      next(error);
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
  async (req: any, res: any, next: NextFunction) => {
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

      // 3. Search Users (Firestore) — limit applied for cost-saving (R-P0-07)
      const userSnapshot = await db
        .collection("users")
        .where("company_id", "==", companyId)
        .limit(100)
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
      const log = createRequestLogger(req, "GET /api/global-search");
      log.error({ err: error }, "Search failed");
      next(error);
    }
  },
);

export default router;
