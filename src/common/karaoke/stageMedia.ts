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

import {
  isKaraokeAudioFile,
  isKaraokeImageFile,
  isKaraokeVideoFile,
  karaokeFileBaseName,
  karaokeFileDirectory,
  karaokeFileNamesMatch,
} from './fileTypes';

export interface IKaraokeStageMedia {
  cover?: File;
  background?: File;
  video?: File;
}

type TKaraokeStageRole = 'cover' | 'background' | 'video';

/**
 * The role tags UltraStar packs have carried since the 2000s.
 *
 * `Artist - Song [CO].jpg` beside `Artist - Song [BG].jpg` is the commonest
 * layout in a real library, and neither file's base name matches the audio's.
 * Without the tag the picker saw two nameless candidates, gave up on the cover
 * and stretched the square cover art across the widescreen stage as scenery.
 */
const ROLE_MARKERS: Readonly<Record<TKaraokeStageRole, RegExp>> = {
  cover: /\[co(?:#\d+)?\]/i,
  background: /\[bg(?:#\d+)?\]/i,
  video: /\[vd(?:#\d+)?\]/i,
};

/** Art named for the folder rather than the track, whole stem only. */
const CONVENTIONAL_NAMES: Readonly<
  Record<TKaraokeStageRole, readonly string[]>
> = {
  cover: ['cover', 'front', 'folder', 'album', 'album art', 'albumart'],
  background: ['background', 'back', 'bg', 'backdrop'],
  video: ['video'],
};

/** The role a candidate is evidence *against*, within the same media pool. */
const RIVAL_ROLES: Readonly<
  Record<TKaraokeStageRole, readonly TKaraokeStageRole[]>
> = {
  cover: ['background'],
  background: ['cover'],
  video: [],
};

/**
 * How strong each signal is, and why one outranks another.
 *
 * `sameBaseName` is worth most for the cover and the video because that is how
 * a bare MP3 with a picture beside it says so. It is worth almost nothing for
 * the background: a picture named exactly like the song is its cover, and
 * letting an exact match win there put the cover behind the words again.
 */
const SAME_BASE_NAME_SCORE: Readonly<Record<TKaraokeStageRole, number>> = {
  cover: 8,
  background: 1,
  video: 8,
};
const ROLE_MARKER_SCORE = 4;
const CONVENTIONAL_NAME_SCORE = 3;
/** Separates one song's tagged art from another's in a shared folder. */
const NAME_PREFIX_SCORE = 1;
/** Large enough that a rival's tag can never be chosen by accident. */
const RIVAL_ROLE_PENALTY = 8;

const startsWithBase = (base: string, prefix: string): boolean =>
  prefix.length > 0 && (base === prefix || base.startsWith(`${prefix} `));

const roleScore = (
  role: TKaraokeStageRole,
  file: File,
  audioName: string,
): number => {
  const base = karaokeFileBaseName(file.name);
  const rival = RIVAL_ROLES[role].some(
    (other) =>
      ROLE_MARKERS[other].test(file.name) ||
      CONVENTIONAL_NAMES[other].includes(base),
  );
  return (
    (karaokeFileNamesMatch(file.name, audioName)
      ? SAME_BASE_NAME_SCORE[role]
      : 0) +
    (ROLE_MARKERS[role].test(file.name) ? ROLE_MARKER_SCORE : 0) +
    (CONVENTIONAL_NAMES[role].includes(base) ? CONVENTIONAL_NAME_SCORE : 0) +
    (startsWithBase(base, karaokeFileBaseName(audioName))
      ? NAME_PREFIX_SCORE
      : 0) -
    (rival ? RIVAL_ROLE_PENALTY : 0)
  );
};

interface IKaraokeMediaContext {
  audio: File;
  /** Sibling songs, so one song's art is never handed to another. */
  songs: readonly File[];
  /** False when "sibling" means nothing, which is every loose drop. */
  inferable: boolean;
}

/**
 * The song a candidate belongs to, by the longest song name its own name opens
 * with.
 *
 * Longest wins because `Song 2 [CO].jpg` opens with both `song` and `song 2`,
 * and only the second is its owner. Without this, a folder holding `A.mp3`,
 * `A.jpg`, `B.mp3` and `B.jpg` gave A the cover it deserved and then B's cover
 * as its background.
 */
const ownerOf = (file: File, songs: readonly File[]): File | undefined => {
  const base = karaokeFileBaseName(file.name);
  return songs.reduce<File | undefined>((owner, song) => {
    const songBase = karaokeFileBaseName(song.name);
    if (!startsWithBase(base, songBase)) {
      return owner;
    }
    const ownerBase = owner ? karaokeFileBaseName(owner.name) : '';
    return songBase.length > ownerBase.length ? song : owner;
  }, undefined);
};

const pickRole = (
  role: TKaraokeStageRole,
  pool: readonly File[],
  context: IKaraokeMediaContext,
): File | undefined => {
  const candidates = pool.filter((file) => {
    const owner = ownerOf(file, context.songs);
    return !owner || owner === context.audio;
  });
  // An exact base-name match is the only signal that survives an unknown
  // directory, because it names this song rather than merely sitting near it.
  if (!context.inferable) {
    return candidates.find((file) =>
      karaokeFileNamesMatch(file.name, context.audio.name),
    );
  }
  const ranked = candidates
    .map((file) => ({ file, score: roleScore(role, file, context.audio.name) }))
    .sort((left, right) => right.score - left.score);
  if (ranked[0] && ranked[0].score > 0) {
    return ranked[0].file;
  }
  // The last fallback, kept from the original: a folder naming its art after
  // nothing at all still has exactly one picture, and that picture is the
  // cover. Anything scoring below zero has said it is some other role.
  const neutral = ranked.filter((entry) => entry.score >= 0);
  return neutral.length === 1 ? neutral[0].file : undefined;
};

/**
 * The pictures and video that belong to one song.
 *
 * TWO WAYS OF ASKING, IN ORDER. A format that names its own media is believed
 * first — UltraStar writes `#COVER`, `#BACKGROUND` and `#VIDEO`, and a song
 * that says which file it wants should get that file even in a folder holding
 * several. Everything else is inferred from the names in the same directory:
 * the song's own base name, the `[CO]`/`[BG]`/`[VD]` role tags, the
 * conventional `cover.jpg` and `back.jpg`, and finally the sole candidate.
 *
 * No file is ever given two roles. `#COVER:art.jpg` with `#BACKGROUND:art.jpg`
 * used to hand back the same `File` in both, and so did a lone `#BACKGROUND` in
 * a one-picture folder — the player then stretched the cover behind its own
 * words. Each role takes its file out of the pool the next one draws from.
 */
export const selectKaraokeStageMedia = (
  audio: File,
  files: readonly File[],
  named?: {
    coverFileName?: string;
    backgroundFileName?: string;
    videoFileName?: string;
  },
): IKaraokeStageMedia => {
  const directory = karaokeFileDirectory(audio);
  const siblings = files.filter(
    (file) => karaokeFileDirectory(file) === directory,
  );
  const songs = siblings.filter(isKaraokeAudioFile);
  const context: IKaraokeMediaContext = {
    audio,
    songs,
    // A loose drop and a file-dialog selection both report the directory as
    // '', which makes every selected file every song's sibling. Inferring from
    // proximity there handed one song the next song's cover; a missing cover is
    // the honest answer. One song in the pool has no other song to steal from.
    inferable: directory !== '' || songs.length <= 1,
  };
  // Every role writes here and every later role reads it. That is the whole
  // guarantee: one file leaves this function in one role or in none.
  const taken = new Set<File>();
  const claim = (file: File | undefined): File | undefined => {
    if (file) {
      taken.add(file);
    }
    return file;
  };
  const declared = (
    name: string | undefined,
    matches: (file: File) => boolean,
  ): File | undefined => {
    // Compared on the base name alone: the header may write a path with a
    // separator this platform does not use, and the file was imported with a
    // relative path of its own that need not match it character for character.
    const wanted = name?.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
    return wanted
      ? siblings.find(
          (file) =>
            file.name.toLowerCase() === wanted &&
            matches(file) &&
            !taken.has(file),
        )
      : undefined;
  };
  const remaining = (matches: (file: File) => boolean): File[] =>
    siblings.filter((file) => matches(file) && !taken.has(file));

  // Declarations are resolved before anything is inferred, so an inferred
  // cover can never take the file the header reserved for the background.
  const declaredCover = claim(
    declared(named?.coverFileName, isKaraokeImageFile),
  );
  const declaredBackground = claim(
    declared(named?.backgroundFileName, isKaraokeImageFile),
  );
  const declaredVideo = claim(
    declared(named?.videoFileName, isKaraokeVideoFile),
  );

  const cover =
    declaredCover ??
    claim(pickRole('cover', remaining(isKaraokeImageFile), context));
  const background =
    declaredBackground ??
    claim(pickRole('background', remaining(isKaraokeImageFile), context));
  const video =
    declaredVideo ??
    claim(pickRole('video', remaining(isKaraokeVideoFile), context));
  return { cover, background, video };
};
