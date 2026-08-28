/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The native engine shadowing the player, rather than replacing it.
 *
 * The obvious way to make the C++ path audible is to rip `<audio>` out of the
 * library player. It is also the wrong way, twice over.
 *
 * Wrong for the A/B, first: two paths that differ in their queue handling, their
 * position reporting and their gapless logic are not a comparison of two DSP
 * engines. Everything except the audio has to stay identical or the difference
 * being listened for is buried under a dozen others.
 *
 * And wrong for the risk: `LibraryPlayerContext` is two thousand lines of
 * transport, restore, crossfade and queue behaviour earned one bug at a time.
 * Rewriting it to prove a DSP port is a large change to code that is not what
 * is being ported.
 *
 * So the element keeps every job it has — timing, events, position, queue,
 * end-of-track — and is muted. The native host is told the same file, the same
 * position and the same play state, and it makes the sound. Flipping the switch
 * changes which of two engines is audible and nothing else at all.
 *
 * What this deliberately does NOT mirror is the crossfade. The player's overlap
 * runs two elements at once and the native side has its own two decks; driving
 * both from here would be two crossfades fighting over one handoff. Deck zero
 * is the only one used until the player's own handoff can hand over a deck.
 */
import { INativeBackendController } from './nativeBackend';

/** What the mirror needs from the player, and nothing more. */
export interface INativeMirrorState {
  /** The file on disk, or undefined when nothing is cued. */
  mediaPath: string | undefined;
  isPlaying: boolean;
  positionMs: number;
}

export interface INativeMirror {
  /**
   * Bring the host in line with the player's state.
   *
   * Idempotent: called on every position tick, and does nothing unless
   * something it cares about actually moved.
   */
  sync: (state: INativeMirrorState) => void;
  /** Hand the audio back to the element path. */
  release: () => void;
}

/**
 * How far the host may drift from the element before it is a seek.
 *
 * The element reports position four times a second and the host runs on its
 * own clock, so they are never exactly equal. Half a second is well past any
 * ordinary drift and well inside the smallest jump a person makes on a
 * scrubber — anything tighter turns steady playback into a seek every tick,
 * which empties the read-ahead ring and stutters.
 */
const SEEK_THRESHOLD_MS = 500;

export const createNativeMirror = (
  controller: INativeBackendController,
  elements: readonly HTMLMediaElement[],
): INativeMirror => {
  /**
   * The element is muted, not paused.
   *
   * Pausing it would stop the clock the whole player reads: position, the
   * end-of-track event, the crossfade's cue point and the queue's advance all
   * hang off it. Muted, every one of those keeps working and only the sound is
   * gone — which is exactly the substitution being made.
   */
  const muted = new Map<HTMLMediaElement, boolean>();
  elements.forEach((element) => {
    muted.set(element, element.muted);
    // eslint-disable-next-line no-param-reassign -- the element IS the subject.
    element.muted = true;
  });

  let loadedPath: string | undefined;
  let playing = false;
  /** What the host was last told, so a tick that changed nothing sends nothing. */
  let toldPositionMs = 0;
  /**
   * When that reading was taken, which is what makes the next one meaningful.
   *
   * Without it, "drift" was the gap between two syncs rather than the gap
   * between two clocks — so a render that arrived half a second late looked
   * exactly like a listener dragging the scrubber, and the answer to that is a
   * seek. A seek empties the read-ahead ring, which is a hole in the audio.
   *
   * Under load the renders get further apart, so it seeks more often, so it
   * drops out more: the stutter fed itself, and it was worst on exactly the
   * machine that could least afford it.
   */
  let toldAt = 0;

  /** Give the element its sound back, at whatever it was before the switch. */
  const unmute = () => {
    elements.forEach((element) => {
      // eslint-disable-next-line no-param-reassign -- the element IS the subject.
      element.muted = muted.get(element) ?? false;
    });
  };

  /**
   * Load a file into deck zero and take it to where the element already is.
   *
   * One `async` rather than a chain, because the steps are ordered and a
   * `.then` inside a `.then` reads as though they might not be.
   */
  const cue = async (
    mediaPath: string,
    isPlaying: boolean,
    positionMs: number,
  ): Promise<void> => {
    if (!(await controller.transport.load(0, mediaPath))) {
      /**
       * A format the native decoder cannot read.
       *
       * Every container the library accepts opens on Windows: WAV and AIFF
       * are parsed here, MP3, FLAC and Ogg Vorbis by vendored decoders, and
       * the MP4 family, WMA and Opus by Media Foundation. So this path is now
       * for a corrupt file, or for a platform whose own decoder has not been
       * written yet — macOS and Linux, today.
       *
       * It stays either way. A native engine that went silent on a file it
       * could not read would be worse than one that hands the sound back.
       *
       * The element is still playing it, muted. Sitting in silence while
       * claiming to be the native engine is the worst of the three options;
       * handing the sound back is the honest one.
       */
      unmute();
      return;
    }
    await controller.transport.select(0);
    // The switch can be flipped mid-track. Starting at zero would restart the
    // song, which is the most obvious possible bug.
    if (positionMs > SEEK_THRESHOLD_MS) {
      await controller.transport.seek(0, positionMs / 1000);
    }
    if (isPlaying) {
      await controller.transport.play();
      playing = true;
    }
  };

  return {
    sync: ({ mediaPath, isPlaying, positionMs }) => {
      if (mediaPath !== loadedPath) {
        loadedPath = mediaPath;
        // Both halves, always together: a position without the moment it was
        // read is a reading the next tick cannot use, and it would compute an
        // elapsed time reaching back to the previous track.
        toldPositionMs = positionMs;
        toldAt = performance.now();
        if (!mediaPath) {
          controller.transport.unload(0).catch(() => undefined);
          return;
        }
        cue(mediaPath, isPlaying, positionMs).catch(() => undefined);
        return;
      }

      if (isPlaying !== playing) {
        playing = isPlaying;
        const command = isPlaying
          ? controller.transport.play()
          : controller.transport.pause();
        command.catch(() => undefined);
      }

      /**
       * A jump the listener made, not the time this tick took to arrive.
       *
       * Compared against where the element SHOULD be by now — the last reading
       * plus the wall time since it, while playing — rather than against the
       * last reading itself. The difference is the whole bug: measured the
       * second way, every render that came half a second late was
       * indistinguishable from a drag of the scrubber, and each one cost a
       * seek and the read-ahead ring with it.
       */
      const now = performance.now();
      const elapsed = playing && toldAt > 0 ? now - toldAt : 0;
      const expected = toldPositionMs + elapsed;
      toldPositionMs = positionMs;
      toldAt = now;
      if (Math.abs(positionMs - expected) > SEEK_THRESHOLD_MS) {
        controller.transport.seek(0, positionMs / 1000).catch(() => undefined);
      }
    },

    release: () => {
      unmute();
      loadedPath = undefined;
      playing = false;
      controller.transport.pause().catch(() => undefined);
      controller.transport.unload(0).catch(() => undefined);
    },
  };
};
