import { parentPort, workerData } from "node:worker_threads";
import { evaluateFormulaTargetsFromWorkbookModel } from "./engine";

const result = evaluateFormulaTargetsFromWorkbookModel(workerData as Parameters<typeof evaluateFormulaTargetsFromWorkbookModel>[0]);
parentPort?.postMessage(result);
