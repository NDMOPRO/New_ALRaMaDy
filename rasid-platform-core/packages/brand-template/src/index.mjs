import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const BrandTemplateContract = { contract: "brand_template", version: "1.0.0" };

export function validateBrandTemplate(model) {
  assertVersioned("brand_template", model);
  assertRequired(model, [
    "preset_id", "scope", "colors", "fonts", "logos", "layout_rules",
    "spacing_grid_rules", "chart_palette", "icon_style", "rtl_support", "lock_behavior"
  ], "brand_template");
  return true;
}
