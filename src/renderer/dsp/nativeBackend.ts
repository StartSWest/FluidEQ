/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Driving the engine, which is now the only one there is.
 *
 * The TypeScript chain was kept beside it through the migration so the two
 * could be compared on the same material, and having been compared — 2137
 * parity fixtures, and the same samples on real music — it no longer processes
 * anything. Those modules survive purely as the reference the fixtures are
 * generated from.
 *
 * Everything here is a plain function over an injected surface rather than a
 * hook, for one reason: it is testable that way. The hook that uses it is four
 * lines and has nothing in it worth testing; this has the ordering that does.
 */
import { IDspSettings } from '../../common/dsp/chain';
import { encodeChainSettings } from '../../common/dsp/chainWire';

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
  /**
   * Release the endpoint but leave the process up.
   *
   * Opening an endpoint is what wakes a DAC — its noise floor becomes audible
   * — so idle means closed. The process staying up is what makes switching
   * back cost nothing, and a supervised process that is not holding a device
   * costs a few megabytes and no power.
   */
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
   * The listener volume, 0 to 1.
   *
   * Part of the transport rather than the chain: it is the player fader, not a
   * DSP setting, and it belongs to the same object that owns play and seek.
   */
  setVolume: (volume: number) => Promise<boolean>;
}

export const createNativeBackendController = (
  bridge: INativeBackendBridge,
): INativeBackendController => {
  let engaged = false;

  const pushChain = (settings: IDspSettings, outputSafetyEnabled: boolean) =>
    bridge.applyDspHostChain(
      encodeChainSettings(settings, { outputSafetyEnabled }),
    );

  return {
    engage: async (settings, outputSafetyEnabled) => {
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
        return false;
      }
      if (!(await bridge.openDspHostDevice())) {
        return false;
      }
      engaged = true;
      return true;
    },

    disengage: async () => {
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
      await bridge.unloadDspHostDeck(0);
      await bridge.unloadDspHostDeck(1);
      await bridge.pauseDspHost();
      await bridge.closeDspHostDevice();
    },

    update: async (settings, outputSafetyEnabled) => {
      if (!engaged) {
        // Nothing to update, and pushing anyway would start the process the
        // switch just turned off.
        return false;
      }
      return pushChain(settings, outputSafetyEnabled);
    },

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
    },
  };
};
