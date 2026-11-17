/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The album editor's file names: what each song's file will be called once
 * Save writes, made from its tags as they will be — typed, fixed or read —
 * by the pattern chosen (Ivan, 2026-11-17: "rename the files too to have
 * better format").
 */

import {
  fileNameOf,
  isFileNamePattern,
  paddedTrack,
  type TFileNameValues,
} from '../../../common/library/fileNamePattern';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import { isPlaceholderName } from '../../../common/library/tagFix';
import { effectiveValue, type ISetState } from './tagSetModel';

export interface IFileRename {
  trackId: string;
  /** The file's name now, extension included. */
  before: string;
  /** Its name after Save, extension included. */
  after: string;
  /** `after` without the extension: what the write is sent. */
  base: string;
  /** Another song of the editor would get the same name, or keeps it. */
  isClash: boolean;
}

/** The extension, its dot and its own case included, or nothing. */
const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot) : '';
};

/** A song's values as the pattern reads them: a placeholder is nothing. */
const valuesOf = (state: ISetState, sheet: ITrackTagSheet): TFileNameValues => {
  const value = (key: Parameters<typeof effectiveValue>[2]): string => {
    const text = effectiveValue(state, sheet, key).trim();
    return isPlaceholderName(text) ? '' : text;
  };
  const artist = value('artist');
  const albumArtist = value('albumArtist');
  return {
    track: paddedTrack(value('trackNo'), value('trackTotal')),
    title: value('title'),
    artist: artist || albumArtist,
    albumArtist: albumArtist || artist,
    album: value('album'),
    year: value('year'),
    disc: value('discNo'),
  };
};

/** One song's name under `pattern`, extension included, for the menu. */
export const exampleNameOf = (
  state: ISetState,
  sheet: ITrackTagSheet,
  pattern: string,
): string | undefined => {
  const base = fileNameOf(pattern, valuesOf(state, sheet));
  return base === undefined
    ? undefined
    : `${base}${extensionOf(sheet.fileName)}`;
};

/** Two names on one drive folder are the same file whatever their case. */
const placeKey = (sheet: ITrackTagSheet, name: string): string =>
  JSON.stringify([sheet.folder, name]).toLowerCase();

/**
 * Every song whose name changes, in the order a write can take them: one
 * whose new name is another song's present one goes after that song has
 * moved off it. A name two songs would share, or that a song keeping its
 * name already has, is a clash, which Save will not send.
 */
export const fileRenamesOf = (
  state: ISetState,
  sheets: readonly ITrackTagSheet[],
): IFileRename[] => {
  const pattern = state.fileNames;
  if (pattern === undefined || !isFileNamePattern(pattern)) {
    return [];
  }
  const renames = sheets.flatMap((sheet): IFileRename[] => {
    const base = fileNameOf(pattern, valuesOf(state, sheet));
    if (base === undefined) {
      return [];
    }
    const after = `${base}${extensionOf(sheet.fileName)}`;
    return after === sheet.fileName
      ? []
      : [
          {
            trackId: sheet.trackId,
            before: sheet.fileName,
            after,
            base,
            isClash: false,
          },
        ];
  });
  const sheetOf = new Map(sheets.map((sheet) => [sheet.trackId, sheet]));
  const moving = new Set(renames.map((rename) => rename.trackId));
  const targets = new Map<string, number>();
  renames.forEach((rename) => {
    const sheet = sheetOf.get(rename.trackId);
    if (sheet !== undefined) {
      const key = placeKey(sheet, rename.after);
      targets.set(key, (targets.get(key) ?? 0) + 1);
    }
  });
  // The names that stay: songs not renamed keep theirs.
  const staying = new Set(
    sheets
      .filter((sheet) => !moving.has(sheet.trackId))
      .map((sheet) => placeKey(sheet, sheet.fileName)),
  );
  const marked = renames.map((rename) => {
    const sheet = sheetOf.get(rename.trackId);
    const key = sheet === undefined ? '' : placeKey(sheet, rename.after);
    return {
      ...rename,
      isClash: (targets.get(key) ?? 0) > 1 || staying.has(key),
    };
  });
  // Songs freeing a name first: a rename onto a name another rename leaves
  // waits for it. A ring of swaps cannot be ordered and keeps its order;
  // its first song is told the name is taken and can be tried again.
  const ordered: IFileRename[] = [];
  let left = marked;
  while (left.length > 0) {
    const held = new Set(
      left.flatMap((rename) => {
        const sheet = sheetOf.get(rename.trackId);
        return sheet === undefined ? [] : [placeKey(sheet, rename.before)];
      }),
    );
    const free = left.filter((rename) => {
      const sheet = sheetOf.get(rename.trackId);
      return (
        sheet === undefined ||
        !held.has(placeKey(sheet, rename.after)) ||
        placeKey(sheet, rename.after) === placeKey(sheet, rename.before)
      );
    });
    const next = free.length > 0 ? free : left;
    ordered.push(...next);
    left = left.filter((rename) => !next.includes(rename));
  }
  return ordered;
};
