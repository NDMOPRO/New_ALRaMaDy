import { SOURCE_CONTRACT, SourceSchema, type Source, assertContractVersion } from "@rasid/contracts";

export { SOURCE_CONTRACT, SourceSchema, assertContractVersion };
export type { Source };

export const assertSourceContractVersion = (version: string): void => {
  assertContractVersion("source", version);
};
