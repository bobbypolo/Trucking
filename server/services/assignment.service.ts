import { driverRepository } from "../repositories/driver.repository";
import { equipmentRepository } from "../repositories/equipment.repository";
import { loadRepository } from "../repositories/load.repository";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} from "../errors/AppError";

/**
 * Assignment Service — orchestrates driver and equipment assignment to loads.
 *
 * Validates:
 *   - Entity existence (load, driver, equipment)
 *   - Tenant isolation (same company_id)
 *   - Business rules (compliance status, equipment availability)
 *   - Optimistic locking (version check on equipment assignment)
 */
export const assignmentService = {
  /**
   * Assign a driver to a load.
   *
   * Validates:
   *   1. Load exists and belongs to the tenant
   *   2. Driver exists and belongs to the tenant
   *   3. Driver's company_id matches the requesting company (cross-tenant = 403)
   *   4. Driver compliance_status is 'Eligible' (Restricted = 422)
   *
   * @param loadId - The load to assign the driver to
   * @param driverId - The driver to assign
   * @param companyId - Tenant ID for isolation
   * @returns The updated load row
   */
  async assignDriver(
    loadId: string,
    driverId: string,
    companyId: string,
  ): Promise<Record<string, unknown>> {
    // 1. Verify load exists for this tenant
    const load = await loadRepository.findById(loadId, companyId);
    if (!load) {
      throw new NotFoundError(
        `Load '${loadId}' not found for tenant '${companyId}'`,
        { loadId, companyId },
      );
    }

    // 2. Look up driver — first try with the requesting company's scope
    const driver = await driverRepository.findById(driverId, companyId);

    if (!driver) {
      throw new NotFoundError(
        `Driver '${driverId}' not found for tenant '${companyId}'`,
        { driverId, companyId },
      );
    }

    // 3. Cross-tenant check: driver's company_id must match
    if (driver.company_id !== companyId) {
      throw new ForbiddenError(
        "Cross-tenant driver assignment is not allowed",
        {
          driverId,
          driverCompanyId: driver.company_id,
          requestingCompanyId: companyId,
        },
        "FORBIDDEN_CROSS_TENANT",
      );
    }

    // 4. Compliance check
    if (driver.compliance_status === "Restricted") {
      throw new BusinessRuleError(
        `Driver '${driverId}' has restricted compliance status and cannot be assigned`,
        { driverId, compliance_status: driver.compliance_status },
        "BUSINESS_RULE_DRIVER_RESTRICTED",
      );
    }

    // 5. Update the load with the driver assignment
    const updated = await loadRepository.update(
      loadId,
      { driver_id: driverId },
      companyId,
    );

    return updated as Record<string, unknown>;
  },

  /**
   * Assign equipment to a load with optimistic locking.
   *
   * Validates:
   *   1. Load exists and belongs to the tenant
   *   2. Equipment exists and belongs to the tenant
   *   3. Equipment company_id matches the requesting company (cross-tenant = 403)
   *   4. Equipment status is 'Active' (Out of Service / Removed = 422)
   *   5. Equipment is not already assigned to another load (422)
   *   6. Optimistic lock: version must match (409 on conflict)
   *
   * @param loadId - The load to assign equipment to
   * @param equipmentId - The equipment to assign
   * @param companyId - Tenant ID for isolation
   * @param expectedVersion - Expected version for optimistic locking
   * @returns The updated equipment row
   */
  async assignEquipment(
    loadId: string,
    equipmentId: string,
    companyId: string,
    expectedVersion: number,
  ): Promise<Record<string, unknown>> {
    // 1. Verify load exists for this tenant
    const load = await loadRepository.findById(loadId, companyId);
    if (!load) {
      throw new NotFoundError(
        `Load '${loadId}' not found for tenant '${companyId}'`,
        { loadId, companyId },
      );
    }

    // 2. Look up equipment with tenant scope
    const equipment = await equipmentRepository.findById(
      equipmentId,
      companyId,
    );

    if (!equipment) {
      throw new NotFoundError(
        `Equipment '${equipmentId}' not found for tenant '${companyId}'`,
        { equipmentId, companyId },
      );
    }

    // 3. Cross-tenant check
    if (equipment.company_id !== companyId) {
      throw new ForbiddenError(
        "Cross-tenant equipment assignment is not allowed",
        {
          equipmentId,
          equipmentCompanyId: equipment.company_id,
          requestingCompanyId: companyId,
        },
        "FORBIDDEN_CROSS_TENANT",
      );
    }

    // 4. Equipment status check
    if (equipment.status !== "Active") {
      throw new BusinessRuleError(
        `Equipment '${equipmentId}' is '${equipment.status}' and cannot be assigned`,
        { equipmentId, status: equipment.status },
        "BUSINESS_RULE_EQUIPMENT_UNAVAILABLE",
      );
    }

    // 5. Already assigned check
    if (equipment.assigned_load_id && equipment.assigned_load_id !== loadId) {
      throw new BusinessRuleError(
        `Equipment '${equipmentId}' is already assigned to load '${equipment.assigned_load_id}'`,
        {
          equipmentId,
          currentLoadId: equipment.assigned_load_id,
          requestedLoadId: loadId,
        },
        "BUSINESS_RULE_EQUIPMENT_ALREADY_ASSIGNED",
      );
    }

    // 6. Perform assignment with optimistic locking
    const updated = await equipmentRepository.assignToLoad(
      equipmentId,
      loadId,
      companyId,
      expectedVersion,
    );

    if (!updated) {
      throw new ConflictError(
        `Equipment '${equipmentId}' was modified by another process (version conflict)`,
        { equipmentId, expectedVersion },
      );
    }

    return updated as Record<string, unknown>;
  },
};
