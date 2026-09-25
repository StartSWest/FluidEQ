/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A list as the views draw it: its rows, and the section headings a search
 * from inside a folder stands between them.
 *
 * Searching while standing in a folder reaches the whole library, with what
 * matched in that folder and beneath it first and everything else after,
 * each under a heading of its own (Ivan, 2026-09-23: "show first the files in
 * current folder and inners, but show also root ones after that with a
 * header"). The store puts them in that order and says where the one stops
 * (`nearCount`); this is where the headings go, and how a row on screen maps
 * back to the list's own index and forward again.
 */

import type { TLibraryListItem } from '../../common/library/query';
import type { ILibraryList } from './useLibraryList';

/**
 * `near`: the folder's own matches follow. `nearEmpty`: nothing in the folder
 * matched, said rather than left for the reader to infer from a list that
 * starts elsewhere. `elsewhere`: the rest of the library follows.
 */
export type TLibrarySection = 'near' | 'nearEmpty' | 'elsewhere';

export interface ILibrarySectionRow {
  kind: 'section';
  section: TLibrarySection;
  /** Rows under it, or nothing where rows are not what a reader counts. */
  count?: number;
}

export type TLibraryRow = TLibraryListItem | ILibrarySectionRow;

export interface ILibraryRows {
  /** Rows to draw, headings and sections included. */
  readonly count: number;
  /** The row at `row`, or nothing while its page is out. */
  readonly at: (row: number) => TLibraryRow | undefined;
  /** These rows are on screen. */
  readonly want: (start: number, end: number) => void;
  /** The row the list's own `index` is drawn at. */
  readonly rowOf: (index: number) => number;
  /** The list index a row draws, or -1 for a section's heading. */
  readonly indexOf: (row: number) => number;
  /** The section headings, each at the row it is drawn at. */
  readonly sections: readonly {
    row: number;
    section: TLibrarySection;
  }[];
}

export interface ISectionAt {
  /** The list index the heading stands before. */
  before: number;
  section: TLibrarySection;
  count?: number;
}

/** The headings a list's search draws, in order. */
export const librarySectionsOf = (list: ILibraryList): ISectionAt[] => {
  const { query, count, nearCount } = list;
  if (
    query?.near === undefined ||
    (query.search ?? '').trim() === '' ||
    !list.isLoaded
  ) {
    return [];
  }
  // A song list with folder headings counts rows that are not songs; the
  // headings say how much is under them only where a row is a thing.
  const counted = query.folderHeadings !== true;
  const sized = (rows: number) => (counted ? { count: rows } : {});
  if (nearCount === 0) {
    return count === 0
      ? [{ before: 0, section: 'nearEmpty' }]
      : [
          { before: 0, section: 'nearEmpty' },
          { before: 0, section: 'elsewhere', ...sized(count) },
        ];
  }
  return count > nearCount
    ? [
        { before: 0, section: 'near', ...sized(nearCount) },
        {
          before: nearCount,
          section: 'elsewhere',
          ...sized(count - nearCount),
        },
      ]
    : [{ before: 0, section: 'near', ...sized(nearCount) }];
};

export const libraryRows = (list: ILibraryList): ILibraryRows => {
  const sections = librarySectionsOf(list);

  const rowOf = (index: number): number =>
    index + sections.filter((entry) => entry.before <= index).length;

  /** How many headings stand above `row`, and whether `row` is one. */
  const locate = (row: number): { above: number; heading?: ISectionAt } => {
    let above = 0;
    for (let at = 0; at < sections.length; at += 1) {
      const entry = sections[at];
      const headingRow = entry.before + above;
      if (row === headingRow) {
        return { above, heading: entry };
      }
      if (row < headingRow) {
        break;
      }
      above += 1;
    }
    return { above };
  };

  return {
    count: list.count + sections.length,
    at: (row) => {
      const { above, heading } = locate(row);
      if (heading) {
        return {
          kind: 'section',
          section: heading.section,
          ...(heading.count === undefined ? {} : { count: heading.count }),
        };
      }
      return list.at(row - above);
    },
    want: (start, end) => {
      const first = Math.max(0, start - locate(start).above);
      const last = Math.max(first, end - locate(end).above);
      list.want(first, last);
    },
    rowOf,
    indexOf: (row) => {
      const { above, heading } = locate(row);
      return heading ? -1 : row - above;
    },
    sections: sections.map((entry, at) => ({
      row: entry.before + at,
      section: entry.section,
    })),
  };
};
