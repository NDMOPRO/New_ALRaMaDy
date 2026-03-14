import { PUBLICATION_CONTRACT, PublicationSchema, type Publication, assertContractVersion } from "@rasid/contracts";

export { PUBLICATION_CONTRACT, PublicationSchema, assertContractVersion };
export type { Publication };

export const assertOutputPublicationContractVersion = (version: string): void => {
  assertContractVersion("publication", version);
};
