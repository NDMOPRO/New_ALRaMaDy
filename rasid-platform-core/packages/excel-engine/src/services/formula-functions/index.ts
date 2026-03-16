import { formulaRegistry } from '../../utils/formula-registry';
import { mathTrigFunctions } from './math-trig.functions';
import { statisticalFunctions } from './statistical.functions';
import { statisticalAdvancedFunctions } from './statistical-advanced.functions';
import { lookupReferenceFunctions } from './lookup-reference.functions';
import { textFunctions } from './text.functions';
import { dateTimeFunctions } from './date-time.functions';
import { logicalFunctions } from './logical.functions';
import { financialFunctions } from './financial.functions';
import { informationFunctions } from './information.functions';
import { dynamicArrayFunctions } from './dynamic-array.functions';
import { databaseFunctions } from './database.functions';

/**
 * Register all formula functions in the global registry.
 * Call this once at startup.
 */
export function registerAllFormulas(): void {
  formulaRegistry.registerAll(mathTrigFunctions);
  formulaRegistry.registerAll(statisticalFunctions);
  formulaRegistry.registerAll(statisticalAdvancedFunctions);
  formulaRegistry.registerAll(lookupReferenceFunctions);
  formulaRegistry.registerAll(textFunctions);
  formulaRegistry.registerAll(dateTimeFunctions);
  formulaRegistry.registerAll(logicalFunctions);
  formulaRegistry.registerAll(financialFunctions);
  formulaRegistry.registerAll(informationFunctions);
  formulaRegistry.registerAll(dynamicArrayFunctions);
  formulaRegistry.registerAll(databaseFunctions);
}

// Auto-register on import
registerAllFormulas();

export {
  mathTrigFunctions,
  statisticalFunctions,
  statisticalAdvancedFunctions,
  lookupReferenceFunctions,
  textFunctions,
  dateTimeFunctions,
  logicalFunctions,
  financialFunctions,
  informationFunctions,
  dynamicArrayFunctions,
  databaseFunctions,
};
