/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFluidEngineEndpoint, TAudioEngine } from 'common/audioEngine';
import type { IAudioDevice } from 'common/constants';
import {
  normaliseEndpointGuid,
  type IEngineHealth,
  type IEngineOutputHealth,
} from 'common/engineHealth';

/**
 * Whether the FluidEQ Engine is failing somewhere the user can hear it, and
 * how — or undefined when there is nothing to say.
 *
 * - `off`: sound was heard on an output the engine is attached to, and the
 *   engine is not what it went through. Either Windows never ran it there,
 *   or it runs there cut off from FluidEQ and so applies nothing. Only sound
 *   can tell this from an output that is simply quiet: Windows runs the
 *   engine only while something plays, so "not running" on its own is the
 *   ordinary state of every output nobody is listening to.
 * - `problems`: the engine is running an output without part of what it was
 *   asked for — a convolution file it could not load, a rack it could not
 *   start. That needs no sound: the engine says so the moment it happens,
 *   which is usually the moment the change that caused it is made.
 *
 * Nothing at all under Equalizer APO, which says nothing about itself.
 */
export type TEngineTrouble =
  | {
      kind: 'off';
      device: IAudioDevice;
      key: string;
      /**
       * Windows has never created the engine here — on the whole machine,
       * as the setup helper reports it, or on this output, which the engine
       * has never written a status for — so this is not an engine that
       * stopped. Restarting Windows audio cannot mend that, and the notice
       * must not offer it as though it could; the slot ladder is asked
       * instead (`useRepairWhenEngineNeverRan`).
       */
      neverRan?: boolean;
      /**
       * Windows created the engine here and plays this output through a
       * chain it is not in: it is locked, it says it is processing, and no
       * sound has ever reached it (`IEngineOutputHealth.carried`).
       *
       * The state every other reading calls healthy. An output has several
       * effect slots and Windows builds a different chain for each kind of
       * stream, so an engine sitting in the wrong one for the music is
       * created, asked for nothing, and passed over — which is a user with
       * an EQ that does nothing and an app insisting it works. Neither a
       * restart nor a re-install moves it; another slot might, and that is
       * what the card offers.
       */
      bypassed?: boolean;
    }
  | {
      kind: 'problems';
      device: IAudioDevice;
      problems: string[];
      /** Whether restarting Windows audio, which restarts the engine, can help. */
      canRestartHelp: boolean;
      /**
       * Whether Equalizer APO would do what is missing. False when every
       * problem is the engine's own DSP — a rack, a linear-phase design —
       * which APO does not have: offering it there trades a working EQ for
       * nothing.
       */
      canApoHelp: boolean;
      /**
       * Whether putting this app's own engine in place would mend it —
       * see `ONLY_A_NEW_ENGINE`. Restarting Windows audio starts the same
       * engine again, so the card leads with this one instead.
       */
      canInstallHelp: boolean;
      /**
       * The engine beside this app is not the one installed, by the
       * comparison of their contents that the update notice already makes.
       * Then the offer above is not a guess and the card says so.
       */
      updateReady: boolean;
      key: string;
    };

export interface IEngineTroubleFacts {
  engine: TAudioEngine | null;
  /** For names, which output is the default, and which can host effects. */
  devices: readonly IAudioDevice[];
  /**
   * Which outputs the engine is on, as its setup helper last said — the
   * authority on that (`registry.ts`), and already re-read by every action
   * that changes it, so hearing sound never has to list the devices again.
   */
  fluidEndpoints: readonly IFluidEngineEndpoint[];
  /**
   * The installed engine writes a status for every output it runs
   * (`engineReportsStatus`). Only then does a missing one mean anything.
   */
  reportsStatus: boolean;
  health: IEngineHealth;
  /**
   * The output sound was heard on, since the capture hearing it started —
   * undefined until it has heard any. Read together with a `health` read
   * after the sound began: see `useEngineTrouble`.
   */
  heardGuid: string | undefined;
  /** What the helper says about the engine ever having run here. */
  hasEverRun?: boolean;
  /**
   * The installed engine says whether sound has reached it
   * (`engineReportsCarried`). Only then does `carried` being false mean no
   * audio has come, rather than an engine that never says.
   */
  reportsCarried?: boolean;
  /**
   * This app carries an engine the machine does not have installed, as the
   * update notice's own comparison by content says. It is the usual reason
   * a rack will not start.
   */
  engineUpdateReady?: boolean;
}

/**
 * What a restart cannot mend: a file the engine could not load, a curve it
 * could not build. A restart reads them again and fails the same way; the
 * rest are the engine's own state, which a restart starts over.
 */
const CONTENT_PROBLEMS: readonly string[] = [
  'convolution',
  'graphic-eq',
  'eq-phase',
];

/**
 * What Equalizer APO has no equivalent of, so switching to it mends nothing:
 * the DSP rack runs only in the FluidEQ Engine, and a linear-phase EQ it
 * could not design leaves the ordinary filters running, which APO would run
 * the same way. The card used to offer APO under "the DSP effects are off"
 * — an offer to give up the EQ that was working for an engine that has no
 * DSP at all.
 */
const NOT_IN_APO: readonly string[] = ['dsp-rack', 'eq-phase'];

/**
 * What only a fresh engine mends: the rack.
 *
 * The rack is the one part of the engine the app talks to over a wire both
 * sides have to agree on, so an engine older than the app cannot start it —
 * and on a machine where setup left an older or half-installed engine, the
 * EQ still worked while every DSP effect was silently off. Restarting
 * Windows audio starts the same engine again and fails the same way, which
 * is what a user hit: the restart the card offered changed nothing, and
 * what mended it was putting this app's own engine in place from the help
 * page. So the card offers that, and leads with it.
 */
const ONLY_A_NEW_ENGINE: readonly string[] = ['dsp-rack'];

export const sameEndpoint = (a: string, b: string) =>
  normaliseEndpointGuid(a) === normaliseEndpointGuid(b);

export const engineTrouble = ({
  engine,
  devices,
  fluidEndpoints,
  reportsStatus,
  health,
  heardGuid,
  hasEverRun,
  reportsCarried,
  engineUpdateReady,
}: IEngineTroubleFacts): TEngineTrouble | undefined => {
  if (engine !== 'fluid') {
    return undefined;
  }
  const deviceOf = (guid: string) =>
    devices.find((device) => sameEndpoint(device.guid, guid));
  const statusOf = (guid: string) =>
    health.outputs.find((output) => sameEndpoint(output.endpoint, guid));
  const isAttached = (guid: string) =>
    fluidEndpoints.some(
      (endpoint) => endpoint.attached && sameEndpoint(endpoint.guid, guid),
    );

  // An engine from before status files is running every output it is on
  // without ever saying so, and was reported as off on all of them.
  if (heardGuid !== undefined && reportsStatus) {
    const device = deviceOf(heardGuid);
    const status = statusOf(heardGuid);
    // Attached, and able to host effects at all: an output the engine was
    // never put on has its own notice, and one Windows runs no effects on
    // has another. Neither is the engine failing.
    //
    // An output whose "Audio enhancements" are switched off is the same kind
    // of thing and worse to get wrong: Windows loads nothing there, so this
    // card would offer to restart Windows audio — which changes nothing — as
    // often as sound was heard. The output panel says what the switch is.
    // Locked, owned, and no sound has ever reached it: Windows plays this
    // output through a chain the engine is not in. Only from an engine that
    // counts what reaches it, and only once sound has been heard here — the
    // status read that made this trouble was started after that sound, so
    // "none has come" is about the music the listener is hearing now.
    const bypassed =
      reportsCarried === true &&
      status?.locked === true &&
      status.owner &&
      status.carried === false;
    if (
      device !== undefined &&
      isAttached(device.guid) &&
      device.canHostEffects !== false &&
      device.effectsEnabled !== false &&
      (bypassed || !status?.locked || !status.owner)
    ) {
      // Never created: on the whole machine, as the helper reports it, or on
      // this output — an output the engine has never written a status for
      // is one Windows has never built it on, and the read this trouble is
      // made from started after the sound was heard there. A restart cannot
      // help either way; the slot ladder can.
      // An engine Windows is playing around is not one that never ran: it
      // ran, it is running, and the music is going somewhere else.
      const neverRan =
        !bypassed && (hasEverRun === false || status === undefined);
      let state = '';
      if (bypassed) {
        state = ':bypassed';
      } else if (neverRan) {
        state = ':never';
      }
      return {
        kind: 'off',
        device,
        // In the key, so the card speaks again if this ever changes from one
        // to the other: they say different things and offer different
        // buttons, and the second is not the one that was put away.
        key: `off${state}:${normaliseEndpointGuid(device.guid)}`,
        ...(neverRan ? { neverRan } : {}),
        ...(bypassed ? { bypassed: true } : {}),
      };
    }
  }

  const troubled = health.outputs.filter(
    (output) => output.locked && output.owner && output.problems.length > 0,
  );
  // The output being listened to first: it is the one whose sound is wrong
  // right now. Then any other, such as a second output mirrored to.
  const listened = (output: IEngineOutputHealth) =>
    deviceOf(output.endpoint)?.isDefault === true ? 0 : 1;
  const [first] = [...troubled]
    .filter((output) => deviceOf(output.endpoint) !== undefined)
    .sort((a, b) => listened(a) - listened(b));
  const device = first && deviceOf(first.endpoint);
  if (!first || !device) {
    return undefined;
  }
  const canInstallHelp = first.problems.some((code) =>
    ONLY_A_NEW_ENGINE.includes(code),
  );
  return {
    kind: 'problems',
    device,
    problems: first.problems,
    canRestartHelp: first.problems.some(
      (code) => !CONTENT_PROBLEMS.includes(code),
    ),
    // Never beside the offer of a fresh engine: moving to Equalizer APO
    // there gives up the whole rack for certain, while the action above it
    // is the one thing that can bring the rack back. An offer of strictly
    // less than the recommendation is a fourth button for nothing — and the
    // four of them spill onto a second line in French and Russian.
    canApoHelp:
      !canInstallHelp &&
      first.problems.some((code) => !NOT_IN_APO.includes(code)),
    canInstallHelp,
    updateReady: engineUpdateReady === true,
    key: `problems:${first.endpoint}:${first.problems.join(',')}`,
  };
};
