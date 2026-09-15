/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  normalizeScenePack,
  SCENE_PACK_SCHEMA,
  type IScenePack,
} from '../../common/scenePacks';
import { STARTER_SOURCE, starterManifest } from '../memberScenes/starterScene';

/**
 * The scene the Dynamic lighting page plays without Plus: the Studio's
 * starter, the hanami night every new project begins with. It ships in the
 * app, so the desk is lit on a machine that is offline or signed out, and it
 * was built to move with every part of the music — which is what the lamps
 * are there to show.
 *
 * Named in every language the app speaks: the page says "Lighting for …" with
 * it, and a project name would read as somebody's.
 */

const DEMO_ID = 'lantern-night';

const DEMO_NAMES = {
  en: 'Lantern night',
  es: 'Noche de farolillos',
  pt: 'Noite de lanternas',
  fr: 'Nuit aux lanternes',
  de: 'Laternennacht',
  it: 'Notte di lanterne',
  ru: 'Ночь фонариков',
  zh: '灯笼之夜',
  ja: '提灯の夜',
  hi: 'लालटेन की रात',
};

let built: IScenePack | null | undefined;

/**
 * The starter as a pack, built once: the manifest "New project" would write,
 * with the demo's own name, and the source beside it. Null if the starter
 * ever stops being a valid pack — a test holds that it does not.
 */
export const lightingDemoScene = (): IScenePack | null => {
  if (built === undefined) {
    const manifest: unknown = JSON.parse(
      starterManifest(DEMO_NAMES.en, DEMO_ID),
    );
    built =
      typeof manifest === 'object' && manifest !== null
        ? normalizeScenePack({
            ...manifest,
            schema: SCENE_PACK_SCHEMA,
            names: DEMO_NAMES,
            source: STARTER_SOURCE,
          })
        : null;
  }
  return built;
};
