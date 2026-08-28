/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Driving the native engine, for as long as there are two of them.
 *
 * The TypeScript chain stays in the tree through this migration deliberately.
 * A port is only believable if the two can be compared on the same material,
 * and a comparison that needs a rebuild between the halves is one nobody runs.
 * The parity fixtures hold the native chain to the worklet sample for sample —
 * 2137 of them — but a fixture cannot hear anything, so this is what lets a
 * person switch mid-track and listen.
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
  setDspHostTrackGains: (
    inputGainDb: number,
    masterLoudnessGainDb: number,
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
  setTrackGains: (
    inputGainDb: number,
    masterLoudnessGainDb: number,
  ) => Promise<boolean>;
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
        // Reported by the supervisor as a diagnostic already. Returning false
        // rather than throwing keeps the caller's fallback a branch instead of
        // a catch — the TypeScript chain is still there and still works.
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
      crossfade: (toDeck, durationMs, curveIndex) =>
        bridge.crossfadeDspHost(toDeck, durationMs, curveIndex),
      setTrackGains: (inputGainDb, masterLoudnessGainDb) =>
        bridge.setDspHostTrackGains(inputGainDb, masterLoudnessGainDb),
    },
  };
};
