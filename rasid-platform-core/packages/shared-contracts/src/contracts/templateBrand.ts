import { z } from "zod";

export const TemplateBrandPresetSchema = z.object({
  preset_id: z.string(),
  scope: z.enum(["org", "workspace", "user", "uploaded_custom"]),
  colors: z.array(z.string()),
  fonts: z.array(z.string()),
  logos: z.array(z.string()),
  layout_rules: z.array(z.string()),
  spacing_grid_rules: z.array(z.string()),
  chart_palette: z.array(z.string()),
  icon_style: z.string(),
  rtl_support: z.boolean(),
  lock_behavior: z.object({ strict_lock: z.boolean(), soft_lock: z.boolean() })
});
