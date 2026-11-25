/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment, type ReactNode } from 'react';
import { searchMarks } from '../../../common/searchText';

/**
 * `text` with what the search matched in it lit (`searchMarks`): the reason
 * a row was found, where it was found.
 */
export const markedText = (
  text: string,
  terms: readonly string[] | undefined,
): ReactNode => {
  const spans = terms && terms.length > 0 ? searchMarks(text, terms) : [];
  if (spans.length === 0) {
    return text;
  }
  const parts: ReactNode[] = [];
  let at = 0;
  spans.forEach(([start, end]) => {
    if (start > at) {
      parts.push(text.slice(at, start));
    }
    parts.push(
      <mark key={start} className="wave-preset-menu__mark">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) {
    parts.push(text.slice(at));
  }
  return parts;
};

/**
 * How far into a line its first match may stand before the line is shown
 * from the word ahead of it. Beside "Synth-pop" the hint's column held 34
 * characters in the 372px panel; 22 leaves room for a longer name and for
 * the matched word itself.
 */
const MARK_ROOM = 22;

/**
 * A genre's line, from one word before what matched when that is far in, so
 * the lit word is never the part the row's ellipsis takes ("…sequenced bass
 * and chorused pads" for "bass"). The row's tooltip keeps the whole line.
 */
export const fromFirstMark = (
  text: string,
  terms: readonly string[],
): string => {
  const [first] = searchMarks(text, terms);
  if (first === undefined || first[0] <= MARK_ROOM) {
    return text;
  }
  const wordStart = text.lastIndexOf(' ', first[0] - 1);
  const before = wordStart > 0 ? text.lastIndexOf(' ', wordStart - 1) : -1;
  return before > 0 ? `…${text.slice(before + 1)}` : text;
};

/**
 * A translated line with a node standing where its `{slot}` is — a name in
 * bold, the typed words in the reader's own quotes, a key cap — so no
 * language has to put the slot where English does. A line without the slot
 * is drawn as it is.
 */
export const fillSlot = (
  template: string,
  slot: string,
  node: ReactNode,
): ReactNode => {
  const parts = template.split(`{${slot}}`);
  return parts.map((part, index) => (
    // The parts never reorder: their place is their identity.
    // eslint-disable-next-line react/no-array-index-key
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && node}
    </Fragment>
  ));
};
