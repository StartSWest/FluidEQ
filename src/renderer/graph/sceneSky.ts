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
import {
  DAYLIGHT_OF,
  timeKeyOf,
  type TWindowTime,
} from '../utils/sceneDayColours';
import { sceneOwnSky, skyFromWindowColours } from '../utils/sceneOwnColours';
import type { TListenerParams } from '../utils/sceneParamStore';
import { findSceneSky, type ISceneSky } from '../utils/sceneTint';
import { rememberSceneSky, studioSkyKey } from '../utils/sceneTintStore';
import { sampleSceneInWorker } from './sceneStillClient';

/**
 * What colour a scene lends the window: the colours it names or its palette
 * gives (`sceneOwnColours.ts`), and only for a scene that says neither, its
 * sky measured by drawing the scene.
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

/**
 * Which of each scene's controls are choices, learned from its pack the
 * first time it is measured. A choice can swap the palette a scene is drawn
 * in (`sceneShowWhen.ts`), so the colour is measured, and remembered, for
 * the choices the listener made: measured at the pack's own, the panes kept
 * the default palette's colour while Colourful mode wore the chosen one.
 */
const choiceIds = new Map<string, readonly string[]>();

/** The listener's choices in `lookId`, of those its pack offers, in its order. */
const chosenIn = (lookId: string, params: TListenerParams | undefined) =>
  (choiceIds.get(lookId) ?? []).flatMap((id) =>
    params?.[id] === undefined ? [] : [[id, params[id]] as const],
  );

/**
 * The version `lookId`'s colour is remembered under: the scene's own, and
 * the choices the listener made in it. A scene measured before its choices
 * are known is remembered under its version alone, and measured again for
 * them the next time it is asked.
 */
export const sceneSkyVersion = (
  lookId: string,
  version: string,
  params?: TListenerParams,
) => {
  const chosen = chosenIn(lookId, params);
  return chosen.length
    ? `${version}#${chosen.map(([id, value]) => `${id}=${value}`).join(',')}`
    : version;
};

/** `pack` set to the listener's choices, as it is drawn for them. */
const withChoices = (
  pack: IScenePack,
  chosen: ReturnType<typeof chosenIn>,
): IScenePack => {
  if (chosen.length === 0) {
    return pack;
  }
  const values = new Map<string, number>(chosen);
  return {
    ...pack,
    params: pack.params.map((param) =>
      values.has(param.id)
        ? { ...param, value: values.get(param.id) ?? param.value }
        : param,
    ),
  };
};

/**
 * What `pack` says it lends the window at `time`, without drawing it: the
 * colours it names for that time, else its palette's, which hold all day.
 */
const ownSkyAt = (pack: IScenePack, time: TWindowTime) => {
  if (time === 'night') {
    return sceneOwnSky(pack);
  }
  const { windowColours: _night, windowColoursDay, ...rest } = pack;
  return windowColoursDay
    ? skyFromWindowColours(windowColoursDay)
    : sceneOwnSky(rest);
};

const skyOf = async (
  what: string,
  pack: IScenePack | undefined,
  time: TWindowTime,
): Promise<TSkyMeasurement> => {
  // What the scene says comes before any drawing: the same on every
  // computer, with nothing compiled to know it. The pack carries the
  // listener's choices already (`withChoices`).
  const own = pack && ownSkyAt(pack, time);
  if (own) {
    return own;
  }
  // Drawn at the hour it stands for (`sceneDayColours.ts`): the window
  // blends the night's and the day's by the scene's time of day.
  const pixels = pack
    ? await sampleSceneInWorker(pack, DAYLIGHT_OF[time])
    : undefined;
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

/**
 * `lookId`'s sky at `version` and `time`, as the listener's choices in it
 * leave it, remembered under `time`'s key (`timeKeyOf`).
 */
export const measureSceneSky = (
  lookId: string,
  version: string,
  params?: TListenerParams,
  time: TWindowTime = 'night',
): Promise<TSkyMeasurement> => {
  // Until its pack has been read, which controls are choices is not known,
  // and a measurement is kept only once it is, under what it was for.
  const known = choiceIds.has(lookId);
  const remembered = timeKeyOf(lookId, time);
  const key = `${remembered}@${sceneSkyVersion(lookId, version, params)}`;
  const running = known ? measurements.get(key) : undefined;
  if (running) {
    return running;
  }
  const measurement = inTurn(async () => {
    const pack = await loadPack(lookId);
    if (pack) {
      choiceIds.set(
        lookId,
        pack.params.filter((param) => param.options).map((param) => param.id),
      );
    }
    const chosen = chosenIn(lookId, params);
    const sky = await skyOf(lookId, pack && withChoices(pack, chosen), time);
    if (sky !== undefined) {
      rememberSceneSky(
        remembered,
        sceneSkyVersion(lookId, version, params),
        sky,
      );
    }
    return sky;
  }).catch((error: unknown) => {
    console.error(`Could not measure the colour of scene "${lookId}":`, error);
    return undefined;
  });
  if (known) {
    measurements.set(key, measurement);
  } else {
    measurement
      .then(() =>
        measurements.set(
          `${remembered}@${sceneSkyVersion(lookId, version, params)}`,
          measurement,
        ),
      )
      .catch(() => undefined);
  }
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
  time: TWindowTime = 'night',
): Promise<TSkyMeasurement> => {
  newestStudioBuild = build;
  const key = timeKeyOf(`studio:${build}`, time);
  const running = measurements.get(key);
  if (running) {
    return running;
  }
  const measurement = inTurn(async () => {
    if (build !== newestStudioBuild) {
      measurements.delete(key);
      return undefined;
    }
    const sky = await skyOf(pack.id, pack, time);
    if (sky !== undefined) {
      rememberSceneSky(timeKeyOf(studioSkyKey(project), time), build, sky);
    }
    return sky;
  }).catch((error: unknown) => {
    console.error(`Could not measure the colour of "${pack.id}":`, error);
    return undefined;
  });
  measurements.set(key, measurement);
  return measurement;
};
