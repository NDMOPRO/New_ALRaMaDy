import { relations } from "drizzle-orm";
import {
  users,
  slideTemplates,
  elementCategories,
  slideElements,
  elementUsageRules,
} from "./schema";

export const slideTemplatesRelations = relations(slideTemplates, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [slideTemplates.uploadedBy],
    references: [users.id],
  }),
  elements: many(slideElements),
}));

export const elementCategoriesRelations = relations(elementCategories, ({ many }) => ({
  elements: many(slideElements),
}));

export const slideElementsRelations = relations(slideElements, ({ one, many }) => ({
  template: one(slideTemplates, {
    fields: [slideElements.templateId],
    references: [slideTemplates.id],
  }),
  category: one(elementCategories, {
    fields: [slideElements.categoryId],
    references: [elementCategories.id],
  }),
  usageRules: many(elementUsageRules),
}));

export const elementUsageRulesRelations = relations(elementUsageRules, ({ one }) => ({
  element: one(slideElements, {
    fields: [elementUsageRules.elementId],
    references: [slideElements.id],
  }),
}));
