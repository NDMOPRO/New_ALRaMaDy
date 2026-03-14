export const CONTRACT_VERSION = "1.0.0";

export const Modes = Object.freeze({ EASY: "easy", ADVANCED: "advanced" });
export const DegradeOutcomes = Object.freeze({
  SUCCESS: "success",
  SUCCESS_WITH_WARNINGS: "success_with_warnings",
  DEGRADED: "degraded",
  FAILED: "failed"
});

export function assertRequired(obj, fields, ctx) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null) {
      throw new Error(`${ctx}: missing required field '${field}'`);
    }
  }
  return true;
}

export function assertOneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(`${field}: invalid value '${value}'`);
}

export function assertVersioned(contractName, model) {
  assertRequired(model, ["contract", "version"], contractName);
  if (model.contract !== contractName) throw new Error(`${contractName}: wrong contract id '${model.contract}'`);
  if (!/^\d+\.\d+\.\d+$/.test(model.version)) throw new Error(`${contractName}: invalid semver '${model.version}'`);
}
