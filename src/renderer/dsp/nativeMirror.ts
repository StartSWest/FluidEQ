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
 * The crossfade is mirrored too, and it is the one place where "shadow the
 * element" is not enough. The player's overlap runs two muted elements while
 * the native side has its own two decks, so a handoff that only synced
 * `mediaPath` reloaded the single deck in use and cut — the native engine had
 * no crossfade at all, on an engine whose crossfader was written and tested.
 * `crossfade` below is what the player calls instead, and it drives the decks
 * the way the elements are being driven beside it.
 */
import { TCrossfadeCurve, CROSSFADE_CURVES } from '../../common/dsp/chain';
import {
  crossfadeShapeTable,
  ICrossfadeShape,
} from '../../common/dsp/crossfadeShape';
import { INativeBackendController } from './nativeBackend';

/** What the mirror needs from the player, and nothing more. */
export interface INativeMirrorState {
  /** The file on disk, or undefined when nothing is cued. */
  mediaPath: string | undefined;
  isPlaying: boolean;
  positionMs: number;
  /**
   * The listener's fader, 0 to 1.
   *
   * Belongs here for the same reason muting does: it is a property of the
   * element that the host has to take over while the element is silent. Without
   * it the fader moved and the sound did not change — the control was simply
   * not connected to the engine making the noise.
   */
  volume: number;
  /**
   * The fade to use if the track changes under us. Absent means cut.
   *
   * Handed over as state rather than called as an event, and that is the whole
   * correctness of the handoff. The player used to call a `crossfade` method at
   * the moment it started the element fade — but by then it had already set the
   * new track, React had already re-rendered, and `sync` had already run and
   * cued that track as a CUT on the audible deck. The fade then found the file
   * it was asked to fade to already loaded and declined as a no-op. Two
   * mechanisms raced over one handoff and the cut won every time.
   *
   * There is one mechanism now. `mediaPath` changes at exactly the moment the
   * incoming element starts playing, which is exactly when the fade should
   * begin, so the track change IS the cue.
   */
  transition?: {
    durationMs: number;
    curve: TCrossfadeCurve;
    shape: ICrossfadeShape;
  };
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
  /**
   * Which deck is audible. Not always zero, once a crossfade has happened.
   *
   * Every load, seek and unload below is addressed to this rather than to a
   * literal 0 — that constant was correct only while the second deck was
   * unused, and it would have quietly sent the next track's seek to the deck
   * that had just faded out.
   */
  let activeDeck = 0;
  /**
   * The last volume the host was told, so a tick that changed nothing is silent.
   *
   * Starts at a value no fader can hold, so the first sync always sends one:
   * the host defaults to unity and the element may not be there, and a mirror
   * that only spoke up on a CHANGE would leave that mismatch until the listener
   * happened to touch the control.
   */
  let toldVolume = -1;
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
    if (!(await controller.transport.load(activeDeck, mediaPath))) {
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
    await controller.transport.select(activeDeck);
    // The switch can be flipped mid-track. Starting at zero would restart the
    // song, which is the most obvious possible bug.
    if (positionMs > SEEK_THRESHOLD_MS) {
      await controller.transport.seek(activeDeck, positionMs / 1000);
    }
    if (isPlaying) {
      await controller.transport.play();
      playing = true;
    }
  };

  /**
   * Fade to the incoming track on the other deck.
   *
   * Internal, and reached only from `sync`. It used to be a method the player
   * called at the moment it started the element fade, which lost a race it
   * could not win: by then the track had already changed, `sync` had already
   * run, and the file had already been cued as a cut on the audible deck.
   *
   * `loadedPath` and `activeDeck` are claimed by the caller BEFORE this is
   * awaited, so a position tick landing mid-handoff sees no track change and
   * leaves it alone. `previousPath` is what to put back if the load fails.
   */
  const handoff = async (
    incomingPath: string,
    durationMs: number,
    curve: TCrossfadeCurve,
    shape: ICrossfadeShape,
    previousPath: string,
  ): Promise<boolean> => {
    const previousDeck = activeDeck;
    const toDeck = activeDeck === 0 ? 1 : 0;
    activeDeck = toDeck;
    toldPositionMs = 0;
    toldAt = performance.now();

    if (!(await controller.transport.load(toDeck, incomingPath))) {
      // A file the native decoder cannot read. Put the claim back rather than
      // leaving the mirror pointing at a deck holding nothing, and let the
      // element fade — which is already running — carry the handoff.
      loadedPath = previousPath;
      activeDeck = previousDeck;
      unmute();
      return false;
    }

    if (curve === 'custom') {
      // Before the fade rather than with it: the host keeps a pending table and
      // promotes it at the start of a fade, so this has to land first or the
      // shape arrives one track change late.
      await controller.transport.setCrossfadeTable([
        ...crossfadeShapeTable(shape, false),
        ...crossfadeShapeTable(shape, true),
      ]);
    }

    const index = CROSSFADE_CURVES.indexOf(curve);
    await controller.transport.crossfade(
      toDeck,
      durationMs,
      // A curve the host does not know is equal power, which is the default the
      // panel offers, rather than whatever index -1 lands on.
      index >= 0 ? index : 0,
    );
    return true;
  };

  return {
    sync: ({ mediaPath, isPlaying, positionMs, volume, transition }) => {
      // Before the track checks below, because a track change returns early and
      // the fader must still reach the host on the tick that changed it.
      if (volume !== toldVolume) {
        toldVolume = volume;
        controller.transport.setVolume(volume).catch(() => undefined);
      }

      if (mediaPath !== loadedPath) {
        const previous = loadedPath;
        loadedPath = mediaPath;
        // Both halves, always together: a position without the moment it was
        // read is a reading the next tick cannot use, and it would compute an
        // elapsed time reaching back to the previous track.
        toldPositionMs = positionMs;
        toldAt = performance.now();
        if (!mediaPath) {
          controller.transport.unload(activeDeck).catch(() => undefined);
          return;
        }

        /**
         * A handoff, not a cue: one track replacing another while playing.
         *
         * This is the branch the player used to try to reach by calling a
         * separate method, and always lost the race to. Everything needed to
         * tell a handoff from a cue is already here — there WAS a track, there
         * IS a new one, the transport is playing, and a fade is configured —
         * so the decision belongs on this side rather than in a second caller
         * arriving afterwards to find the work already done wrongly.
         *
         * `previous` is captured before the claim above overwrote it.
         */
        if (previous !== undefined && isPlaying && transition) {
          handoff(
            mediaPath,
            transition.durationMs,
            transition.curve,
            transition.shape,
            previous,
          ).catch(() => undefined);
          return;
        }

        /**
         * A new track starts at its beginning. The position arriving with it
         * belongs to the track it replaced.
         *
         * `mediaPath` and `positionMs` reach this function from two different
         * sources — the queue and the element's own clock — and on the tick
         * that changes the track they disagree: the path is already the new
         * song and the position is still the old one's. Handed to `cue`, that
         * loaded the incoming track and then seeked it to where the outgoing
         * one had been. Reported exactly: play A, play B, seek B to the middle,
         * go back to A, and A begins in the middle while the seek bar reads
         * zero — the bar is the element, which really is at zero, and the
         * sound is this deck, which was told to be somewhere else.
         *
         * `previous` settles it without trusting the number. Undefined means
         * nothing was loaded and the engine is being switched on underneath a
         * song already playing, which is the case the threshold below exists
         * for and the one time the incoming position is real. Anything else is
         * a track change, and a track change starts at zero.
         */
        cue(
          mediaPath,
          isPlaying,
          previous === undefined ? positionMs : 0,
        ).catch(() => undefined);
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
        controller.transport
          .seek(activeDeck, positionMs / 1000)
          .catch(() => undefined);
      }
    },

    release: () => {
      unmute();
      loadedPath = undefined;
      playing = false;
      controller.transport.pause().catch(() => undefined);
      // Both decks, because a crossfade leaves the previous track loaded on the
      // other one and an unload of only the active deck would leave a whole
      // decoded read-ahead buffer alive for a track nobody is playing.
      controller.transport.unload(0).catch(() => undefined);
      controller.transport.unload(1).catch(() => undefined);
      activeDeck = 0;
    },
  };
};
