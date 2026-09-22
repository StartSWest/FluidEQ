/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createContext, useContext, type ReactNode } from 'react';
import {
  helpMarkKey,
  type IHelpMarkedText,
  type THelpPassageKind,
  type THelpRange,
} from './helpSearch';

export interface IHelpFound {
  /** The words to mark in each shown passage, by `helpMarkKey`. */
  readonly marks: ReadonlyMap<string, readonly THelpRange[]>;
  /** Where each chapter's best match is drawn: its control is ringed. */
  readonly targets: ReadonlySet<string>;
}

/** What the guide's search found, for every passage the article draws. */
export const HelpFoundContext = createContext<IHelpFound>({
  marks: new Map(),
  targets: new Set(),
});

export const useHelpFound = () => useContext(HelpFoundContext);

/** A text with the given ranges drawn as found words. */
export function MarkedText({ text, marks }: IHelpMarkedText) {
  if (marks.length === 0) {
    return text;
  }
  const parts: ReactNode[] = [];
  let at = 0;
  marks.forEach(([start, end]) => {
    if (start > at) {
      parts.push(text.slice(at, start));
    }
    parts.push(
      <mark key={start} className="help-mark">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) {
    parts.push(text.slice(at));
  }
  return parts;
}

interface IMarkedProps {
  text: string;
  anchor: string;
  kind: THelpPassageKind;
}

/** A passage of the guide, with the words the search found in it marked. */
export function Marked({ text, anchor, kind }: IMarkedProps) {
  const marks = useHelpFound().marks.get(helpMarkKey(anchor, kind)) ?? [];
  return <MarkedText text={text} marks={marks} />;
}
