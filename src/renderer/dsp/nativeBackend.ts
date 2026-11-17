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
import {
  appendPresetTone,
  encodeChainSettings,
  IPresetTone,
} from '../../common/dsp/chainWire';
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
  loadDspHostDeckFor: (
    purpose: THostDeckPurpose,
    mediaPath: string,
    startSeconds: number,
  ) => Promise<number | null>;
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
  supportsDspHostLayers: () => Promise<boolean>;
  loadDspHostLayer: (
    deck: number,
    mediaPath: string | null,
  ) => Promise<boolean>;
  setDspHostDeckGain: (deck: number, gain: number) => Promise<boolean>;
  setDspHostLayerGain: (deck: number, gain: number) => Promise<boolean>;
}

export interface INativeBackendController {
  /** Optional source ownership handshake while the transport is stopped. */
  preparePlayback?: () => Promise<void>;
  finishPlayback?: (stopped?: Promise<unknown>) => Promise<void>;
  /**
   * Told when another player takes the sound from this engine's client, so
   * a paused hold of the rack's placement lets go (`placementLetGo.ts`).
   * Returns the unsubscribe.
   */
  watchLetGo?: (listener: () => void) => () => void;
  /**
   * Bring the engine up and hand it the current chain, in that order.
   *
   * The chain goes before the device on purpose: the first callback should run
   * against the settings the panel is showing rather than against defaults,
   * and a device opened first is a device that has already produced a block by
   * the time the chain arrives.
   *
   * `tone` is the curve the Preset layer plays after the rack, for the
   * Maximizer to limit through (`presetTone.ts`).
   */
  engage: (settings: IDspSettings, tone?: IPresetTone) => Promise<boolean>;
  /**
   * Empty the decks and stop the transport, then release the endpoint and
   * the native process — unless `handOver`, asked once the decks are empty,
   * says the other player is about to engage. The host is then left running
   * with its device open for that player's `engage` (`residentHost`).
   */
  disengage: (handOver?: () => boolean) => Promise<void>;
  /**
   * Push the chain again, for a knob that moved.
   *
   * One push is with the host at a time and at most one more waits behind
   * it, holding the newest settings asked for: a push that has not started
   * yet is replaced, not queued behind. The answer is that of the push which
   * carried these settings or newer ones — true means the host now holds a
   * chain at least as new as the one asked for.
   */
  update: (settings: IDspSettings, tone?: IPresetTone) => Promise<boolean>;
  readonly transport: INativeTransport;
}

/**
 * Why a file goes to the host with the deck left to it: the track about to be
 * faded or cut to, or the next one, to be readied once a deck is free.
 */
export type THostDeckPurpose = 'handoff' | 'spare';

/** What the library player calls once the native backend is the audible one. */
export interface INativeTransport {
  load: (deck: number, mediaPath: string) => Promise<boolean>;
  /**
   * A file onto the deck the host chooses, cued at `startSeconds`.
   *
   * Answers the deck for a `handoff` — the free one, or inside a running fade
   * the quieter one, which only the host can know — and undefined for a
   * `spare`, whose deck is chosen when one is free, or for a file the host
   * could not open.
   */
  loadFor: (
    purpose: THostDeckPurpose,
    mediaPath: string,
    startSeconds: number,
  ) => Promise<number | undefined>;
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
  /**
   * Whether the host plays a deck's LAYER — a second file in lockstep with
   * the deck's own, each at a gain of its own: the Karaoke's backing and its
   * separated voice. False from every host built before layers, which is
   * every host so far (`setDeckGain` in main's `wire.ts` holds the contract).
   */
  supportsLayers: () => Promise<boolean>;
  /** A file layered on `deck`, or the layer taken off (`undefined`). */
  loadLayer: (deck: number, mediaPath: string | undefined) => Promise<boolean>;
  /** The gain of the deck's own file, 0 to 1. */
  setDeckGain: (deck: number, gain: number) => Promise<boolean>;
  /** The gain of the deck's layer, 0 to 1. */
  setLayerGain: (deck: number, gain: number) => Promise<boolean>;
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

/**
 * The host one player let go of for the other, still running with its device
 * open and nothing on its decks, until that player engages it — or the bridge
 * to close it with if nobody does.
 *
 * WHY A SWITCH BETWEEN THE KARAOKE AND THE LIBRARY TOOK A SECOND AND A GAP
 * (Ivan, 2026-11-16): handing the host from one player to the other ran the
 * outgoing player's whole teardown — device closed, process shut down — and
 * the incoming player's whole startup: a new process, its settings replayed,
 * the voice model and the rack built again, the device opened again. Measured
 * in main.log at 17:11:23.581 → 24.665, 1.08 s, for a host that was never
 * meant to go anywhere. The Library's song played out of its own media element,
 * untouched by the rack, for all of that second, and went quiet while the
 * host took it over: the "loads for about a second, then a micro-silence".
 * Closing the device also ended the stream the FluidEQ Engine was processing,
 * so Windows locked its effect afresh when the new one opened.
 *
 * Kept only while the player holding the host wants it (`hostResidency.ts`):
 * a device held open plays silence into the endpoint, which keeps the
 * hardware awake (`stop_device` in the host), so a host nobody comes for is
 * released by `releaseResidentHost` as soon as that is known.
 */
let residentHost: INativeBackendBridge | undefined;

/** Whether a host is waiting, running, for the player about to engage it. */
export const hasResidentHost = (): boolean => residentHost !== undefined;

/**
 * Close a resident host unless `keep` says the player holding it is still
 * coming for it. Queued behind whatever the host is doing, so it is decided
 * after any handover queued before it, and an `engage` queued before it has
 * already taken the host.
 */
export const releaseResidentHost = (keep: () => boolean): Promise<void> =>
  serialize(async () => {
    const bridge = residentHost;
    if (bridge === undefined || keep()) {
      return;
    }
    residentHost = undefined;
    try {
      await bridge.closeDspHostDevice();
    } catch {
      // The process going is what matters; it releases the endpoint too.
    }
    await bridge.stopDspHost();
  });

/** The newest settings asked for, and everyone waiting to hear about them. */
interface IPendingPush {
  settings: IDspSettings;
  tone: IPresetTone | undefined;
  resolve: Array<(applied: boolean) => void>;
  reject: Array<(reason: unknown) => void>;
}

export const createNativeBackendController = (
  bridge: INativeBackendBridge,
): INativeBackendController => {
  let engaged = false;
  /**
   * The push that is queued and has not started. A speaker dragged round the
   * room asks for a push per frame, and preparing a room costs the host 24 ms
   * on a 7.1 stream at 48 kHz and up to 240 ms at 192 kHz: queued one behind
   * another, the sound went on walking the path of a pointer that had been
   * let go seconds earlier. While a push waits, a newer one takes its place;
   * when it starts it is no longer this, and the next update queues afresh —
   * so the last position asked for is always the last one sent, and nothing
   * is decided by a clock.
   */
  let waiting: IPendingPush | undefined;

  const settle = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
    } catch {
      // Disposal is cumulative. A deck already gone must not prevent the
      // endpoint closing or the process itself being terminated.
    }
  };

  // The host's copy only. This used to send the same array to the FluidEQ
  // Engine as well, and the engine then ran it a second time on everything
  // the host played; the store is now the one sender, and it knows when the
  // engine's copy has to stand aside (`rackPlacement.ts`). A rack switched off
  // at the root carries no curve, as the engine's copy does not: nothing
  // limits through it.
  const pushChain = (settings: IDspSettings, tone: IPresetTone | undefined) =>
    bridge.applyDspHostChain(
      settings.enabled
        ? appendPresetTone(encodeChainSettings(settings), tone)
        : encodeChainSettings(settings),
    );

  /**
   * Engage and disengage are barriers: an update asked for after one must
   * not slip into a push queued before it. Letting go of the waiting push
   * here leaves that push where it stands in the queue, with the settings it
   * had, and sends whatever is asked for next to the far side of the barrier.
   */
  const barrier = (): void => {
    waiting = undefined;
  };

  return {
    engage: (settings, tone) => {
      barrier();
      return serialize(async () => {
        // A host left running by the other player is this one's now. Each step
        // below is then a cheap acknowledgement: the process is reused, the
        // chain it already holds is not rebuilt — which would load the voice
        // model and prepare a Room again ahead of the song's load
        // (`chainHeld` in main's supervisor) — and a second START keeps the
        // open device (`start_device` in the host).
        residentHost = undefined;
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
        if (!(await pushChain(settings, tone))) {
          await settle(bridge.stopDspHost);
          return false;
        }
        if (!(await bridge.openDspHostDevice())) {
          await settle(bridge.stopDspHost);
          return false;
        }
        engaged = true;
        return true;
      });
    },

    disengage: (handOver) => {
      barrier();
      return serialize(async () => {
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
        // Asked here, inside the queue, and not when the disengage was asked
        // for: a player lets go in the same commit that hands the host over,
        // and who holds it next is only settled once that commit's effects
        // have all run.
        if (handOver?.() === true) {
          residentHost = bridge;
          return;
        }
        await settle(bridge.closeDspHostDevice);
        // The Library provider now has a short off-tab lease of its own. Once
        // that expires there is no UI or playback left to justify a resident
        // native process, its model, or its decoder allocations.
        await settle(bridge.stopDspHost);
      });
    },

    update: (settings, tone) =>
      new Promise<boolean>((resolve, reject) => {
        if (waiting !== undefined) {
          waiting.settings = settings;
          waiting.tone = tone;
          waiting.resolve.push(resolve);
          waiting.reject.push(reject);
          return;
        }
        const push: IPendingPush = {
          settings,
          tone,
          resolve: [resolve],
          reject: [reject],
        };
        waiting = push;
        serialize(async () => {
          // Started: from here a newer update is a new push behind this one.
          if (waiting === push) {
            waiting = undefined;
          }
          if (!engaged) {
            // Nothing to update, and pushing anyway would start the process
            // the Library has not successfully engaged.
            return false;
          }
          return pushChain(push.settings, push.tone);
        }).then(
          (applied) => push.resolve.forEach((settle_) => settle_(applied)),
          (reason) => push.reject.forEach((settle_) => settle_(reason)),
        );
      }),

    transport: {
      load: (deck, mediaPath) => bridge.loadDspHostDeck(deck, mediaPath),
      loadFor: async (purpose, mediaPath, startSeconds) =>
        (await bridge.loadDspHostDeckFor(purpose, mediaPath, startSeconds)) ??
        undefined,
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
      supportsLayers: () => bridge.supportsDspHostLayers(),
      loadLayer: (deck, mediaPath) =>
        bridge.loadDspHostLayer(deck, mediaPath ?? null),
      setDeckGain: (deck, gain) => bridge.setDspHostDeckGain(deck, gain),
      setLayerGain: (deck, gain) => bridge.setDspHostLayerGain(deck, gain),
    },
  };
};
