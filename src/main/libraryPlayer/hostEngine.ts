/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library player's native host, run by the core: brought up while there
 * is a song for it, handed its rack before its device, followed to a new
 * output, and its two decks driven by `hostDeck.ts`.
 *
 * The window did all of this while the player lived there, and the rules
 * travelled with it:
 *
 * - The chain goes before the device: the first callback runs against the
 *   rack the page shows, never against defaults.
 * - The host follows having a song, not playing one. A pause is a loaded deck
 *   told to pause; tearing the host down on every pause spawned and killed
 *   processes and once played the same file twice a few milliseconds apart.
 * - One push of the rack is with the host at a time and at most one more
 *   waits behind it, holding the newest rack asked for: a speaker dragged
 *   round the room asks for a push per frame, and queued one behind another
 *   the sound went on walking a path the pointer had long left.
 * - A host that will not start is not asked again on every change; the
 *   player plays on the window's element instead, unprocessed and saying so.
 */
import log from 'electron-log';
import {
  encodeNoiseProfile,
  type INoiseProfile,
} from '../../common/dsp/noiseProfile';
import { DECK_EMPTY, DECK_ENDED } from '../../common/dsp/deckState';
import createHostDeck from './hostDeck';
import type {
  IHostDeck,
  IHostDeckTransport,
  IHostDeckWant,
} from './hostDeckTypes';

/** What the core's host module offers: the supervisor, behind main's rules. */
export interface IHostPort {
  /** Start the process (raw sharing and the voice model restored); true once ready. */
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
  applyChain: (values: readonly number[]) => Promise<boolean>;
  openDevice: () => Promise<boolean>;
  closeDevice: () => Promise<boolean>;
  setVolume: (volume: number) => Promise<boolean>;
  setTrackGains: (
    inputGainDb: number,
    masterGainDb: number,
  ) => Promise<boolean>;
  setNoiseProfile: (values: readonly number[] | undefined) => Promise<boolean>;
  transport: Omit<IHostDeckTransport, 'preparePlayback' | 'finishPlayback'>;
  /** Every telemetry frame the host sends; answers how to stop listening. */
  onTelemetry: (listener: (frame: IHostClockFrame) => void) => () => void;
}

/** The part of a telemetry frame the player reads. */
export interface IHostClockFrame {
  deviceGeneration: number;
  activeDeck: number;
  deckState: number;
  deckPositionSeconds: number;
  deckDurationSeconds: number;
}

/** The host's clock, as the player reads it. */
export interface IHostClock {
  /** A deck holds a track, so its position is the real one. */
  hasSource: boolean;
  positionMs: number;
  /** Zero when the decoder could not say, which is legal. */
  durationMs: number;
  ended: boolean;
  activeDeck: number;
}

export type THostEngineState = 'idle' | 'engaging' | 'engaged' | 'failed';

export interface IHostEngineEvents {
  onState: (state: THostEngineState) => void;
  onClock: (clock: IHostClock) => void;
  onOwnership: (hostOwns: boolean) => void;
  onRefused: (mediaPath: string, resume: boolean) => void;
  /** The file the host plays from now; see `hostDeck.ts`. */
  onActive: (mediaPath: string | undefined) => void;
  /** Called before the transport starts from stopped; see `hostDeck.ts`. */
  preparePlayback: () => Promise<void>;
  finishPlayback: (stopped?: Promise<unknown>) => Promise<void>;
  /**
   * The deck was rebuilt round a new output, so it is empty: the player
   * answers what to cue again, and where.
   */
  wantAfterReopen: () => IHostDeckWant;
}

export interface IHostEngine {
  /** Bring the host up (true) or down (false); a repeated wish does nothing. */
  setEngaged: (engaged: boolean) => void;
  readonly state: () => THostEngineState;
  /** What the decks should be doing; ignored until the host is engaged. */
  sync: (want: IHostDeckWant) => void;
  seek: (positionMs: number) => Promise<boolean>;
  /** The rack the host should run now; pushed while it is engaged. */
  pushChain: (values: readonly number[]) => Promise<boolean>;
  setTrackGains: (inputGainDb: number, masterGainDb: number) => void;
  setNoiseProfile: (profile: INoiseProfile | undefined) => void;
  close: () => Promise<void>;
}

/** The newest rack asked for, and everyone waiting to hear about it. */
interface IPendingPush {
  values: readonly number[];
  settle: Array<(applied: boolean) => void>;
}

export const createHostEngine = (
  port: IHostPort,
  events: IHostEngineEvents,
): IHostEngine => {
  let state: THostEngineState = 'idle';
  let wantEngaged = false;
  let deck: IHostDeck | undefined;
  let lastWant: IHostDeckWant | undefined;
  let chain: readonly number[] | undefined;
  let deviceGeneration: number | undefined;
  let stopTelemetry: (() => void) | undefined;
  let waiting: IPendingPush | undefined;
  /** Every host command in order: one process, one queue. */
  let hostWork: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    // Both arms, so one command that throws does not wedge the rest.
    const next = hostWork.then(work, work);
    hostWork = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const setState = (next: THostEngineState) => {
    if (next !== state) {
      state = next;
      events.onState(next);
    }
  };

  const transport: IHostDeckTransport = {
    ...port.transport,
    preparePlayback: () => events.preparePlayback(),
    finishPlayback: (stopped) => events.finishPlayback(stopped),
  };

  const buildDeck = () => {
    deck?.release();
    deck = createHostDeck(transport, {
      onOwnership: events.onOwnership,
      onRefused: events.onRefused,
      onActive: events.onActive,
    });
    // Full level, said once: the computer's fader is the only one there is.
    port.setVolume(1).catch(() => undefined);
  };

  const readClock = (frame: IHostClockFrame) => {
    if (deviceGeneration === undefined) {
      deviceGeneration = frame.deviceGeneration;
    } else if (frame.deviceGeneration !== deviceGeneration) {
      /**
       * A reopen — following the default output to new headphones, or a
       * device that came back — rebuilds the host's player with no decks.
       * The endpoint is right and every deck empty, so the song stopped while
       * the change of output was handled; only this side knows what was
       * playing and where, so the deck is rebuilt and the song cued again.
       */
      deviceGeneration = frame.deviceGeneration;
      if (state === 'engaged') {
        buildDeck();
        deck?.sync(events.wantAfterReopen());
      }
    }
    events.onClock({
      hasSource: frame.deckState !== DECK_EMPTY,
      positionMs: frame.deckPositionSeconds * 1_000,
      durationMs: frame.deckDurationSeconds * 1_000,
      ended: frame.deckState === DECK_ENDED,
      activeDeck: frame.activeDeck,
    });
  };

  const engage = () =>
    serialize(async () => {
      if (!wantEngaged || state === 'engaged') {
        return;
      }
      setState('engaging');
      try {
        if (!(await port.start())) {
          throw new Error('The Library player could not start.');
        }
        if (chain === undefined || !(await port.applyChain(chain))) {
          throw new Error('The Library player refused its rack.');
        }
        if (!(await port.openDevice())) {
          throw new Error('The Library player could not open its output.');
        }
      } catch (error) {
        // The supervisor has reported why already; this keeps a host that
        // cannot start from being asked again on every change.
        log.warn('Library player host not engaged', error);
        await port.stop().catch(() => undefined);
        setState(wantEngaged ? 'failed' : 'idle');
        return;
      }
      if (!wantEngaged) {
        await port.stop().catch(() => undefined);
        setState('idle');
        return;
      }
      deviceGeneration = undefined;
      stopTelemetry = port.onTelemetry(readClock);
      buildDeck();
      setState('engaged');
      if (lastWant) {
        deck?.sync(lastWant);
      }
    });

  const disengage = () =>
    serialize(async () => {
      waiting = undefined;
      if (state !== 'engaged') {
        setState('idle');
        return;
      }
      stopTelemetry?.();
      stopTelemetry = undefined;
      deck?.release();
      deck = undefined;
      setState('idle');
      // Both decks are emptied before the device closes: a deck still holding
      // a track is a decoder still reading a file for nobody.
      await port.transport.unload(0).catch(() => undefined);
      await port.transport.unload(1).catch(() => undefined);
      await port.transport.pause().catch(() => undefined);
      await port.closeDevice().catch(() => undefined);
      // No song to play means no reason for a resident process, its model
      // or its decoders.
      await port.stop().catch(() => undefined);
    });

  return {
    setEngaged: (engaged) => {
      if (engaged === wantEngaged) {
        return;
      }
      wantEngaged = engaged;
      if (engaged) {
        engage().catch(() => undefined);
      } else {
        disengage().catch(() => undefined);
      }
    },

    state: () => state,

    sync: (want) => {
      lastWant = want;
      deck?.sync(want);
    },

    seek: (positionMs) => deck?.seek(positionMs) ?? Promise.resolve(false),

    pushChain: (values) => {
      chain = values;
      return new Promise<boolean>((resolve) => {
        if (waiting !== undefined) {
          waiting.values = values;
          waiting.settle.push(resolve);
          return;
        }
        const push: IPendingPush = { values, settle: [resolve] };
        waiting = push;
        serialize(async () => {
          // Started: from here a newer rack is a new push behind this one.
          if (waiting === push) {
            waiting = undefined;
          }
          // Not engaged, the rack waits for the engage that pushes it first.
          return state === 'engaged' ? port.applyChain(push.values) : false;
        })
          .catch(() => false)
          .then((applied) => push.settle.forEach((settle) => settle(applied)))
          .catch(() => undefined);
      });
    },

    setTrackGains: (inputGainDb, masterGainDb) => {
      if (state === 'engaged') {
        port.setTrackGains(inputGainDb, masterGainDb).catch(() => undefined);
      }
    },

    setNoiseProfile: (profile) => {
      if (state === 'engaged') {
        port
          .setNoiseProfile(profile ? encodeNoiseProfile(profile) : undefined)
          .catch(() => undefined);
      }
    },

    close: async () => {
      wantEngaged = false;
      await disengage();
    },
  };
};
