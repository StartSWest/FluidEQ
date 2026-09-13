/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { isPremiumLookId, packIdOfLook } from 'common/scenePacks';
import type { IScenePack } from 'common/scenePacks';
import { loadMemberScene } from '../utils/memberScenes';
import { loadScenePack } from '../utils/scenePacks';
import { findSceneSky, type ISceneSky } from '../utils/sceneTint';
import { rememberSceneSky, studioSkyKey } from '../utils/sceneTintStore';
import { sampleSceneInWorker } from './sceneStillClient';

/**
 * What colour a scene's sky is, measured by drawing the scene.
 *
 * A pack says nothing about its sky: its swatch is the picker icon's few
 * colours, which for a neon skyline are the signs, not the night behind them.
 * The only thing that knows is the shader, so the scene is drawn off screen
 * through the same showcase its gallery picture comes from and the frames are
 * read back — in the scene still worker, on the context the pictures use.
 * Drawn on the page's thread, as it was, opening the Studio held the window
 * still for up to half a second while the sky of the scene on its stage was
 * compiled and read.
 */

const loadPack = (lookId: string) =>
  isPremiumLookId(lookId)
    ? loadScenePack(packIdOfLook(lookId))
    : loadMemberScene(lookId);

/** The colour, null for no colour to lend, undefined for not drawn here. */
export type TSkyMeasurement = ISceneSky | null | undefined;

let turn: Promise<unknown> = Promise.resolve();

/**
 * One scene asked for at a time. The worker draws one at a time whatever it
 * is sent, so waiting here costs nothing, and it is what lets a Studio build
 * an AI saved over, five times in a second, be skipped before it is drawn
 * instead of queued behind the others.
 */
const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
  const run = turn.then(work, work);
  turn = run.catch(() => undefined);
  return run;
};

const skyOf = async (
  what: string,
  pack: IScenePack | undefined,
): Promise<TSkyMeasurement> => {
  const pixels = pack ? await sampleSceneInWorker(pack) : undefined;
  if (!pixels) {
    console.error(`Could not draw scene "${what}" to measure its colour.`);
    return undefined;
  }
  return findSceneSky(pixels) ?? null;
};

/**
 * One measurement per scene version per session. A scene that could not be
 * drawn stays unmeasured until the next launch rather than being tried again
 * every time it comes round the auto-cycle; a scene that was drawn is
 * remembered across launches, sky or no sky.
 */
const measurements = new Map<string, Promise<TSkyMeasurement>>();

/** `lookId`'s sky at `version`. */
export const measureSceneSky = (
  lookId: string,
  version: string,
): Promise<TSkyMeasurement> => {
  const key = `${lookId}@${version}`;
  const running = measurements.get(key);
  if (running) {
    return running;
  }
  const measurement = inTurn(async () => {
    const sky = await skyOf(lookId, await loadPack(lookId));
    if (sky !== undefined) {
      rememberSceneSky(lookId, version, sky);
    }
    return sky;
  }).catch((error: unknown) => {
    console.error(`Could not measure the colour of scene "${lookId}":`, error);
    return undefined;
  });
  measurements.set(key, measurement);
  return measurement;
};

/** The only Studio build worth drawing: every earlier one has been saved over. */
let newestStudioBuild: string | undefined;

/**
 * The sky of `project`'s build `build`, drawn from the pack it built, and
 * remembered as that project's colour so going back to it later — this
 * launch or the next — shows its colour at once.
 *
 * A build saved over while it waits its turn is never drawn, and answers
 * undefined: only the newest one can still be on the stage, and an AI saving
 * in a burst would otherwise queue a drawing for every save.
 */
export const measureStudioSky = (
  project: string,
  build: string,
  pack: IScenePack,
): Promise<TSkyMeasurement> => {
  newestStudioBuild = build;
  const key = `studio:${build}`;
  const running = measurements.get(key);
  if (running) {
    return running;
  }
  const measurement = inTurn(async () => {
    if (build !== newestStudioBuild) {
      measurements.delete(key);
      return undefined;
    }
    const sky = await skyOf(pack.id, pack);
    if (sky !== undefined) {
      rememberSceneSky(studioSkyKey(project), build, sky);
    }
    return sky;
  }).catch((error: unknown) => {
    console.error(`Could not measure the colour of "${pack.id}":`, error);
    return undefined;
  });
  measurements.set(key, measurement);
  return measurement;
};
