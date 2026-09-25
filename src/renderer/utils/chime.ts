/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Two short notes, for a switch with nothing on screen to confirm it.
 *
 * Used by the one control that is deliberately invisible: there is no label to
 * light up and no panel to slide in, so the only way to know the press landed
 * is to hear it. Rising for on and falling for off, which is the one convention
 * everybody already knows and needs no explaining — and it means the two are
 * told apart by shape rather than by remembering which pitch meant what.
 *
 * Synthesised rather than shipped as files. Two sine tones is a dozen lines and
 * no asset, no loader and no licence to track; and in an equalizer, generating
 * a tone is hardly foreign ground.
 */

/**
 * Created on first use, shared by every note sounding at once, and closed once
 * the last of them has ended.
 *
 * A context per beep would leak one hardware audio stream per press, and
 * browsers cap how many can exist. Kept for the session, as it was, it held
 * the output stream open and ran its render thread whether or not anything
 * played: one press of a chord nobody repeats kept a live stream on the
 * default output until the window closed. The next press makes another. It is
 * only ever built inside a user gesture, which is what lets it start
 * unsuspended.
 */
let context: AudioContext | undefined;
/** Notes scheduled on `context` whose `ended` has not arrived yet. */
let sounding = 0;

/** Closes `audio` once nothing scheduled on it is left to end. */
const releaseWhenSilent = (audio: AudioContext): void => {
  if (audio !== context || sounding > 0) {
    return;
  }
  context = undefined;
  audio.close().catch(() => undefined);
};

const getContext = (): AudioContext | undefined => {
  if (context) {
    return context;
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) {
      return undefined;
    }
    context = new Ctor();
    return context;
  } catch {
    // No audio output at all — a machine with no device, or a policy that
    // refuses. A switch that works silently is still a switch that works.
    return undefined;
  }
};

/** How loud, at the peak of each note. Deliberately quiet: this is a receipt. */
const PEAK_GAIN = 0.07;

/** How long one note lasts, in seconds. */
const NOTE_SECONDS = 0.09;

/**
 * One note, enveloped.
 *
 * The ramps are not decoration. A sine switched on at full amplitude starts
 * with a step discontinuity, and a step is a click — which on a beep this short
 * is most of what you hear.
 */
const playNote = (
  audio: AudioContext,
  frequency: number,
  startAt: number,
): void => {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, startAt + 0.012);
  gain.gain.linearRampToValueAtTime(0, startAt + NOTE_SECONDS);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + NOTE_SECONDS + 0.02);
  // Counted once its start and stop are scheduled, so a note that threw on
  // the way cannot hold the context open waiting for an `ended` never sent.
  sounding += 1;
  oscillator.addEventListener(
    'ended',
    () => {
      if (audio === context) {
        sounding -= 1;
      }
      releaseWhenSilent(audio);
    },
    { once: true },
  );
};

/** A fifth apart, which reads as an interval rather than as two random pips. */
const RISING: readonly [number, number] = [587.33, 880];
const FALLING: readonly [number, number] = [880, 587.33];

/**
 * Play the two notes. Rising confirms something switched on, falling off.
 *
 * Never throws. This is feedback for a control, and a control that fails
 * because the machine has no sound card is a worse outcome than a silent one.
 */
const playChime = (direction: 'up' | 'down'): void => {
  const audio = getContext();
  if (!audio) {
    return;
  }

  try {
    // Suspended is the normal state for a context built before any gesture, and
    // for one the system has parked. Resuming is a promise nobody needs to wait
    // on: the notes are scheduled against the clock either way.
    if (audio.state === 'suspended') {
      audio.resume().catch(() => undefined);
    }

    const [first, second] = direction === 'up' ? RISING : FALLING;
    const startAt = audio.currentTime + 0.01;
    playNote(audio, first, startAt);
    playNote(audio, second, startAt + NOTE_SECONDS * 0.85);
  } catch {
    // As above — and a context with no note on it would never hear an `ended`
    // to be closed by.
    releaseWhenSilent(audio);
  }
};

export default playChime;
