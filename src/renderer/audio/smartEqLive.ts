/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from 'common/constants';
import { setSmartEq as setSmartEqApi } from '../utils/equalizerApi';
import { gainsOf } from '../utils/smartEqSolve';
import {
  LIVE_STEP_DB,
  heardDistance,
  stepTowardForming,
} from '../utils/smartEqLiveApply';
import { noteSmartEqForming, noteSmartEqWrite } from './songEqSession';

/**
 * Every write Smart correction makes while a measurement runs and lands: the
 * steps of the curve forming, the take's own curve, and the walk between
 * them — the why is in `smartEqLiveApply.ts`.
 *
 * One owner, because the three must not race. Nothing is ever queued: a step
 * is skipped while the last one is still on its way (the next half second
 * carries a newer one, taken from what plays then), and the take's curve is
 * sent at once whatever is in flight, so the order the window sends in is the
 * order the engine hears and the take's curve is always the last word.
 */

type TBuild = (gains: Record<string, number>) => ISmartEqSettings | undefined;

export interface ISmartEqLiveDeps {
  /** What plays now: the layer the window holds. */
  playing: () => ISmartEqSettings | undefined;
  /** Put a layer where the window holds it, which is how the graph draws it. */
  show: (layer: ISmartEqSettings | undefined) => void;
  /**
   * Whether what plays may be walked: under the FluidEQ Engine, which fades
   * every write (Equalizer APO rebuilds its whole chain on each one, with no
   * fade this app can count on, so it keeps hearing the take's curve whole
   * at the end), and not over a song's own kept sound (`isSongSoundLent`).
   */
  canWalk: () => boolean;
  /** The song the curve is forming for, by identity key. */
  songKey: () => string | undefined;
}

export interface ISmartEqLive {
  /**
   * A new forming — a song, a session, a press. A walk still under way ends
   * here and its tap closes: it belonged to a song or a press that is over.
   */
  begin: () => void;
  /**
   * The take ends the forming: what played before the forming first moved
   * it, or undefined when it moved nothing. What a take is described
   * against — the change it made, not the last half-decibel of it.
   */
  endForming: () => { layer: ISmartEqSettings | undefined } | undefined;
  /** One checkpoint of the curve forming: what plays steps toward it. */
  form: (gains: Record<string, number>, build: TBuild) => void;
  /**
   * The take's curve. Sent now when what plays is a step from it or nearer,
   * or when there is no tap to walk on (`tap` absent) or nothing may walk;
   * otherwise walked in on `afterTake`, and `tap` closed once it lands.
   * `landed` runs when the curve itself has been sent and settled.
   */
  land: (
    layer: ISmartEqSettings | undefined,
    build: TBuild,
    landed: () => void,
    tap?: AbortController,
  ) => void;
  /** Whether `tap` is being kept for a walk that has not landed yet. */
  isWalkingOn: (tap: AbortController) => boolean;
  /**
   * Half a second of music after the take, heard on `tap`: one step of the
   * walk on that tap, or the landing. `isLast` is the tap going away by
   * itself, which lands at once. Any other tap's music is not this walk's
   * cadence and moves nothing.
   */
  afterTake: (tap: AbortController, isLast: boolean) => void;
}

interface IWalk {
  layer: ISmartEqSettings | undefined;
  build: TBuild;
  landed: () => void;
  tap: AbortController;
}

export const createSmartEqLive = (deps: ISmartEqLiveDeps): ISmartEqLive => {
  let formed: { layer: ISmartEqSettings | undefined } | undefined;
  let walk: IWalk | undefined;
  let isStepInFlight = false;

  const send = (
    layer: ISmartEqSettings | undefined,
    announce: (layer: ISmartEqSettings | undefined) => void,
  ): Promise<void> => {
    // Announced first, so the song recorder knows the echo for ours.
    announce(layer);
    deps.show(layer);
    return setSmartEqApi(layer).catch(() => {
      // Reported nowhere, like every background Smart EQ write: the next
      // half second, or the take's own curve, writes again.
    });
  };

  const step = (
    layer: ISmartEqSettings | undefined,
    announce: (layer: ISmartEqSettings | undefined) => void,
  ) => {
    isStepInFlight = true;
    send(layer, announce)
      .finally(() => {
        isStepInFlight = false;
      })
      .catch(() => undefined);
  };

  const forming = (layer: ISmartEqSettings | undefined) =>
    noteSmartEqForming(layer, deps.songKey());

  const arrive = (landing: IWalk | Omit<IWalk, 'tap'>) => {
    send(landing.layer, noteSmartEqWrite)
      .finally(() => {
        landing.landed();
        if ('tap' in landing) {
          landing.tap.abort();
        }
      })
      .catch(() => undefined);
  };

  const abandon = () => {
    const left = walk;
    walk = undefined;
    left?.tap.abort();
  };

  return {
    begin: () => {
      abandon();
      formed = undefined;
    },
    endForming: () => {
      const from = formed;
      formed = undefined;
      return from;
    },
    form: (gains, build) => {
      if (walk || isStepInFlight || !deps.canWalk()) {
        return;
      }
      const playing = deps.playing();
      const next = stepTowardForming(playing, gains, build);
      if (!next) {
        return;
      }
      formed ??= { layer: playing };
      step(next.layer, forming);
    },
    land: (layer, build, landed, tap) => {
      // This curve is the answer now; a walk toward an older one is over.
      abandon();
      if (
        !tap ||
        !deps.canWalk() ||
        heardDistance(deps.playing(), layer) <= LIVE_STEP_DB
      ) {
        arrive({ layer, build, landed });
        return;
      }
      walk = { layer, build, landed, tap };
    },
    isWalkingOn: (tap) => walk?.tap === tap,
    afterTake: (tap, isLast) => {
      const current = walk;
      if (current?.tap !== tap) {
        return;
      }
      const playing = deps.playing();
      if (
        isLast ||
        !deps.canWalk() ||
        heardDistance(playing, current.layer) <= LIVE_STEP_DB
      ) {
        walk = undefined;
        arrive(current);
        return;
      }
      if (isStepInFlight) {
        return;
      }
      const next = stepTowardForming(
        playing,
        gainsOf(current.layer),
        current.build,
      );
      if (next) {
        step(next.layer, noteSmartEqWrite);
      } else {
        // Nothing a step could do, which only a curve nearer than a step
        // can mean: the walk is over.
        walk = undefined;
        arrive(current);
      }
    },
  };
};
