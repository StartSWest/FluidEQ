/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ISongIdentity } from './songIdentity';
import { ISongSound, TSavedSound } from './songSound';

/**
 * What Auto EQ's song and album sounds' reducer (`songSoundRecorder.ts`) is
 * written in: its state, what reaches it, and what it asks for. Apart so the
 * rules have a file of their own under the line ceiling, as the Smart EQ
 * memory's vocabulary is (`songEqEvents.ts`).
 */

export type TSongSoundPhase = 'playing' | 'suspended';

/** Whose saved sound a song plays: its own, or its album's. */
export type TSongSoundOwner = 'song' | 'album';

export interface ISongSoundSession {
  identity: ISongIdentity;
  phase: TSongSoundPhase;
  suspendedSince?: number;
  /**
   * The sound it began with, or was put on with — for a song that plays a
   * saved sound, that sound as it plays: an edit is any other, and Back to
   * saved puts it on again.
   */
  baseline?: ISongSound;
  /** The sound from before its own was put on, handed back at its end. */
  handBack?: ISongSound;
  /**
   * Whose saved sound plays — the song's, or its album's — or nothing for a
   * song that plays the listener's own. A change is heard at once and kept
   * for the song only when the listener saves it (Ivan approved, 2026-11-20:
   * "ok with auto eq song save"); a song with no sound of its own plays the
   * listener's ("if a song has it sounds it plays that preset and if not
   * return to the last preset choosed by the user").
   */
  owner?: TSongSoundOwner;
  /**
   * Something other than the listener's hand reached it — a profile loaded or
   * saved, a game's sound, an output switch: nothing is saved for it and
   * nothing lent to it for the rest of this play.
   */
  isLoaded: boolean;
}

/**
 * A hand-back held for the next song: the listener's own sound from before
 * the first saved song, put on as the next song's answer arrives unless that
 * song has a sound of its own.
 */
export interface ISongSoundOwed {
  sound: ISongSound;
  /**
   * The song that just ended, whose saved sound still plays while the
   * hand-back waits: a change made in that moment is that song's working
   * version (`ISongSoundWorking`), never the listener's own.
   */
  from?: { key: string; over: ISongSound };
}

/**
 * A song's working version: what the listener changed its saved sound to
 * (song's own or its album's) and has not saved or taken back (Ivan,
 * 2026-11-26: "two copies of everything ... a SAVED version and a WORKING
 * version"). It plays the next time the song does, shown as changed, with
 * Save changes and Back to saved. Kept for the session only: a change left
 * unsaved overnight is not one to bring back unasked.
 */
export interface ISongSoundWorking {
  /** The saved sound it was made over: a working version over a saved sound
   * changed since (a pick in the Library) is about a sound that is gone. */
  over: ISongSound;
  sound: ISongSound;
}

/**
 * A song's sound still lent on an output the window left (another output's
 * editor opened, the playback output switched): main keeps that output's
 * state, its loan included, and puts it back on the way in. Kept so the
 * window can take the loan up again there — resumed for the same song, or
 * handed back — instead of leaving it held with nobody to end it.
 */
export interface ISongSoundParked {
  /** The listener's own sound the loan keeps. */
  handBack: ISongSound;
  /** The session it was lent to, when one was open. */
  session?: ISongSoundSession;
}

/** Auto EQ's two switches for saved sounds (Smart correction is apart). */
export interface ISongSoundParts {
  songs: boolean;
  albums: boolean;
}

export interface ISongSoundState {
  /** Either part on: songs are looked up at all. */
  isOn: boolean;
  parts: ISongSoundParts;
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
  /** Each song's working version, by its key (`ISongSoundWorking`). */
  working?: Readonly<Record<string, ISongSoundWorking>>;
  /** Outputs left with a song's sound lent, by device id. */
  parked?: Readonly<Record<string, ISongSoundParked>>;
}

/** An album's sound as a lookup answers it: the sound and the album's name. */
export interface IAlbumSoundMatch {
  sound: TSavedSound;
  title: string;
  /** The saved EQ the album's sound is, when it follows one. */
  eqId?: string;
}

export type TSongSoundEvent =
  | { kind: 'tick' }
  | { kind: 'nowPlaying'; identity?: ISongIdentity; isPlaying: boolean }
  | { kind: 'soundChanged'; sound?: ISongSound }
  /**
   * What is kept for a song: its own sound, and its album's. Both come back
   * whatever the switches say; which one plays is the reducer's decision.
   */
  | {
      kind: 'matched';
      identity: ISongIdentity;
      song?: TSavedSound;
      album?: IAlbumSoundMatch;
      /** The answer to a `picked` lookup: it plays, over a change made since. */
      isPick?: boolean;
    }
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
  /** "Save for this song", or "Save changes": what plays is the song's own. */
  | { kind: 'saveNow' }
  /** "Back to saved": the saved sound on again, the changes left. */
  | { kind: 'revert' }
  /**
   * A saved EQ's Put on: the listener's own choice, played as any edit of
   * theirs is — over a saved song's sound it is a change to that sound.
   */
  | { kind: 'putOn'; sound: ISongSound }
  /**
   * What is kept for the playing song changed elsewhere — picked in the
   * Library while it plays: it is looked up again and plays the new answer.
   */
  | { kind: 'reconsider' }
  /**
   * A sound picked, here, for the playing song or its album — the Library's
   * sound menu, Use a saved EQ: it is looked up and its answer plays at once,
   * even over a change the listener made since the song began (Ivan,
   * 2026-11-20: "needs to instantly change the preset to the chosen one").
   */
  | { kind: 'picked' }
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
  | { kind: 'switched'; parts: ISongSoundParts }
  | { kind: 'closing' };

export type TSongSoundEffect =
  | { kind: 'lookup'; identity: ISongIdentity; isPick?: boolean }
  /**
   * Put a sound on: lent while it is a song's own, which keeps it out of the
   * output's profile, and handed back when not, which ends the loan.
   *
   * `asOwn`: the song's sound is the listener's own, so their own goes back
   * on exactly as they left it — a held loan ended, the rack and curve it
   * kept included — and is lent to the song as it is. Nothing is heard to
   * change, and every change made from here is the song's, never theirs.
   */
  | { kind: 'apply'; sound: ISongSound; isLent: boolean; asOwn?: true }
  /**
   * Hand back whatever main still holds lent on this output, with no sound
   * named: a loan parked with an output the window left, met again there.
   */
  | { kind: 'return' }
  /** End the loan with what plays: it is the listener's own from here. */
  | { kind: 'keep' }
  /**
   * An output switch ended the loan. Main carried the listener's own preset
   * to the new output, which brings its own Tone and EQ; the rack goes back
   * with the preset.
   */
  | { kind: 'release' }
  /** File what plays as the song's own: a press, never the song's end. */
  | { kind: 'save'; identity: ISongIdentity; sound: ISongSound }
  /** A saved sound went on: the song's own, or its album's. */
  | {
      kind: 'notice';
      identity: ISongIdentity;
      owner: TSongSoundOwner;
      sound: ISongSound;
      albumTitle?: string;
    }
  | { kind: 'forget'; identity: ISongIdentity };

export const getInitialSongSoundState = (
  parts: ISongSoundParts = { songs: false, albums: false },
): ISongSoundState => ({
  isOn: parts.songs || parts.albums,
  parts,
  deviceId: '',
});
