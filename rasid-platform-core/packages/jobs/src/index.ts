import { AllowedJobTransitions, JOB_CONTRACT, JobSchema, type Job, assertContractVersion } from "@rasid/contracts";

export { AllowedJobTransitions, JOB_CONTRACT, JobSchema, assertContractVersion };
export type { Job };

export const assertJobContractVersion = (version: string): void => {
  assertContractVersion("job", version);
};
