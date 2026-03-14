import { LIBRARY_CONTRACT, LibraryAssetSchema, type LibraryAsset, assertContractVersion } from "@rasid/contracts";

export { LIBRARY_CONTRACT, LibraryAssetSchema, assertContractVersion };
export type { LibraryAsset };

export const assertLibraryContractVersion = (version: string): void => {
  assertContractVersion("library", version);
};
