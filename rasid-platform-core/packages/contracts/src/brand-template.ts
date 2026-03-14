import { z } from "zod";
import { ContractEnvelopeSchema, contractEnvelope } from "./common";

export const TemplateBrandPresetSchema = z.object({
  contract: ContractEnvelopeSchema,
  preset_id: z.string(),
  preset_scope: z.enum(["org_preset", "workspace_preset", "user_preset", "uploaded_custom_preset"]),
  colors: z.array(z.record(z.unknown())),
  fonts: z.array(z.record(z.unknown())),
  logos: z.array(z.string()),
  layout_rules: z.array(z.record(z.unknown())),
  spacing_grid_rules: z.array(z.record(z.unknown())),
  chart_palette: z.array(z.record(z.unknown())),
  icon_style: z.string(),
  rtl_support: z.boolean(),
  lock_behavior: z.object({
    strict_lock: z.boolean(),
    soft_lock: z.boolean()
  })
});

export const TEMPLATE_BRAND_CONTRACT = contractEnvelope("template_brand");

export type TemplateBrandPreset = z.infer<typeof TemplateBrandPresetSchema>;
