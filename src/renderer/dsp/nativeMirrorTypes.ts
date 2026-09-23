/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What passes between the library player and the native mirror
 * (`nativeMirror.ts`): the state the player hands over on every render, and
 * the three things it can ask of the mirror.
 */
import { TCrossfadeCurve } from '../../common/dsp/chain';
import { ICrossfadeShape } from '../../common/dsp/crossfadeShape';

/** What the mirror needs from the player, and nothing more. */
export interface INativeMirrorState {
  /** The file on disk, or undefined when nothing is cued. */
  mediaPath: string | undefined;
  isPlaying: boolean;
  positionMs: number;
  /**
   * The track the queue will move to next, and where its music starts.
   *
   * Named to the host, which readies it on its free deck — at once, or when
   * the fade that is running ends — so that the handoff finds it decoded and
   * cued. The fade used to start with a cold load: the host was told the
   * file at the cue point, opened and decoded it, and only then began mixing
   * — a second or so late on a slow disk — so the outgoing track ran out
   * before its fade-out did and stopped dead (Ivan, 2026-09-22: "micro cuts
   * when changing one file for another"). A press on Next lands on the
   * readied deck too, which is what makes it instant.
   */
  upcoming?: { path: string; startPositionMs: number };
  /**
   * The fade to use if the track changes under us. Absent means cut.
   *
   * Handed over as state rather than called as an event, and that is the whole
   * correctness of the handoff. The player used to call a `crossfade` method at
   * the moment it started the element fade — but by then it had already set the
   * new track, React had already re-rendered, and `sync` had already run and
   * cued that track as a CUT on the audible deck. Two mechanisms raced over one
   * handoff and the cut won every time. There is one mechanism now: the track
   * change IS the cue.
   */
  transition?: {
    durationMs: number;
    curve: TCrossfadeCurve;
    shape: ICrossfadeShape;
    /** Cue the incoming deck here before it becomes audible. */
    startPositionMs?: number;
  };
}

export interface INativeMirror {
  /**
   * Record what the player wants the host to be doing, and bring it there.
   *
   * Called on every render. Returns at once: the host is brought in line by
   * one worker, a step at a time, and a call that changed nothing it cares
   * about sends nothing.
   */
  sync: (state: INativeMirrorState) => void;
  /**
   * Move the playhead, because the listener asked — addressed to the deck that
   * is audible once the steps ahead of it have run.
   *
   * The scrubber used to reach the host only by accident: it set the muted
   * element's `currentTime`, and the drift check in `sync` noticed on some
   * later render and forwarded it. That check exists to SUPPRESS seeks — its
   * threshold is half a second — so every drag shorter than that was
   * discarded in silence, and the ones that survived arrived a render late. A
   * command the user gave is not drift and must not be inferred from it.
   *
   * Settles with whether the host took it, once the host has answered: the
   * bar holds the asked-for position until then (`pendingSeek.ts`). A seek
   * overtaken by a newer one, or by a change of track, settles false unsent.
   */
  seek: (positionMs: number) => Promise<boolean>;
  /**
   * Hand the audio back to the element path.
   *
   * `resume` is what the LISTENER wants, and it has to be passed in because
   * the mirror cannot infer it. Handing back happens for two opposite reasons:
   * the DSP switch going off mid-track, where the elements must pick the music
   * up and carry on — and the listener pressing Stop or Pause, where starting
   * them is the bug this parameter exists to prevent (`mirrorElements.ts`).
   */
  release: (resume: boolean) => void;
}
