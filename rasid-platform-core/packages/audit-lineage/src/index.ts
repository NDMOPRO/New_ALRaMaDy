import {
  AUDIT_CONTRACT,
  AuditEventSchema,
  LineageEdgeSchema,
  LineageQueryKeysSchema,
  type AuditEvent,
  type LineageEdge,
  assertContractVersion
} from "@rasid/contracts";

export { AUDIT_CONTRACT, AuditEventSchema, LineageEdgeSchema, LineageQueryKeysSchema, assertContractVersion };
export type { AuditEvent, LineageEdge };

export const assertAuditContractVersion = (version: string): void => {
  assertContractVersion("audit", version);
};
