/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongIdentity } from './songIdentity';
import { ISongSound, ISongSoundEntry } from './songSound';

/**
 * What the song sound memory's reducer (`songSoundRecorder.ts`) is written
 * in: its state, what reaches it, and what it asks for. Apart so the rules
 * have a file of their own under the line ceiling, as the Smart EQ memory's
 * vocabulary is (`songEqEvents.ts`).
 */

export type TSongSoundPhase = 'settling' | 'playing' | 'suspended';

export interface ISongSoundSession {
  identity: ISongIdentity;
  phase: TSongSoundPhase;
  settlingSince: number;
  suspendedSince?: number;
  /** The sound it began with, or was put on with: an edit is any other. */
  baseline?: ISongSound;
  /** The sound from before its own was put on, handed back at its end. */
  handBack?: ISongSound;
  /**
   * Something other than the listener's hand reached it — a profile loaded or
   * saved, a game's sound, an output switch: it files nothing and is lent
   * nothing for the rest of this play.
   */
  isLoaded: boolean;
  /** Not filed this play: forgotten while it plays, or Don't save pressed. */
  isKeptOut: boolean;
}

/** A hand-back held for the next song, and the sound it was held over. */
export interface ISongSoundOwed {
  sound: ISongSound;
  over?: ISongSound;
}

export interface ISongSoundState {
  isOn: boolean;
  deviceId: string;
  /** The sound now, as the window holds it. */
  live?: ISongSound;
  /**
   * A sound asked for and not yet seen live. An edit is never read while one
   * is on its way: half of it landed is not somebody's choice.
   */
  pending?: ISongSound;
  owed?: ISongSoundOwed;
  /** What is playing, so a switch of output can open the song again there. */
  playing?: { identity: ISongIdentity; isPlaying: boolean };
  session?: ISongSoundSession;
}

export type TSongSoundEvent =
  | { kind: 'tick' }
  | { kind: 'nowPlaying'; identity?: ISongIdentity; isPlaying: boolean }
  | { kind: 'soundChanged'; sound?: ISongSound }
  | { kind: 'matched'; identity: ISongIdentity; entry?: ISongSoundEntry }
  /**
   * An `apply` finished: `asked` is the effect's own sound, `landed` what the
   * window plays now, or undefined where the apply failed. What lands need
   * not be what was asked — a saved chain deleted since, a preset Equalizer
   * APO plays without its rack — so a pending sound is settled by this, never
   * only by seeing its twin: one that never arrived would keep every later
   * edit unread.
   */
  | { kind: 'applied'; asked: ISongSound; landed?: ISongSound }
  | { kind: 'undo' }
  /** Don't file this song this play, whatever it ends with. */
  | { kind: 'dontSave' }
  | { kind: 'forget'; identity?: ISongIdentity }
  /**
   * Something else is about to put a sound on — a profile loaded, a game's
   * sound: the song's own comes off first, so what is put on lands on the
   * listener's own sound and not on a song's.
   */
  | { kind: 'yield' }
  /** The sound playing is being saved as a profile: it stays as it is. */
  | { kind: 'keep' }
  | { kind: 'deviceChanged'; deviceId: string }
  | { kind: 'switched'; isOn: boolean }
  | { kind: 'closing' };

export type TSongSoundEffect =
  | { kind: 'lookup'; deviceId: string; identity: ISongIdentity }
  /**
   * Put a sound on: lent while it is a song's own, which keeps it out of the
   * output's profile, and handed back when not, which ends the loan.
   */
  | { kind: 'apply'; sound: ISongSound; isLent: boolean }
  /** End the loan with what plays: it is the listener's own from here. */
  | { kind: 'keep' }
  /**
   * An output switch ended the loan. Main carried the listener's own preset
   * to the new output, which brings its own Tone and EQ; the rack goes back
   * with the preset.
   */
  | { kind: 'release' }
  | {
      kind: 'save';
      deviceId: string;
      identity: ISongIdentity;
      sound: ISongSound;
    }
  | { kind: 'notice'; identity: ISongIdentity; entry: ISongSoundEntry }
  /**
   * The listener put another preset on while a song plays: it will be filed
   * with the song at its end (Ivan, 2026-10-02: "show a notification this
   * preset will be saved for x current song").
   */
  | { kind: 'willSave'; identity: ISongIdentity; presetId: string }
  | { kind: 'forget'; deviceId: string; identity: ISongIdentity };

export const getInitialSongSoundState = (isOn = false): ISongSoundState => ({
  isOn,
  deviceId: '',
});
