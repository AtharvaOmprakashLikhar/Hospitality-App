import { prisma } from '../db';

/**
 * Helper to log events in the immutable AuditLog table.
 */
export async function logAudit(
  propertyId: string | null,
  userId: string | null,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  entityId: string,
  changes: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        propertyId,
        userId,
        action,
        entity,
        entityId,
        changes: changes || {},
      },
    });
  } catch (err: any) {
    console.error(`[Audit Log Error] Failed to write audit entry:`, err.message);
  }
}
