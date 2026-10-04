/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every second output, played the fastest way the chosen engine allows.
 *
 * Under the FluidEQ Engine, where it can (`splitRefusal`), the engine plays
 * it straight from the main output's engine: the output is named in the
 * engine's split file and held open in silence so its engine runs
 * (`startNativeOutputHold`), and the delay the window shows counts the reader
 * buffer and that output's complete DSP. Everywhere else — Equalizer APO, an older engine,
 * an output the engine is not on — the helper plays a copy, as it always
 * has. The window cannot tell the two apart: one start, one volume, one
 * stop, one delay, whichever plays it, and a switch of engine moves each
 * second output to the other way without the window doing anything.
 */

import log from 'electron-log';
import type { TOutputDelayCallback } from '../common/outputDelay';
import {
  normaliseEndpointGuid,
  type IEngineHealth,
} from '../common/engineHealth';
import type { IAudioDevice } from '../common/profileTypes';
import {
  readSplitHealth,
  readSplitRefusal,
  splitFileText,
  type ISplitLine,
  type ISplitReaders,
} from './outputSplit';
import type {
  INativeOutputHold,
  INativeOutputMirror,
} from './remoteAudioCapture';

export interface ISecondOutputDeps extends ISplitReaders {
  /** Replaces the engine's split file whole. */
  writeSplit: (text: string) => Promise<void>;
  /** Persist each output's own processing before opening or moving it. */
  syncProfiles?: (outputs: IAudioDevice[]) => Promise<void>;
  startMirror: (
    guid: string,
    volume: number,
    onFailure: () => void,
    onDelay: (milliseconds: number) => void,
  ) => Promise<INativeOutputMirror>;
  startHold: (
    guid: string,
    onFailure: () => void,
  ) => Promise<INativeOutputHold>;
}

export interface ISecondOutputs {
  start: (
    main: IAudioDevice,
    second: IAudioDevice,
    volume: number,
    onFailure: () => void,
    onDelay: TOutputDelayCallback,
  ) => Promise<INativeOutputMirror>;
  /** The chosen engine changed: each second output moves to its way now. */
  reroute: () => Promise<void>;
  /** Keep unaffected native streams while the Windows main output changes. */
  retargetMain: (
    main: IAudioDevice,
    changeOutput: () => Promise<void>,
    afterChange?: () => Promise<void>,
  ) => Promise<void>;
  /** Every change in what the engine says, for the delays it reports. */
  onHealth: (health: IEngineHealth) => void;
}

interface IRoute {
  main: IAudioDevice;
  second: IAudioDevice;
  volume: number;
  onFailure: () => void;
  onDelay: TOutputDelayCallback;
  /** Named in the split file: the engine plays it. */
  engine: boolean;
  held?: INativeOutputHold;
  copy?: INativeOutputMirror;
  closed: boolean;
}

export const createSecondOutputs = (
  deps: ISecondOutputDeps,
): ISecondOutputs => {
  const routes = new Set<IRoute>();
  // Opening, closing and moving run one after another: a stop that overtook
  // its own start would leave a held output nobody owns.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work);
    tail = next.catch(() => undefined);
    return next;
  };
  // Whether the file on disk names anything: an empty one is written once,
  // to take the last line away, and never on a machine that has no use for it.
  let named = false;
  let profiled = '';
  let published: ISplitLine[] = [];
  let rootGuid: string | undefined;
  let publishedText = splitFileText([]);
  const keyOf = ({ from, to }: ISplitLine) =>
    `${from.toLowerCase()}|${to.toLowerCase()}`;
  const sameOutput = (left: IAudioDevice, right: IAudioDevice) =>
    normaliseEndpointGuid(left.guid) === normaliseEndpointGuid(right.guid);
  const membershipOf = (outputs: IAudioDevice[]) =>
    outputs
      .map(({ id }) => id)
      .sort()
      .join('|');
  const writeLines = async (lines: ISplitLine[]) => {
    if (deps.getEngine() !== 'fluid') {
      // The split file is the FluidEQ Engine's alone, and its folder exists
      // only where that engine was chosen: under Equalizer APO the write
      // failed (ENOENT) and took the main output's change down with it, for
      // every listener with a second output. Leaving the engine neutralises
      // its folder, split file included (`engineNeutralise.ts`), so the next
      // write under it starts from nothing on disk.
      published = [];
      publishedText = '';
      named = false;
      return;
    }
    // A main marker protects a former receiver even while no secondaries
    // remain. Older split engines ignore this comment; 1.19 does no ring
    // publication for the marker alone.
    const text =
      (rootGuid ? `# main ${rootGuid.toLowerCase()}\r\n` : '') +
      splitFileText(lines);
    if (text === publishedText) {
      return;
    }
    await deps.writeSplit(text);
    published = lines;
    publishedText = text;
    named = lines.length > 0;
  };

  const publish = async () => {
    const active = [...routes].filter((route) => !route.closed);
    const engineLines = () =>
      [...routes]
        .filter((route) => route.engine && !route.closed)
        .map(({ main, second, volume }) => ({
          from: main.guid,
          to: second.guid,
          volume,
        }));
    // Removal never depends on profile cleanup succeeding. An application
    // may keep the receiver's APO alive after its hold stream is closed.
    const wanted = new Set(engineLines().map(keyOf));
    const retained = published.filter((line) => wanted.has(keyOf(line)));
    if (retained.length !== published.length) {
      await writeLines(retained);
    }
    const membership = active
      .map(({ second }) => second.id)
      .sort()
      .join('|');
    if (membership !== profiled) {
      await deps.syncProfiles?.(active.map(({ second }) => second));
      profiled = membership;
    }
    // Closing can arrive during preparation. Never publish that stale set.
    const currentMembership = [...routes]
      .filter((route) => !route.closed)
      .map(({ second }) => second.id)
      .sort()
      .join('|');
    if (currentMembership !== membership) {
      await publish();
      return;
    }
    const lines = engineLines();
    if (lines.length === 0 && !named) {
      return;
    }
    await writeLines(lines);
  };

  const apply = (health: IEngineHealth) => {
    routes.forEach((route) => {
      if (!route.engine || route.closed) {
        return;
      }
      const reading = readSplitHealth(health, route.main, route.second);
      if (reading.kind === 'playing') {
        route.onDelay(reading.delayMs, 'engine');
        return;
      }
      route.onDelay(0, 'unavailable');
      if (reading.kind === 'refused') {
        // Only this optional receiver stops (`readSplitHealth`).
        failed(route)();
      }
    });
  };

  const release = async (route: IRoute) => {
    const { held, copy } = route;
    route.held = undefined;
    route.copy = undefined;
    route.engine = false;
    await Promise.all([held?.close(), copy?.close()]);
  };

  const failed = (route: IRoute) => () => {
    if (route.closed) {
      return;
    }
    route.closed = true;
    routes.delete(route);
    serial(async () => {
      try {
        await release(route);
      } finally {
        await publish();
      }
    }).catch((error: unknown) =>
      log.error('Could not let go of a failed second output', error),
    );
    route.onFailure();
  };

  /** Why the engine cannot play it, or undefined when it can. */
  const refusal = (route: Pick<IRoute, 'main' | 'second'>) =>
    readSplitRefusal(deps, route.main, route.second);

  const open = async (route: IRoute, why: string | undefined) => {
    if (why !== undefined) {
      log.info(`Second output ${route.second.name} plays a copy: ${why}`);
      await publish();
      route.copy = await deps.startMirror(
        route.second.guid,
        route.volume,
        failed(route),
        route.onDelay,
      );
      return;
    }
    // Named before its engine starts, so it plays from its first block.
    route.engine = true;
    rootGuid = route.main.guid;
    try {
      await publish();
      route.onDelay(0, 'unavailable');
      route.held = await deps.startHold(route.second.guid, failed(route));
    } catch (error) {
      route.engine = false;
      await publish();
      throw error;
    }
    log.info(
      `Second output ${route.second.name} plays straight from the engine`,
    );
    // Already playing says nothing new, so nothing would be pushed.
    deps.readHealth().then(apply, () => undefined);
  };

  return {
    start: async (main, second, volume, onFailure, onDelay) => {
      const route: IRoute = {
        main,
        second,
        volume,
        onFailure,
        onDelay,
        engine: false,
        closed: false,
      };
      routes.add(route);
      try {
        await serial(async () => open(route, await refusal(route)));
      } catch (error) {
        routes.delete(route);
        route.closed = true;
        await serial(publish);
        throw error;
      }
      let closing: Promise<void> | undefined;
      return {
        setVolume: async (value) => {
          route.volume = value;
          if (route.copy) {
            await route.copy.setVolume(value);
          } else if (route.engine) {
            await serial(publish);
          }
        },
        close: () => {
          if (!closing) {
            route.closed = true;
            routes.delete(route);
            closing = serial(async () => {
              try {
                await release(route);
              } finally {
                await publish();
              }
            });
          }
          return closing;
        },
      };
    },
    // One output after another, so the file is written in the order the
    // outputs move and never from two states at once.
    reroute: () =>
      serial(() =>
        [...routes].reduce(async (previous, route) => {
          await previous;
          const why = await refusal(route);
          if (route.closed || (why === undefined) === route.engine) {
            return;
          }
          try {
            try {
              await release(route);
            } finally {
              await publish();
            }
            await open(route, why);
          } catch (error) {
            log.error(
              `Could not move second output ${route.second.name}`,
              error,
            );
            failed(route)();
          }
        }, Promise.resolve()),
      ),
    retargetMain: (main, changeOutput, afterChange) =>
      serial(async () => {
        const active = [...routes].filter((route) => !route.closed);
        if (
          active.length === 0 ||
          active.every((route) => sameOutput(route.main, main))
        ) {
          await changeOutput();
          await afterChange?.();
          return;
        }
        // The UI trades A and selected B. C/D keep their stream, token,
        // settings and graph. A gets its own ordinary start after the trade;
        // no stream without an owning renderer token is created here.
        const swapped = active.some((route) => sameOutput(route.second, main));
        const kept = swapped
          ? active.filter((route) => !sameOutput(route.second, main))
          : [];
        const obsolete = active.filter((route) => !kept.includes(route));
        const previous = active.map((route) => ({
          route,
          main: route.main,
          engine: route.engine,
        }));
        const oldProfiles = active.map((route) => route.second);
        const nextProfiles = kept.map((route) => route.second);
        const previousRoot = rootGuid;
        // Preparation may fail without moving Windows or touching a hold.
        await deps.syncProfiles?.([...nextProfiles, main]);
        const decisions = await Promise.all(
          kept.map(async (route) => ({
            route,
            why: await refusal({ ...route, main }),
          })),
        );
        let switched = false;
        try {
          // Helpers capture a selected Windows stream and must stop before
          // it moves. Native holds remain open; their readers change source
          // at a block boundary and never block the new main output.
          await Promise.all(active.filter((route) => route.copy).map(release));
          await Promise.all(
            decisions
              .filter(({ route, why }) => route.engine && why !== undefined)
              .map(({ route }) => release(route)),
          );
          kept.forEach((route) => {
            route.main = main;
          });
          obsolete.forEach((route) => {
            route.engine = false;
          });
          rootGuid = main.guid;
          // One root replacement, without publish()'s remove-then-add gap.
          // Stop B receiving A before Windows can begin rendering on B.
          await writeLines(
            kept
              .filter((route) => route.engine && !route.closed)
              .map((route) => ({
                from: main.guid,
                to: route.second.guid,
                volume: route.volume,
              })),
          );
          await changeOutput();
          switched = true;
          await afterChange?.();
        } catch (error) {
          if (!switched) {
            rootGuid = previousRoot;
            previous.forEach(({ route, main: before, engine }) => {
              route.main = before;
              route.engine = !route.closed && engine && !!route.held;
            });
            try {
              await deps.syncProfiles?.(oldProfiles);
              profiled = membershipOf(oldProfiles);
              await publish();
            } finally {
              // As the resume after a switch does: an output that cannot be
              // opened again (unplugged meanwhile) is closed and says so,
              // never left listed as playing with nothing behind it, and its
              // failure does not replace the switch's own or stop the rest.
              await previous.reduce(async (before, { route }) => {
                await before;
                if (route.closed || route.held || route.copy) {
                  return;
                }
                try {
                  await open(route, await refusal(route));
                } catch (reopenError) {
                  log.error(
                    `Could not reopen second output ${route.second.name}`,
                    reopenError,
                  );
                  failed(route)();
                }
              }, Promise.resolve());
            }
          }
          throw error;
        } finally {
          if (switched) {
            obsolete.forEach((route) => {
              route.closed = true;
              routes.delete(route);
            });
            try {
              await Promise.all(obsolete.map(release));
              await deps.syncProfiles?.(nextProfiles);
              profiled = membershipOf(nextProfiles);
            } catch (cleanupError) {
              // Windows has already moved: a tidy-up that failed after it is
              // logged, never reported as the switch having failed.
              log.error(
                'Could not tidy the second outputs after the main output moved',
                cleanupError,
              );
            } finally {
              // APO/helper fallback keeps its token and stop-before-switch
              // behavior. A profile cleanup error cannot leave it stopped.
              await decisions.reduce(async (before, { route, why }) => {
                await before;
                if (route.closed || route.held || route.copy) {
                  return;
                }
                try {
                  await open(route, why);
                } catch (error) {
                  log.error(
                    `Could not resume second output ${route.second.name}`,
                    error,
                  );
                  failed(route)();
                }
              }, Promise.resolve());
              kept.forEach((route) => route.onDelay(0, 'unavailable'));
            }
          }
        }
      }),
    onHealth: apply,
  };
};
