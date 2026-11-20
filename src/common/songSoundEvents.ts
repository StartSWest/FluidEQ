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
  /** The sound it began with, or was put on with: an edit is any other. */
  baseline?: ISongSound;
  /** The sound from before its own was put on, handed back at its end. */
  handBack?: ISongSound;
  /**
   * Whose saved sound plays — the song's, or its album's — or nothing for a
   * song that plays the listener's own. A change made while a saved sound
   * plays is the song's and is filed at its end; a change made over the
   * listener's own is theirs, and is filed for the song only when they ask
   * (Ivan, 2026-11-19: "if a song has it sounds it plays that preset and if
   * not return to the last preset choosed by the user").
   */
  owner?: TSongSoundOwner;
  /**
   * Something other than the listener's hand reached it — a profile loaded or
   * saved, a game's sound, an output switch: it files nothing and is lent
   * nothing for the rest of this play.
   */
  isLoaded: boolean;
  /** Not filed this play: forgotten while it plays, or Don't save pressed. */
  isKeptOut: boolean;
}

/**
 * A hand-back held for the next song: the listener's own sound from before
 * the first saved song, put on as the next song's answer arrives unless that
 * song has a sound of its own.
 */
export interface ISongSoundOwed {
  sound: ISongSound;
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
}

/** An album's sound as a lookup answers it: the sound and the album's name. */
export interface IAlbumSoundMatch {
  sound: TSavedSound;
  title: string;
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
  /** Don't file this song this play, whatever it ends with. */
  | { kind: 'dontSave' }
  /** "Save for this song": what plays is the song's own from now. */
  | { kind: 'saveNow' }
  /**
   * What is kept for the playing song changed elsewhere — picked in the
   * Library while it plays: it is looked up again and plays the new answer.
   */
  | { kind: 'reconsider' }
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
  | { kind: 'lookup'; identity: ISongIdentity }
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
  /** File what plays as the song's own; `isPlay` at the song's end. */
  | {
      kind: 'save';
      identity: ISongIdentity;
      sound: ISongSound;
      isPlay: boolean;
    }
  /** A saved sound went on: the song's own, or its album's. */
  | {
      kind: 'notice';
      identity: ISongIdentity;
      owner: TSongSoundOwner;
      sound: ISongSound;
      albumTitle?: string;
    }
  /**
   * The listener put another preset on while a saved sound plays: the song
   * keeps it at its end (Ivan, 2026-10-02: "show a notification this preset
   * will be saved for x current song"). Over the album's sound it is the
   * song's alone — albums change in the Library only.
   */
  | {
      kind: 'willSave';
      identity: ISongIdentity;
      presetId: string;
      owner: TSongSoundOwner;
    }
  | { kind: 'forget'; identity: ISongIdentity };

export const getInitialSongSoundState = (
  parts: ISongSoundParts = { songs: false, albums: false },
): ISongSoundState => ({
  isOn: parts.songs || parts.albums,
  parts,
  deviceId: '',
});
