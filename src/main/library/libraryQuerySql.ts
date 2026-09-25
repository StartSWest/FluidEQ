/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The pieces every list's SQL is made of: bound parameters, the folder range,
 * the scope's conditions, the search score and a reversible order.
 */

import type { SQLInputValue } from 'node:sqlite';
import type { ILibraryScope } from '../../common/library/query';

/** Named parameters, numbered as they are bound. */
export const binder = () => {
  const params: Record<string, SQLInputValue> = {};
  let next = 0;
  return {
    params,
    bind: (value: SQLInputValue): string => {
      const name = `$p${next}`;
      next += 1;
      params[name] = value;
      return name;
    },
  };
};

export type TBind = (value: SQLInputValue) => string;

/**
 * At or beneath a folder, as a range the folder index can answer: every path
 * starting `folder/` sorts at or after `folder/` and before `folder0`, `0`
 * being the character after `/`. Case-sensitive, as `isTrackBeneathFolder`
 * always was.
 */
export const beneathSql = (
  column: string,
  folder: string,
  bind: TBind,
): string =>
  `(${column} = ${bind(folder)} OR (${column} >= ${bind(
    `${folder}/`,
  )} AND ${column} < ${bind(`${folder}0`)}))`;

export const scopeConditions = (
  scope: ILibraryScope,
  bind: TBind,
  ignoreBeneath: boolean,
): string[] => {
  const conditions: string[] = [];
  if (scope.beneath !== undefined && !ignoreBeneath) {
    conditions.push(beneathSql('t.folder', scope.beneath, bind));
  }
  if (scope.folder !== undefined) {
    conditions.push(`t.folder = ${bind(scope.folder)}`);
  }
  if (scope.album !== undefined) {
    const album = bind(scope.album);
    conditions.push(
      scope.withFolderMates
        ? `(t.album_key = ${album} OR t.folder IN (SELECT folder FROM tracks WHERE album_key = ${album}))`
        : `t.album_key = ${album}`,
    );
  }
  if (scope.artist !== undefined) {
    conditions.push(`t.artist_key = ${bind(scope.artist)}`);
  }
  if (scope.genre !== undefined) {
    conditions.push(
      `t.id IN (SELECT track_id FROM track_genres WHERE genre_id = ${bind(
        scope.genre,
      )})`,
    );
  }
  if (scope.kind !== undefined) {
    conditions.push(`t.kind = ${bind(scope.kind)}`);
  }
  return conditions;
};

/** `searchScore`, in SQL, over the folded columns `libraryStoreRows` wrote. */
export const scoreSql = (needle: string): string => {
  const prefixOrAnywhere = (column: string, prefix: number, anywhere: number) =>
    `CASE WHEN substr(${column}, 1, length(${needle})) = ${needle} THEN ${prefix}
          WHEN instr(${column}, ${needle}) > 0 THEN ${anywhere} ELSE 0 END`;
  return `MAX(
    CASE WHEN t.fold_title = ${needle} THEN 100
         WHEN substr(t.fold_title, 1, length(${needle})) = ${needle} THEN 80
         WHEN instr(t.fold_title, ${needle}) > 0 THEN 40 ELSE 0 END,
    ${prefixOrAnywhere('t.fold_artist', 70, 30)},
    ${prefixOrAnywhere('t.fold_album_artist', 70, 30)},
    ${prefixOrAnywhere('t.fold_album', 60, 20)}
  )`;
};

const flip = (term: string): string => {
  if (term.endsWith(' DESC')) {
    return term.slice(0, -' DESC'.length);
  }
  return `${term} DESC`;
};

/** A sort, and `desc` reversing every term of it, ties included. */
export const directed = (terms: string[], descending: boolean): string[] =>
  descending ? terms.map(flip) : terms;
