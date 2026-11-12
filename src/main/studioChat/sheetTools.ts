/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IMcpTool } from '../studioAgent/mcpProtocol';
import createBuildSheetTool from './buildSheetTool';
import createPoseSheetTool from './poseSheetTool';
import type { ISheetToolsDeps } from './sheetShared';

/**
 * The chat's two sheet tools, which make an animation's frames without a
 * picture being drawn and without a command (Ivan, 2026-11-09: "fix thje
 * animator", after an animator answered that it had no way to make a sheet
 * once the Studio's agents lost the shell): `pose_sheet` bends a picture of
 * the project into poses, `build_sheet` lays frames the member brought, or
 * cells of a sheet, into one grid. Both read only inside the project, write
 * only `art/<name>.png` and `animations/<name>.json`, and decode in main
 * within the sheet's bounds (`sheetFiles.ts`). Neither tool starts anything
 * outside FluidEQ.
 */
export const createSheetTools = (deps: ISheetToolsDeps): IMcpTool[] => [
  createPoseSheetTool(deps),
  createBuildSheetTool(deps),
];

export default createSheetTools;
