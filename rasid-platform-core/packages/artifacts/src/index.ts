import { ARTIFACT_CONTRACT, ArtifactSchema, type Artifact, assertContractVersion } from "@rasid/contracts";

export { ARTIFACT_CONTRACT, ArtifactSchema, assertContractVersion };
export type { Artifact };

export const assertArtifactContractVersion = (version: string): void => {
  assertContractVersion("artifact", version);
};
