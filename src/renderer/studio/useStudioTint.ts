/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  setStudioTintSource,
  useStudioTintEnabled,
} from '../utils/sceneTintStore';

/**
 * Hands the window's colour to the project on the Studio's bench while the
 * Studio's switch is on.
 *
 * The project claims it the moment it is on the bench, before its first build
 * has arrived: that is what lets moving from one project to the next go
 * straight to the next one's colour — or to the theme while one never seen
 * before loads — instead of holding the previous project's colour, or passing
 * through the graph's, until the build lands.
 *
 * Each build is its own source — `serial` moves with every save that built —
 * so the colour is measured again whenever the member's AI changes the
 * scene, and a save that breaks keeps the colour of the build still playing.
 * Cleared when the Studio closes, which hands the window back to the graph's
 * choice.
 */
/**
 * `serial` counts builds from zero every launch, so a remembered colour keyed
 * by it alone would match the same number from an earlier launch — a
 * different scene by then — and never be measured again. The launch's own id
 * in front of it makes every launch's builds new.
 *
 * The page's time origin is that id: it is set when the renderer's document
 * starts, so every launch and every reload of the window has its own, and it
 * is there in any environment that has a page. `crypto.randomUUID` was not —
 * the test DOM has none, and calling it here, as the module loaded, failed
 * every suite that so much as imported the Studio.
 */
const LAUNCH = String(performance.timeOrigin);

export default function useStudioTint(
  pack: IScenePack | undefined,
  project: string | undefined,
  serial: number,
  playing: boolean,
) {
  const isOn = useStudioTintEnabled();

  useEffect(() => {
    if (!isOn || !project) {
      setStudioTintSource(undefined);
      return;
    }
    setStudioTintSource({
      project,
      ...(playing && pack
        ? { playing: { build: `${LAUNCH}:${project}#${serial}`, pack } }
        : {}),
    });
  }, [isOn, playing, pack, project, serial]);

  // Apart from the effect above, so moving from one build to the next is one
  // change of source rather than a clear and a set.
  useEffect(() => () => setStudioTintSource(undefined), []);
}
