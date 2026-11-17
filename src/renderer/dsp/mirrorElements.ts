/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { claimDspNativeSource } from './store';

/** Each element's own `muted`, while `useMuteWhileEngaging` holds it down. */
const quietBefore = new WeakMap<HTMLMediaElement, boolean>();

/**
 * The player's media elements while the native host makes the sound: muted
 * from the start, paused once a deck holds the track, and given the sound
 * back — running or not, as the listener wants — when the host lets it go.
 *
 * Muted first and paused second rather than never started, because the
 * element is the fallback: a host that cannot open the file hands the sound
 * back, and an element already holding the bytes takes it back at once.
 */
export interface IMirrorElements {
  /** The host has the track: stop the second decoder. */
  standDown: (positionSeconds: number) => void;
  /**
   * The host has let go: the elements' own sound again, from where the host
   * had got to when that is known.
   */
  handBack: (resume: boolean, positionSeconds?: number) => void;
}

/**
 * `claimSource` is how the player learns a deck has the track before the
 * host's telemetry says so — see `standDown`. The Library's transport store
 * by default; the Karaoke's own clock for the Karaoke, whose deck is not the
 * Library's track and must never read as one in the store the Library's
 * end-of-track and seek bar are built on.
 */
export const muteForMirror = (
  elements: readonly HTMLMediaElement[],
  claimSource: (positionSeconds: number) => void = claimDspNativeSource,
): IMirrorElements => {
  const muted = new Map<HTMLMediaElement, boolean>();
  elements.forEach((element) => {
    // What it was before `useMuteWhileEngaging` silenced it, not that.
    muted.set(element, quietBefore.get(element) ?? element.muted);
    // eslint-disable-next-line no-param-reassign -- the element IS the subject.
    element.muted = true;
  });

  /** Give the element its sound back, at whatever it was before the switch. */
  const unmute = () => {
    elements.forEach((element) => {
      // eslint-disable-next-line no-param-reassign -- the element IS the subject.
      element.muted = muted.get(element) ?? false;
    });
  };

  const stoodDown = new Set<HTMLMediaElement>();

  return {
    /**
     * Called only after a deck has actually loaded and been made heard.
     * Before that the host has nothing, and an element paused early is
     * silence.
     *
     * The `pause` event this raises is ignored by the player while the host
     * owns the transport — see `onPause` — which reads `hasSource` from the
     * store. So the claim goes FIRST, before a single element is paused:
     * between this pause and the host's next telemetry frame the store would
     * still say no source, the event would get through, and `isPlaying` would
     * go false on a track that had just started — disengaging the engine it
     * had just engaged.
     */
    standDown: (positionSeconds) => {
      claimSource(positionSeconds);
      elements.forEach((element) => {
        if (!element.paused) {
          stoodDown.add(element);
          element.pause();
        }
      });
    },

    /**
     * To exactly the elements this took it from, remembered rather than
     * inferred: after a stand-down every deck is paused, so "resume the paused
     * ones" would start the spare holding the previous file as well as the
     * one the listener is on. Unmuted first: unmuted while still paused is a
     * track that looks audible and is not.
     *
     * PRESSING STOP MUST NOT START THE MUSIC, AND IT DID: this used to call
     * `play()` unconditionally, which is right for the host losing a track
     * mid-song and exactly wrong for Stop and Pause — both of which disengage
     * the engine and reach here through the mirror's `release`. So the
     * listener's intent travels with the call; nothing here can work it out.
     *
     * The element was paused where the host took the track over, and the
     * host has played on since. Handed back there, a song resumed minutes
     * behind where the listener left it — which the Library now does each
     * time it lends the host to the Karaoke (`hostLease.ts`). So the host's
     * position goes with the sound, onto the one element holding a file —
     * not the ones stood down, which a track cued while paused never was.
     * Two holding files is a crossfade's overlap, where the position is the
     * incoming track's and the outgoing element is the player's to let go.
     */
    handBack: (resume, positionSeconds) => {
      unmute();
      const holding = elements.filter((element) => element.currentSrc !== '');
      if (positionSeconds !== undefined && holding.length === 1) {
        // eslint-disable-next-line no-param-reassign -- the element IS the subject.
        holding[0].currentTime = positionSeconds;
      }
      if (resume) {
        stoodDown.forEach((element) => {
          if (element.paused) {
            element.play().catch(() => undefined);
          }
        });
      }
      stoodDown.clear();
    },
  };
};

/**
 * Keep the elements quiet from the moment the player's engine starts engaging
 * until it lets go, and give them back exactly as they were.
 *
 * The Library starts its element at a press of Play, and its engine engages
 * when that press takes the host from the Karaoke (`hostLease.ts`). Until the
 * mirror existed the element was the sound — unprocessed, for the second the
 * host used to take to restart, then cut off while the host took the track
 * over. Muted here from the first render that knows the host is coming, the
 * element keeps its clock running and is heard only if the host never comes.
 *
 * Held through the engagement rather than handed to the mirror at the moment
 * it arrives: letting go there would unmute and the mirror re-mute in one
 * commit, and Chromium applies each to the playing element on its own media
 * thread. The mirror reads what the element was before this (`quietBefore`),
 * so whichever of the two gives the sound back gives the same thing back —
 * and a mirror handing a refused track back to the element is heard at once,
 * this having muted it once and not again.
 */
export const useMuteWhileEngaging = (
  elements: readonly HTMLMediaElement[],
  hostComing: boolean,
): void => {
  useEffect(() => {
    if (!hostComing) {
      return undefined;
    }
    const before = elements.map((element) => element.muted);
    elements.forEach((element, index) => {
      quietBefore.set(element, before[index] ?? false);
      // eslint-disable-next-line no-param-reassign -- the element IS the subject.
      element.muted = true;
    });
    return () => {
      elements.forEach((element, index) => {
        quietBefore.delete(element);
        // eslint-disable-next-line no-param-reassign -- the element IS the subject.
        element.muted = before[index] ?? false;
      });
    };
  }, [elements, hostComing]);
};
