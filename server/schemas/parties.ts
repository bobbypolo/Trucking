import { z } from "zod";

/**
 * Canonical entity classes for the party registry.
 * All legacy types are normalized to one of these 5 classes.
 */
export const CANONICAL_ENTITY_CLASSES = [
  "Customer",
  "Broker",
  "Vendor",
  "Facility",
  "Contractor",
] as const;

export type CanonicalEntityClass = (typeof CANONICAL_ENTITY_CLASSES)[number];

/**
 * Alias mapping: legacy type names -> canonical entity class.
 * Enforced on every write so persisted data always uses canonical classes.
 */
export const ENTITY_CLASS_ALIAS_MAP: Record<string, CanonicalEntityClass> = {
  Shipper: "Customer",
  Carrier: "Contractor",
  Vendor_Service: "Vendor",
  Vendor_Equipment: "Vendor",
  Vendor_Product: "Vendor",
};

/**
 * Normalize a type/entityClass value to a canonical entity class.
 * Returns the canonical class, or null if the value is not recognized.
 */
export function normalizeEntityClass(
  raw: string | undefined | null,
): CanonicalEntityClass | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Direct match to canonical class
  if (
    (CANONICAL_ENTITY_CLASSES as readonly string[]).includes(trimmed)
  ) {
    return trimmed as CanonicalEntityClass;
  }

  // Alias match
  const alias = ENTITY_CLASS_ALIAS_MAP[trimmed];
  if (alias) return alias;

  return null;
}

export const createPartySchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    mc_number: z.string().optional(),
    dot_number: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    status: z.string().optional(),
    credit_score: z.number().optional(),
    payment_terms: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
