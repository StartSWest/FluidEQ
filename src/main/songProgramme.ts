/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Telling the FluidEQ Engine which song is playing.
 *
 * The engine's live leveling hears audio and nothing else, so it could not
 * tell a chorus from the next track: a song turned down for its loud passage
 * went back up for every quiet one after it, and every new stream Windows
 * opened started again from nothing. Windows' media session does know what
 * is playing (`systemMedia.ts`), so the app hands the engine a song identity
 * — and, for a song heard before, the level it measured (`songLevels.ts`) —
 * in `fluideq-programme.txt` beside the rack. The other end is
 * `native/system-apo/src/programme.h`; `leveling_board_test.cpp` pins the text.
 *
 * The identity is a hash of the player, title and artist. The title never
 * reaches a file the audio service can read, and the same recording in two
 * players is two songs, because each player may have levelled it already.
 */

import { createHash } from 'crypto';
import path from 'path';
import type { IEngineHealth } from '../common/engineHealth';
import type { ISongLevel, ISongLevelStore } from './songLevels';
import type { ISystemMediaSnapshot } from './systemMedia';

export const SONG_PROGRAMME_HEADER = '# FluidEQ Engine programme v1';

const CRLF = '\r\n';

type TSongParts = Pick<ISystemMediaSnapshot, 'app' | 'title' | 'artist'>;

/** Sixteen hex digits: what the engine reads as a song, and nothing more. */
export const songIdentity = ({ app, title, artist }: TSongParts): string =>
  createHash('sha1')
    // Joined on a character no player puts in a title or an artist, so two
    // different pairs cannot join into the same text.
    .update(
      [app, title, artist]
        .map((part) => part.trim().toLowerCase())
        .join('\u0000'),
    )
    .digest('hex')
    .slice(0, 16);

/**
 * The file's text. `toFixed` rather than `String` or a locale format: it
 * always writes a point, and the engine reads nothing else.
 */
export const formatSongProgramme = (
  id: string | undefined,
  known: ISongLevel | undefined,
): string =>
  [
    SONG_PROGRAMME_HEADER,
    ...(id ? [`song=${id}`] : []),
    ...(id && known
      ? [
          `level=${known.levelLufs.toFixed(2)}`,
          `peak=${known.peakDb.toFixed(2)}`,
        ]
      : []),
    '',
  ].join(CRLF);

export interface ISongProgrammeDeps {
  store: ISongLevelStore;
  /**
   * The FluidEQ Engine's config directory when it is the engine in use,
   * installed and not mid-switch; undefined otherwise. Asked on every song
   * that has not reached the engine yet, so a switch to the engine is caught
   * by the next media update rather than the next song.
   */
  resolveConfigDir: () => Promise<string | undefined>;
  /** Through the coalescing writer, so the quit reset's seal refuses it. */
  write: (filePath: string, contents: string) => Promise<void>;
  fileName: string;
  /**
   * Make sure the engine's statuses are being watched, so the song this
   * announcement ends is heard when the engine reports it. The window watches
   * them too under the FluidEQ Engine; this does not depend on it.
   */
  watchEngine: () => Promise<unknown>;
}

export interface ISongProgramme {
  /** Every media update. Most say the same song again, and cost nothing. */
  onMedia: (snapshot: ISystemMediaSnapshot | undefined) => Promise<void>;
  /** Every engine status change: remembers the songs leveling finished. */
  onHealth: (health: IEngineHealth) => void;
}

export const createSongProgramme = ({
  store,
  resolveConfigDir,
  write,
  fileName,
  watchEngine,
}: ISongProgrammeDeps): ISongProgramme => {
  // What the engine was last told, and where: undefined until something has
  // been written. A song only counts as told once its write is scheduled.
  let told: { id: string | undefined; filePath: string } | undefined;
  let latest: string | undefined;
  let busy: Promise<void> = Promise.resolve();
  // The seconds each song was last recorded at: a status repeats its song.
  const recorded = new Map<string, number>();

  const tell = async (id: string | undefined): Promise<void> => {
    const configDir = await resolveConfigDir();
    // A newer song arrived while this one was resolving: it is the one to tell.
    if (configDir === undefined || id !== latest) {
      return;
    }
    const filePath = path.join(configDir, fileName);
    if (told && told.id === id && told.filePath === filePath) {
      return;
    }
    told = { id, filePath };
    await write(
      filePath,
      formatSongProgramme(id, id ? store.lookup(id) : undefined),
    );
    await watchEngine();
  };

  return {
    onMedia: (snapshot) => {
      // A player with nothing named is no song; the engine then lets silence
      // decide where one programme ends, the way it did before it knew titles.
      const id = snapshot ? songIdentity(snapshot) : undefined;
      latest = id;
      if (told && told.id === id) {
        return busy;
      }
      // One at a time and in order, so a slow resolve for one song cannot
      // land its file after the next song's.
      busy = busy.then(() => tell(id)).catch(() => undefined);
      return busy;
    },
    onHealth: (health) => {
      health.outputs.forEach(({ lastSong }) => {
        if (!lastSong) {
          return;
        }
        // Every status the engine writes repeats the song it last finished;
        // one song ending is one record, however many outputs report it.
        if (recorded.get(lastSong.id) === lastSong.seconds) {
          return;
        }
        recorded.set(lastSong.id, lastSong.seconds);
        store.record(lastSong);
      });
    },
  };
};
