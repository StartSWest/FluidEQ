/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A SONG IS ON AN ALBUM ONCE, HOWEVER MANY FILES OF IT THERE ARE.
 *
 * Ivan's "Why?" by Jacob Whitesides is fourteen files in its own folder, and
 * two of them again in "!MY MUSIC", a folder of thirty-four songs from
 * twenty-four records (2026-11-26). All sixteen carry the album's tags, so the
 * album listed Focus and Heartbeat twice, and Play started on the copy in
 * "!MY MUSIC" — it sorts first, having been learned first — which is where
 * the folder tree then put the playing mark, true to the file and wrong for
 * the album. The scan read every file right; what was missing is that the
 * second file of a song is a copy, not another song on the record.
 *
 * A COPY is a song the album already has: the same disc, number and title,
 * of the same kind and the same length to the millisecond — the same
 * recording, whatever its tags or cover added to the file. Not to within a
 * second: on Ivan's library a watermark stands in for the title of whole
 * albums ("EJE RECORDS [53639408]", sixteen songs of one chart under it,
 * none numbered), and a second's slack made Selena Gomez's "Rare" a copy of
 * her "Look At Her Now". To the millisecond it finds 453 copies on 132 of
 * his albums: 382 byte for byte the file they copy, 71 the same audio
 * re-tagged — and none of them a different song. Of the files of
 * one song, the one in the folder that is most the album's stands for it —
 * the larger share of what the folder holds, then more of the album, then
 * the one learned first — and every other file of it is marked `album_copy`.
 * A share and not a count: with the record's own Focus gone, "!MY MUSIC"
 * held as many of the album's files as its folder did, and a count let its
 * Heartbeat take the record's place. An album's songs, its count, its length
 * and its folders are then its own songs alone (`scopeConditions`, the
 * album summaries in `libraryGroups.ts`); a copy stays a song of its folder,
 * its artist and the Songs shelf, because the file is there.
 *
 * Only a tagged album has copies: the songs with no album tag share one key
 * per artist (4,596 of them under no artist at all on Ivan's library), which
 * is a bucket and not a record. Its keys are never read here at all: reading
 * that one bucket's rows was most of the cost of re-marking a scan batch of
 * "!MY MUSIC" (20 of 50 ms). A song can only carry a mark into a bucket by
 * being written, and every write clears its mark (`TRACK_UPSERT`).
 */

import type { DatabaseSync } from 'node:sqlite';
import { ALBUM_KEY_SEPARATOR } from '../../common/library/grouping';

/** Re-marks the copies on the albums named, from their members as they are. */
const markAlbumCopies = (
  database: DatabaseSync,
  albumKeys: ReadonlySet<string>,
): void => {
  // A key with no album before its separator is a bucket (`albumKey`).
  const records = [...albumKeys].filter(
    (key) => !key.startsWith(ALBUM_KEY_SEPARATOR),
  );
  if (records.length === 0) {
    return;
  }
  const keys = JSON.stringify(records);
  database
    .prepare(
      `UPDATE tracks SET album_copy = 0
       WHERE album_copy <> 0 AND album_key IN (SELECT value FROM json_each(?))`,
    )
    .run(keys);
  database
    .prepare(
      `UPDATE tracks SET album_copy = 1
      WHERE album_key IN (SELECT value FROM json_each($keys)) AND id IN (
        WITH held AS MATERIALIZED (
          SELECT album_key, folder, COUNT(*) AS held FROM tracks
          WHERE album_key IN (SELECT value FROM json_each($keys))
          GROUP BY album_key, folder
        ),
        homes AS MATERIALIZED (
          SELECT h.album_key, h.folder, h.held,
            (SELECT COUNT(*) FROM tracks x WHERE x.folder = h.folder) AS size
          FROM held h
        ),
        files AS MATERIALIZED (
          SELECT t.id, t.seq, t.album_key, t.kind, t.fold_title,
            COALESCE(t.disc_no, 1) AS disc, COALESCE(t.track_no, 0) AS number,
            t.duration_ms, h.held, h.size
          FROM tracks t
          JOIN homes h ON h.album_key = t.album_key AND h.folder = t.folder
          WHERE t.album_key IN (SELECT value FROM json_each($keys))
            AND t.duration_ms IS NOT NULL
        )
        SELECT f.id FROM files f
        WHERE EXISTS (
          SELECT 1 FROM files d
          WHERE d.album_key = f.album_key AND d.id <> f.id
            AND d.disc = f.disc AND d.number = f.number
            AND d.fold_title = f.fold_title AND d.kind = f.kind
            AND d.duration_ms = f.duration_ms
            AND (d.held * f.size > f.held * d.size
              OR (d.held * f.size = f.held * d.size
                AND (d.held > f.held OR (d.held = f.held AND d.seq < f.seq))))
        )
      )`,
    )
    .run({ $keys: keys });
};

export default markAlbumCopies;
