/**
 * Safe dynamic UPDATE builder — allowlists column names to prevent SQL injection.
 * Used by all repository update methods.
 */

/**
 * Build a safe UPDATE SET clause from data, only allowing known column names.
 * Returns { setClause, values } or null if no valid fields to update.
 *
 * @param data - Object with key/value pairs from request body
 * @param allowedColumns - Exhaustive list of columns that may be updated
 * @param extraSets - Additional SET clauses to append (e.g., "updated_by = ?")
 * @param extraValues - Values for extraSets
 */
export function buildSafeUpdate(
  data: Record<string, unknown>,
  allowedColumns: readonly string[],
  extraSets: string[] = [],
  extraValues: unknown[] = [],
): { setClause: string; values: unknown[] } | null {
  const allowedSet = new Set(allowedColumns);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedSet.has(key) && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    // Keys not in allowedSet are silently ignored — no injection path
  }

  for (let i = 0; i < extraSets.length; i++) {
    fields.push(extraSets[i]);
    if (i < extraValues.length) values.push(extraValues[i]);
  }

  if (fields.length === 0) return null;

  return { setClause: fields.join(", "), values };
}
