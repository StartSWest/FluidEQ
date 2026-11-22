/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The questions about one artist rather than about a list: the head of their
 * page, and which names in an artist line open a page at all. Both read the
 * credits the store files every song under (`track_credits`) and the Artists
 * shelf's own summaries, off their indexes; nothing is kept here.
 */

import type { DatabaseSync } from 'node:sqlite';
import {
  artistLinkParts,
  type IArtistLinkPart,
} from '../../common/library/artistCredits';
import type { ILibraryArtistFacts } from '../../common/library/query';
import type { TStoreRow } from './libraryStoreRows';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export interface ILibraryArtistQuestions {
  readonly facts: (id: string) => ILibraryArtistFacts | null;
  readonly links: (lines: readonly string[]) => IArtistLinkPart[][];
}

/**
 * Credits first, then the song: `on_album` puts a credit for the record
 * ahead of a guest spot, so a page is named and pictured from the artist's
 * own records where they have any.
 */
const CREDITED = `FROM track_credits c JOIN tracks t ON t.id = c.track_id
  WHERE c.credit_key = $id`;

export const createArtistQuestions = (
  database: DatabaseSync,
): ILibraryArtistQuestions => {
  const factsStatement = database.prepare(
    `SELECT
       (SELECT list_title FROM artist_groups WHERE id = $id) AS group_name,
       (SELECT art_id FROM artist_groups WHERE id = $id) AS group_art,
       (SELECT c.credit_name ${CREDITED}
          ORDER BY c.on_album DESC, t.seq LIMIT 1) AS credit_name,
       (SELECT t.art_id ${CREDITED} AND t.art_id IS NOT NULL
          ORDER BY c.on_album DESC, t.seq LIMIT 1) AS credit_art,
       (SELECT COUNT(DISTINCT t.album_key) ${CREDITED}
          AND c.on_album = 1) AS album_count,
       (SELECT COUNT(*) FROM track_credits c
          WHERE c.credit_key = $id) AS track_count,
       (SELECT COALESCE(SUM(t.duration_ms), 0) ${CREDITED}) AS duration_ms`,
  );
  const knownStatement = database.prepare(
    'SELECT 1 AS known FROM artist_groups WHERE id = ?',
  );

  const facts = (id: string): ILibraryArtistFacts | null => {
    const row = factsStatement.get({ $id: id }) as TStoreRow | undefined;
    const trackCount = Number(row?.track_count ?? 0);
    if (row === undefined || trackCount === 0) {
      return null;
    }
    const artId = text(row.group_art) || text(row.credit_art);
    return {
      name: text(row.group_name) || text(row.credit_name),
      ...(artId === '' ? {} : { artId }),
      albumCount: Number(row.album_count ?? 0),
      trackCount,
      durationMs: Number(row.duration_ms ?? 0),
    };
  };

  /**
   * "Known" is an artist the Artists shelf lists — somebody with a record
   * of their own here — which is what tells a duo's name from two people
   * (`artistLinkParts`). Asked once per name a batch meets.
   */
  const links = (lines: readonly string[]): IArtistLinkPart[][] => {
    const known = new Map<string, boolean>();
    const isKnown = (id: string): boolean => {
      const held = known.get(id);
      if (held !== undefined) {
        return held;
      }
      const answer = knownStatement.get(id) !== undefined;
      known.set(id, answer);
      return answer;
    };
    return lines.map((line) => artistLinkParts(line, isKnown));
  };

  return { facts, links };
};
