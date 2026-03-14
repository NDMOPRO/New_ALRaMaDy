import {
  CANVAS_CONTRACT,
  MODE_CONTRACT,
  CanvasSessionStateSchema,
  DragDropPayloadSchema,
  ModeContextSchema,
  type CanvasSessionState,
  type ModeContext,
  assertContractVersion
} from "@rasid/contracts";

export {
  CANVAS_CONTRACT,
  MODE_CONTRACT,
  CanvasSessionStateSchema,
  DragDropPayloadSchema,
  ModeContextSchema,
  assertContractVersion
};
export type { CanvasSessionState, ModeContext };

export const assertCanvasContractVersion = (version: string): void => {
  assertContractVersion("canvas", version);
};
