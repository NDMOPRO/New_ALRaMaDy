import {
  TEMPLATE_BRAND_CONTRACT,
  TemplateBrandPresetSchema,
  type TemplateBrandPreset,
  assertContractVersion
} from "@rasid/contracts";

export { TEMPLATE_BRAND_CONTRACT, TemplateBrandPresetSchema, assertContractVersion };
export type { TemplateBrandPreset };

export const assertTemplateBrandContractVersion = (version: string): void => {
  assertContractVersion("template_brand", version);
};
