/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What passes between the core's Library player and the host's decks
 * (`hostDeck.ts`): what the player wants, and what the host's transport
 * answers.
 */
import type { TCrossfadeCurve } from '../../common/dsp/chain';
import type { ICrossfadeShape } from '../../common/dsp/crossfadeShape';

/** Why a file goes to the host with the deck left to it. */
export type THostDeckPurpose = 'handoff' | 'spare';

/** The host's transport, as the supervisor answers it. */
export interface IHostDeckTransport {
  /**
   * A file onto the deck the host chooses, cued at `startSeconds`: the deck
   * for a `handoff`, undefined for a `spare` (readied when a deck is free)
   * or for a file the host could not open.
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
  setCrossfadeTable: (values: readonly number[]) => Promise<boolean>;
  /**
   * Before the transport starts from stopped: where the rack runs is settled
   * then, and the host given its copy (`hostEngine.ts`). Rejects when the
   * host cannot take the track after all.
   */
  preparePlayback: () => Promise<void>;
  /** After the transport stops, with the stop itself when there was one. */
  finishPlayback: (stopped?: Promise<unknown>) => Promise<void>;
}

/** What the player wants of the host. */
export interface IHostDeckWant {
  /** The file on disk, or undefined when nothing is cued. */
  mediaPath: string | undefined;
  isPlaying: boolean;
  /**
   * Where the track starts when nothing was on a deck before it: a restored
   * session, or the host taking over a song already under way.
   */
  positionMs: number;
  /**
   * The track the queue moves to next, and where its music starts.
   *
   * Named to the host, which readies it on its free deck — at once, or when
   * the fade that is running ends — so the handoff finds it decoded and cued.
   * The fade used to start with a cold load, a second or so late on a slow
   * disk, and the outgoing track ran out before its fade-out did and stopped
   * dead (Ivan, 2026-09-22: "micro cuts when changing one file for another").
   */
  upcoming?: { path: string; startPositionMs: number };
  /**
   * The fade to use if the track changes. Absent means cut. State rather than
   * an event: the track change IS the cue, so the two can never race.
   */
  transition?: {
    durationMs: number;
    curve: TCrossfadeCurve;
    shape: ICrossfadeShape;
    /** Cue the incoming deck here before it becomes audible. */
    startPositionMs?: number;
  };
}

export interface IHostDeck {
  /** Record what is wanted and bring the host there. Returns at once. */
  sync: (want: IHostDeckWant) => void;
  /**
   * Move the playhead of the track that plays once the steps ahead of it
   * have run. Settles with whether the host took it; a seek overtaken by a
   * newer one, or by a change of track, settles false unsent.
   */
  seek: (positionMs: number) => Promise<boolean>;
  /** Stop and empty both decks; nothing is asked of the host after it. */
  release: () => void;
}
