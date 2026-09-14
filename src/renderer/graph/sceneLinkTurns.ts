/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';

/**
 * One compile of a scene's program at a time across every worker in the
 * window, so every compile after the first is the GPU process's cached one.
 *
 * The graph, the lamps and the window's tint each have a worker and a WebGL
 * context of their own, and each linked the same scene when it was chosen.
 * The GPU process keeps every linked program in memory for any context that
 * asks for the same source again — a second link of Alpine took 21 ms where
 * the first took nine seconds — but only once the first has finished: two
 * started together both compiled from nothing, side by side, and in a busy
 * window each took twenty-three seconds instead of nine. Nothing survives a
 * restart, so this happens on every launch.
 *
 * The scene the member is looking at takes a turn; the lamps and pictures
 * only wait for turns already taken, so none of them ever holds the graph up.
 */

/** Held only while a turn is taken, so a key's text is not kept past it. */
const turns = new Map<string, Promise<void>>();

/**
 * What makes two packs the same linked program: the uniforms the app declares
 * ahead of the source, which are the pack's parameters, and the source.
 */
export const sceneProgramKey = (pack: IScenePack): string =>
  `${pack.params.map((param) => param.id).join(',')}\n${pack.source}`;

/**
 * Waits for any compile of the same program already under way in the window,
 * then holds the turn until the returned release is called — which must be
 * once the link has finished or been given up, never before.
 */
export const takeLinkTurn = async (key: string): Promise<() => void> => {
  const before = turns.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = before.then(() => mine);
  turns.set(key, chain);
  await before;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    release();
    if (turns.get(key) === chain) {
      turns.delete(key);
    }
  };
};

/** Waits for every turn already taken on this program, without taking one. */
export const afterLinkTurns = (key: string): Promise<void> =>
  turns.get(key) ?? Promise.resolve();
