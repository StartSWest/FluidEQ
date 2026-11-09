/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { TWallpaperMotion } from 'common/wallpaper';
import type { ISceneFrame } from '../graph/sceneGl';
import { createCalmShaper } from '../wallpaper/calmMotion';

/**
 * What the Studio stage's scene hears: the music — what is playing, or the
 * demo song while nothing plays — or Calm, the slow, quiet motion a desktop
 * background set to Calm plays (Ivan, 2026-11-09: "if I click change to calm
 * that's what I want so user can check both calmed and music mode on any
 * music mode, demo or real"). The stage's own: the app's desktop setting is
 * never read or written, and it starts on the music each time the Studio
 * opens, like the stage's other ways of looking.
 */
export function useStageMotion() {
  const [motion, setMotion] = useState<TWallpaperMotion>('music');
  const toggleMotion = useCallback(
    () => setMotion((shown) => (shown === 'calm' ? 'music' : 'calm')),
    [],
  );
  return { motion, toggleMotion };
}

/**
 * The frame the stage's scene gets for `motion`, through the desktop's own
 * calm shaper (`calmMotion.ts`), so what the author sees in Calm is what a
 * listener's desktop plays, handover included: the switch eases across over
 * the shaper's second and a half instead of cutting. One shaper for the
 * stage's life, switched in place, so a change never starts the scene again.
 */
export function useStageCalm(
  motion: TWallpaperMotion,
): (frame: ISceneFrame) => ISceneFrame {
  const [shaper] = useState(() => createCalmShaper(motion));
  useEffect(() => shaper.setMotion(motion), [shaper, motion]);
  return shaper.shape;
}
