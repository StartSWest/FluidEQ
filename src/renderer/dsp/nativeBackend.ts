/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Driving the engine, which is now the only one there is.
 *
 * The TypeScript chain stayed beside it through the migration so the two could
 * be compared on the same material. Its final 2,085 reference fixtures are now
 * frozen in the native test corpus, and the TypeScript processors are gone.
 *
 * Everything here is a plain function over an injected surface rather than a
 * hook, for one reason: it is testable that way. The hook that uses it owns the
 * lifecycle; this has the command ordering that matters.
 */
import { IDspSettings } from '../../common/dsp/chain';
import { encodeChainSettings } from '../../common/dsp/chainWire';
import {
  encodeNoiseProfile,
  INoiseProfile,
} from '../../common/dsp/noiseProfile';

/**
 * The half of the preload bridge this needs.
 *
 * Narrowed to what is actually called, so a test supplies six functions rather
 * than a whole `window.electron`, and so that adding a bridge method somewhere
 * else cannot silently become a dependency of this file.
 */
export interface INativeBackendBridge {
  startDspHost: () => Promise<{ state: string }>;
  stopDspHost: () => Promise<{ state: string }>;
  openDspHostDevice: () => Promise<boolean>;
  closeDspHostDevice: () => Promise<boolean>;
  applyDspHostChain: (values: readonly number[]) => Promise<boolean>;
  loadDspHostDeck: (deck: number, mediaPath: string) => Promise<boolean>;
  playDspHost: () => Promise<boolean>;
  pauseDspHost: () => Promise<boolean>;
  seekDspHostDeck: (deck: number, seconds: number) => Promise<boolean>;
  selectDspHostDeck: (deck: number) => Promise<boolean>;
  unloadDspHostDeck: (deck: number) => Promise<boolean>;
  crossfadeDspHost: (
    toDeck: number,
    durationMs: number,
    curveIndex: number,
  ) => Promise<boolean>;
  setDspHostCrossfadeTable: (values: readonly number[]) => Promise<boolean>;
  setDspHostTrackGains: (
    inputGainDb: number,
    masterLoudnessGainDb: number,
  ) => Promise<boolean>;
  setDspHostVolume: (volume: number) => Promise<boolean>;
  setDspHostNoiseProfile: (
    values: readonly number[] | null,
  ) => Promise<boolean>;
}

export interface INativeBackendController {
  /**
   * Bring the engine up and hand it the current chain, in that order.
   *
   * The chain goes before the device on purpose: the first callback should run
   * against the settings the panel is showing rather than against defaults,
   * and a device opened first is a device that has already produced a block by
   * the time the chain arrives.
   */
  engage: (
    settings: IDspSettings,
    outputSafetyEnabled: boolean,
  ) => Promise<boolean>;
  /** Release the endpoint, decoder decks, and native process. */
  disengage: () => Promise<void>;
  /** Push the chain again, for a knob that moved. */
  update: (
    settings: IDspSettings,
    outputSafetyEnabled: boolean,
  ) => Promise<boolean>;
  readonly transport: INativeTransport;
}

/** What the library player calls once the native backend is the audible one. */
export interface INativeTransport {
  load: (deck: number, mediaPath: string) => Promise<boolean>;
  unload: (deck: number) => Promise<boolean>;
  play: () => Promise<boolean>;
  pause: () => Promise<boolean>;
  seek: (deck: number, seconds: number) => Promise<boolean>;
  select: (deck: number) => Promise<boolean>;
  crossfade: (
    toDeck: number,
    durationMs: number,
    curveIndex: number,
  ) => Promise<boolean>;
  /**
   * The dragged shape, as the table the mixer reads per sample.
   *
   * Sent before the fade that uses it, never during one: the host promotes a
   * pending table only when no fade is running, so a shape that arrives mid
   * fade belongs to the next one.
   */
  setCrossfadeTable: (values: readonly number[]) => Promise<boolean>;
  setTrackGains: (
    inputGainDb: number,
    masterLoudnessGainDb: number,
  ) => Promise<boolean>;
  /**
   * The measured noise floor for this track, or undefined to clear it.
   *
   * Sits beside `setTrackGains` because it is the same kind of value: it comes
   * from the analysis pass rather than from a control, and it belongs to one
   * track. Clearing it on a track with no scan matters — a profile left over
   * from the previous song subtracts that recording's hiss from this one.
   */
  setNoiseProfile: (profile: INoiseProfile | undefined) => Promise<boolean>;
  /**
   * The listener volume, 0 to 1.
   *
   * Part of the transport rather than the chain: it is the player fader, not a
   * DSP setting, and it belongs to the same object that owns play and seek.
   */
  setVolume: (volume: number) => Promise<boolean>;
}

/**
 * One host, one queue — across every controller, not within one.
 *
 * `startDspHost` and `stopDspHost` reach a single supervisor owned by main, so
 * two controllers overlapping are not two engines: they are two callers
 * commanding one, and the loser's teardown lands inside the winner's startup.
 * Measured, from the app's own lifecycle trace, on an ordinary track change:
 *
 *   25.421  start-requested     <- the incoming controller
 *   25.423  start-reused           the outgoing one's process, handed over
 *   25.482  device-close-requested <- the outgoing controller's disengage
 *   25.487  device-open-requested  <- the incoming one's engage
 *   25.516  stop-requested      <- the outgoing one, killing the shared host
 *   25.526  device-open-complete   state=stopped
 *
 * The open still acked — from a process already shutting down — so `engage`
 * returned true and the panel read ON. Every band, every stage and every
 * preset then did nothing, and nothing on screen said so.
 *
 * Module scope because the RESOURCE is module scope. A queue held per
 * controller would order each one against itself, which was never the problem.
 */
let hostWork: Promise<unknown> = Promise.resolve();

const serialize = <T>(work: () => Promise<T>): Promise<T> => {
  // Both arms, so one command that throws does not wedge every command after
  // it: the queue is an ordering guarantee, not an error channel.
  const next = hostWork.then(work, work);
  hostWork = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

export const createNativeBackendController = (
  bridge: INativeBackendBridge,
): INativeBackendController => {
  let engaged = false;

  const settle = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
    } catch {
      // Disposal is cumulative. A deck already gone must not prevent the
      // endpoint closing or the process itself being terminated.
    }
  };

  const pushChain = (settings: IDspSettings, outputSafetyEnabled: boolean) =>
    bridge.applyDspHostChain(
      encodeChainSettings(settings, { outputSafetyEnabled }),
    );

  return {
    engage: (settings, outputSafetyEnabled) =>
      serialize(async () => {
        const status = await bridge.startDspHost();
        if (status.state !== 'ready') {
          /**
           * Reported by the supervisor as a diagnostic already, so this says no
           * rather than throwing — the caller turns it into the notice the user
           * sees. There is nothing to fall back to: a host that will not start
           * means the audio plays unprocessed, and saying so is the whole point
           * of returning a value instead of an exception nobody would catch.
           */
          return false;
        }
        if (!(await pushChain(settings, outputSafetyEnabled))) {
          await settle(bridge.stopDspHost);
          return false;
        }
        if (!(await bridge.openDspHostDevice())) {
          await settle(bridge.stopDspHost);
          return false;
        }
        engaged = true;
        return true;
      }),

    disengage: () =>
      serialize(async () => {
        if (!engaged) {
          return;
        }
        engaged = false;
        /**
         * Both decks are emptied before the device closes.
         *
         * A deck still holding a track is a decoder thread still reading a file
         * and two seconds of audio still in a ring, for a backend nobody is
         * listening to. Switching back and forth a few times without this leaves
         * one of each behind every time.
         */
        await settle(() => bridge.unloadDspHostDeck(0));
        await settle(() => bridge.unloadDspHostDeck(1));
        await settle(bridge.pauseDspHost);
        await settle(bridge.closeDspHostDevice);
        // The Library provider now has a short off-tab lease of its own. Once
        // that expires there is no UI or playback left to justify a resident
        // native process, its model, or its decoder allocations.
        await settle(bridge.stopDspHost);
      }),

    update: (settings, outputSafetyEnabled) =>
      serialize(async () => {
        if (!engaged) {
          // Nothing to update, and pushing anyway would start the process the
          // Library has not successfully engaged.
          return false;
        }
        return pushChain(settings, outputSafetyEnabled);
      }),

    transport: {
      load: (deck, mediaPath) => bridge.loadDspHostDeck(deck, mediaPath),
      unload: (deck) => bridge.unloadDspHostDeck(deck),
      play: () => bridge.playDspHost(),
      pause: () => bridge.pauseDspHost(),
      seek: (deck, seconds) => bridge.seekDspHostDeck(deck, seconds),
      select: (deck) => bridge.selectDspHostDeck(deck),
      setVolume: (volume) => bridge.setDspHostVolume(volume),
      crossfade: (toDeck, durationMs, curveIndex) =>
        bridge.crossfadeDspHost(toDeck, durationMs, curveIndex),
      setCrossfadeTable: (values) => bridge.setDspHostCrossfadeTable(values),
      setTrackGains: (inputGainDb, masterLoudnessGainDb) =>
        bridge.setDspHostTrackGains(inputGainDb, masterLoudnessGainDb),
      setNoiseProfile: (profile) =>
        bridge.setDspHostNoiseProfile(
          profile ? encodeNoiseProfile(profile) : null,
        ),
    },
  };
};
