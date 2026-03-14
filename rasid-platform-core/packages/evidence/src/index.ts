import {
  EVIDENCE_CONTRACT,
  EvidencePackSchema,
  ValidationCheckResultSchema,
  type EvidencePack,
  type ValidationCheckResult,
  assertContractVersion
} from "@rasid/contracts";

export { EVIDENCE_CONTRACT, EvidencePackSchema, ValidationCheckResultSchema, assertContractVersion };
export type { EvidencePack, ValidationCheckResult };

export const assertEvidenceContractVersion = (version: string): void => {
  assertContractVersion("evidence", version);
};
