/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The library's answers, a page at a time (`common/library/query.ts`).
 *
 * Each question is the plan `libraryQueryPlan.ts` builds for its list,
 * wrapped: a page is the plan ordered with a LIMIT, a length is a COUNT of
 * it, a position a ROW_NUMBER over it. Nothing here keeps a list between
 * questions — the store is the list, and a question is cheap enough to ask
 * again (`libraryQuery.test.ts` times the real library).
 */

import type { SQLInputValue } from 'node:sqlite';
import {
  normaliseFolderPath,
  normalizeForGrouping,
  sortFolders,
  type ILibraryFolder,
} from '../../common/library/grouping';
import { jumpLetterOf } from '../../common/library/jumpLetter';
import type {
  ILibraryAnswers,
  ILibraryFolderItem,
  ILibraryListQuery,
  ILibraryPage,
  TLibraryListItem,
  TLibraryRequest,
} from '../../common/library/query';
import { planLibraryList, type ILibraryQueryPlan } from './libraryQueryPlan';
import {
  beneathSql,
  binder,
  scopeConditions,
  scoreSql,
} from './libraryQuerySql';
import {
  folderRunsOf,
  rowTotal,
  songAtOrAfterRow,
  songsOfRows,
  type IFolderRuns,
} from './libraryFolderRuns';
import type { ILibraryStore } from './libraryStore';
import { trackFromRow, type TStoreRow } from './libraryStoreRows';
import { createTrackQuestions } from './libraryTrackQuestions';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** A row of a list, as the item the window draws. */
const itemOf = (
  shelf: ILibraryListQuery['shelf'],
  row: TStoreRow,
): TLibraryListItem => {
  const near = row.near === 1 ? { near: true } : {};
  const common = {
    id: text(row.id),
    trackCount: Number(row.track_count),
    addedAt: Number(row.added_at),
    isPending: row.all_pending === 1,
    ...(optionalText(row.art_id) === undefined
      ? {}
      : { artId: text(row.art_id) }),
    ...near,
  };
  if (shelf === 'albums') {
    const year = optionalNumber(row.year);
    return {
      kind: 'album',
      ...common,
      title: text(row.list_title),
      artist: text(row.artist_name),
      durationMs: Number(row.duration_ms),
      ...(year === undefined ? {} : { year }),
    };
  }
  if (shelf === 'artists') {
    return {
      kind: 'artist',
      ...common,
      name: text(row.list_title),
      albumCount: Number(row.album_count),
    };
  }
  if (shelf === 'genres') {
    return {
      kind: 'genre',
      ...common,
      name: text(row.list_title),
      artistCount: Number(row.artist_count),
    };
  }
  if (shelf === 'tracks') {
    return {
      kind: 'track',
      track: trackFromRow(row),
      ...near,
      ...(row.matched === 1 ? { matched: true } : {}),
      ...(row.folder_only === 1 ? { folderOnly: true } : {}),
    };
  }
  return { kind: 'folder', ...common, name: text(row.list_title) };
};

export interface ILibraryQueries {
  answer: (
    request: TLibraryRequest,
  ) => ILibraryAnswers[TLibraryRequest['type']];
}

export const createLibraryQueries = (store: ILibraryStore): ILibraryQueries => {
  const { database } = store;
  const songs = createTrackQuestions(database);

  /**
   * A statement over one plan's parameters. The page, the count and the
   * near count of a plan share one set, and each uses only some of them — a
   * count has no use for the highlight — so the rest are allowed to go
   * unused rather than each question binding a set of its own.
   */
  const prepare = (sql: string) => {
    const statement = database.prepare(sql);
    statement.setAllowUnknownNamedParameters(true);
    return statement;
  };

  const run = (sql: string, params: Record<string, SQLInputValue>) =>
    prepare(sql).all(params) as TStoreRow[];

  const one = (sql: string, params: Record<string, SQLInputValue>) =>
    prepare(sql).get(params) as TStoreRow | undefined;

  /**
   * The ordered rows with their place in the list, as `WITH` steps ending in
   * one called `numbered`: a song's place among the songs. Where headings
   * stand is the folder runs' question (`runsOf`), not this one's.
   *
   * Every step MATERIALIZED: joined back to the tracks as a plain subquery,
   * SQLite numbered the whole list again for every row of the page — 5.7 s
   * for one page of headings.
   */
  const numbered = (plan: ILibraryQueryPlan): string =>
    `base AS MATERIALIZED (${plan.narrow}),
     numbered AS MATERIALIZED (
       SELECT base.*, ROW_NUMBER() OVER (ORDER BY ${plan.order}) - 1 AS row_index
       FROM base
     )`;

  /**
   * The folder runs of the one list with headings being read, kept until the
   * library changes or another list is asked for (`libraryFolderRuns.ts`).
   */
  let runsCache:
    { key: string; version: number; runs: IFolderRuns } | undefined;
  const runsOf = (
    query: ILibraryListQuery,
    plan: ILibraryQueryPlan,
  ): IFolderRuns => {
    const key = JSON.stringify(query);
    const version = store.version();
    if (runsCache?.key === key && runsCache.version === version) {
      return runsCache.runs;
    }
    const count = Number(one(plan.count, plan.params)?.n ?? 0);
    const folders = prepare(
      `SELECT folder FROM (${plan.narrow}) ORDER BY ${plan.order}`,
    ).iterate(plan.params);
    const runs = folderRunsOf(count, () => {
      const step = folders.next();
      return step.done ? undefined : text((step.value as TStoreRow).folder);
    });
    runsCache = { key, version, runs };
    return runs;
  };

  const totalOf = (
    query: ILibraryListQuery,
    plan: ILibraryQueryPlan,
  ): number =>
    plan.headings
      ? rowTotal(runsOf(query, plan))
      : Number(one(plan.count, plan.params)?.n ?? 0);

  /** Rows, from the top, that are the near folder's own matches. */
  const nearCountOf = (
    query: ILibraryListQuery,
    plan: ILibraryQueryPlan,
    total: number,
  ): number => {
    if (
      query.near === undefined ||
      normalizeForGrouping(query.search ?? '') === ''
    ) {
      return 0;
    }
    // The near songs are the top of the order, so they are simply counted.
    const near = Number(
      one(
        `SELECT COUNT(*) AS n FROM (${plan.body}) WHERE near = 1`,
        plan.params,
      )?.n ?? 0,
    );
    if (!plan.headings) {
      return near;
    }
    // With headings: up to the row where the first song elsewhere, or its
    // heading, stands.
    const runs = runsOf(query, plan);
    return near >= runs.count ? total : runs.rows[near] - runs.starts[near];
  };

  /** Songs the mark lit — the head of the list, where the mark puts them. */
  const markedCountOf = (
    query: ILibraryListQuery,
    plan: ILibraryQueryPlan,
  ): number =>
    query.shelf !== 'tracks' || normalizeForGrouping(query.mark ?? '') === ''
      ? 0
      : Number(
          one(
            `SELECT COUNT(*) AS n FROM (${plan.body}) WHERE matched = 1`,
            plan.params,
          )?.n ?? 0,
        );

  const listRoots = (query: ILibraryListQuery): TLibraryListItem[] => {
    const needle = normalizeForGrouping(query.search ?? '');
    const folders: ILibraryFolder[] = store.roots().map((root) => {
      const id = normaliseFolderPath(root.path);
      const { params, bind } = binder();
      let summary: TStoreRow | undefined;
      if (needle === '') {
        // Summed from the folders' own summaries: every folder at or beneath
        // the root, the cover the earliest of them found.
        const where = beneathSql('f.id', id, bind);
        summary = one(
          `SELECT COALESCE(SUM(track_count), 0) AS n, MAX(added_at) AS added_at,
             MIN(all_pending) AS all_pending,
             (SELECT art_id FROM folder_groups f WHERE ${where}
               AND art_id IS NOT NULL ORDER BY art_seq LIMIT 1) AS art_id
           FROM folder_groups f WHERE ${where}`,
          params,
        );
      } else {
        const conditions = [
          beneathSql('t.folder', id, bind),
          ...scopeConditions(
            { ...query.scope, beneath: undefined },
            bind,
            true,
          ),
          `${scoreSql(bind(needle))} > 0`,
        ];
        const where = conditions.join(' AND ');
        summary = one(
          `SELECT COUNT(*) AS n, MAX(added_at) AS added_at,
             MIN(COALESCE(is_pending, 0)) AS all_pending,
             (SELECT art_id FROM tracks t WHERE ${where} AND art_id IS NOT NULL
               ORDER BY seq LIMIT 1) AS art_id
           FROM tracks t WHERE ${where}`,
          params,
        );
      }
      const count = Number(summary?.n ?? 0);
      const artId = optionalText(summary?.art_id);
      return {
        id,
        name: id.split('/').filter(Boolean).pop() ?? id,
        trackCount: count,
        addedAt: Number(summary?.added_at ?? 0),
        // `summarise`: pending only with something in it, all of it unread.
        isPending: count > 0 && summary?.all_pending === 1,
        ...(artId === undefined ? {} : { artId }),
      };
    });
    const ordered =
      query.sort === undefined
        ? folders
        : sortFolders(folders, query.sort, query.direction);
    return ordered.map((folder): ILibraryFolderItem => ({
      kind: 'folder',
      ...folder,
    }));
  };

  const page = (
    query: ILibraryListQuery,
    offset: number,
    limit: number,
  ): ILibraryPage => {
    const version = store.version();
    if (query.shelf === 'roots') {
      const items = listRoots(query);
      return {
        total: items.length,
        nearCount: 0,
        markedCount: 0,
        offset,
        items: items.slice(offset, offset + limit),
        version,
      };
    }
    const plan = planLibraryList(query);
    const total = totalOf(query, plan);
    if (!plan.headings) {
      // A plain ORDER BY with a LIMIT: an index on the order answers it
      // without numbering every row above the page.
      return {
        total,
        nearCount: nearCountOf(query, plan, total),
        markedCount: markedCountOf(query, plan),
        offset,
        items: run(
          `SELECT * FROM (${plan.body}) ORDER BY ${plan.order}
           LIMIT $limit OFFSET $offset`,
          { ...plan.params, $limit: limit, $offset: offset },
        ).map((row) => itemOf(query.shelf, row)),
        version,
      };
    }
    const runs = runsOf(query, plan);
    const end = offset + limit;
    const { first, last } = songsOfRows(runs, offset, end);
    const items: TLibraryListItem[] = [];
    run(
      `SELECT * FROM (${plan.body}) ORDER BY ${plan.order}
       LIMIT $limit OFFSET $offset`,
      { ...plan.params, $limit: last - first, $offset: first },
    ).forEach((row, index) => {
      const at = first + index;
      const own = runs.rows[at];
      if (runs.starts[at] === 1 && own - 1 >= offset && own - 1 < end) {
        items.push({ kind: 'heading', folder: text(row.folder) });
      }
      if (own >= offset && own < end) {
        items.push(itemOf(query.shelf, row));
      }
    });
    return {
      total,
      nearCount: nearCountOf(query, plan, total),
      markedCount: markedCountOf(query, plan),
      offset,
      items,
      version,
    };
  };

  const position = (query: ILibraryListQuery, id: string): number => {
    if (query.shelf === 'roots') {
      return listRoots(query).findIndex(
        (item) => item.kind === 'folder' && item.id === id,
      );
    }
    const plan = planLibraryList(query);
    const row = one(
      `WITH ${numbered(plan)} SELECT row_index FROM numbered WHERE id = $id
       ORDER BY row_index LIMIT 1`,
      { ...plan.params, $id: id },
    );
    if (row === undefined) {
      return -1;
    }
    const at = Number(row.row_index);
    // A song's place among the songs, then its row among the headings.
    return plan.headings ? runsOf(query, plan).rows[at] : at;
  };

  const letters = (query: ILibraryListQuery): Record<string, number> => {
    const found: Record<string, number> = {};
    const note = (title: string, at: number) => {
      const letter = jumpLetterOf(title);
      if (found[letter] === undefined) {
        found[letter] = at;
      }
    };
    if (query.shelf === 'roots') {
      listRoots(query).forEach((item, at) => {
        note(item.kind === 'folder' ? item.name : '', at);
      });
      return found;
    }
    const plan = planLibraryList(query);
    const runs = plan.headings ? runsOf(query, plan) : undefined;
    const titles = prepare(
      `SELECT list_title FROM (${plan.narrow}) ORDER BY ${plan.order}`,
    ).iterate(plan.params);
    for (
      let step = titles.next(), at = 0;
      !step.done;
      step = titles.next(), at += 1
    ) {
      note(
        text((step.value as TStoreRow).list_title),
        runs === undefined ? at : runs.rows[at],
      );
    }
    return found;
  };

  /** Where each folder heading stands, as a row of the list. */
  const headings = (query: ILibraryListQuery): number[] => {
    const plan = planLibraryList(query);
    if (!plan.headings) {
      return [];
    }
    const runs = runsOf(query, plan);
    const found: number[] = [];
    for (let at = 0; at < runs.count; at += 1) {
      if (runs.starts[at] === 1) {
        found.push(runs.rows[at] - 1);
      }
    }
    return found;
  };

  const ids = (
    query: ILibraryListQuery,
    offset: number,
    limit: number,
  ): string[] => {
    const plan = planLibraryList(query);
    // Rows to songs: with headings, the songs whose own rows fall in range.
    const runs = plan.headings ? runsOf(query, plan) : undefined;
    const first = runs === undefined ? offset : songAtOrAfterRow(runs, offset);
    const last =
      runs === undefined
        ? offset + limit
        : songAtOrAfterRow(runs, offset + limit);
    return run(
      `SELECT id FROM (${plan.narrow}) ORDER BY ${plan.order}
       LIMIT $limit OFFSET $offset`,
      { ...plan.params, $limit: Math.max(0, last - first), $offset: first },
    ).map((row) => text(row.id));
  };

  /**
   * The songs after `afterId` that are not in `exclude`, counted over the
   * list's own numbering — songs, not rows, so headings never count.
   */
  const rest = (
    query: ILibraryListQuery,
    afterId: string,
    exclude: readonly string[],
  ): number => {
    const plan = planLibraryList(query);
    const row = one(
      `WITH ${numbered(plan)},
         at AS (SELECT MIN(row_index) AS row_index FROM numbered WHERE id = $afterId)
       SELECT
         (SELECT row_index FROM at) AS at,
         (SELECT COUNT(*) FROM numbered
           WHERE row_index > (SELECT row_index FROM at)
             AND id NOT IN (SELECT value FROM json_each($exclude))) AS n`,
      { ...plan.params, $afterId: afterId, $exclude: JSON.stringify(exclude) },
    );
    return row === undefined || row.at === null ? -1 : Number(row.n);
  };

  return {
    answer: (request) => {
      switch (request.type) {
        case 'page':
          return page(request.query, request.offset, request.limit);
        case 'position':
          return position(request.query, request.id);
        case 'letters':
          return letters(request.query);
        case 'ids':
          return ids(request.query, request.offset, request.limit);
        case 'tracks':
          return songs.tracks(request.ids);
        case 'continuation':
          return songs.continuation(
            request.seedId,
            request.exclude,
            request.count,
          );
        case 'duration':
          return songs.duration(request.ids);
        case 'rest':
          return rest(request.query, request.afterId, request.exclude);
        case 'headings':
          return headings(request.query);
        default: {
          // Every question has a case above; the guard in front of this
          // (`libraryRequestGuard.ts`) turns anything else away first.
          const unknown: never = request;
          throw new Error(`Not a library question: ${JSON.stringify(unknown)}`);
        }
      }
    },
  };
};
