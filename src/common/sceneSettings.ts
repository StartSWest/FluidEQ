/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isNeutralResponse, type ISceneResponse } from './sceneResponse';
import type { IScenePack } from './scenePacks';

/**
 * Where a scene's settings stand: its own controls, its ambient controls, and
 * how it answers the music.
 *
 * The same three things `projectSettings.ts` writes into a `pack.json`, read
 * back out of a pack instead. The Studio uses it for one thing: what Reset
 * goes back to, which is the scene as it was last published (see
 * `useStudioBaseline.ts`).
 */
export interface ISceneSettings {
  params: Readonly<Record<string, number>>;
  ambient: Readonly<Record<string, number>>;
  /** Absent for a scene that hears the music as the engine hears it. */
  response?: ISceneResponse;
}

const valuesOf = (
  entries: ReadonlyArray<{ id: string; value: number }> | undefined,
): Record<string, number> =>
  Object.fromEntries((entries ?? []).map((entry) => [entry.id, entry.value]));

/** Where `pack`'s settings stand now. */
export const settingsOfPack = (pack: IScenePack): ISceneSettings => ({
  params: valuesOf(pack.params),
  ambient: valuesOf(pack.ambient?.params),
  ...(pack.response && !isNeutralResponse(pack.response)
    ? { response: pack.response }
    : {}),
});
