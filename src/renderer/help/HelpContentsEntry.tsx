/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { Fragment, memo } from 'react';
import type { IHelpShownChapter } from './HelpChapter';
import { Marked, MarkedText } from './HelpMarks';
import { helpAnchor } from './helpSearch';

interface IHelpContentsEntryProps {
  chapter: IHelpShownChapter;
  /** Its part of the guide, named above it when it is the first shown. */
  groupLabel?: string;
  /** Whether it is the chapter being read. */
  isActive: boolean;
  onOpen: (chapter: IHelpShownChapter) => void;
}

/**
 * One chapter in the guide's contents, with what a search found in it.
 *
 * Memoised for the reason `HelpChapter` is: the rail re-rendered all
 * thirty-one entries on every key typed in the search, and on every chapter
 * crossed while reading, where two of them change.
 */
function HelpContentsEntry({
  chapter,
  groupLabel,
  isActive,
  onOpen,
}: IHelpContentsEntryProps) {
  return (
    <>
      {groupLabel && (
        <span className="help-guide__group" aria-hidden="true">
          {groupLabel}
        </span>
      )}
      <button
        className={`feature-tour__rail-item help-guide__entry${isActive ? ' is-active' : ''}`}
        type="button"
        aria-label={chapter.title}
        aria-describedby={chapter.hit ? `help-found-${chapter.id}` : undefined}
        aria-current={isActive ? 'location' : undefined}
        onClick={() => onOpen(chapter)}
      >
        <span className="feature-tour__rail-number" aria-hidden="true">
          {chapter.number}
        </span>
        <span className="help-guide__entry-text">
          <span className="help-guide__entry-title">
            <Marked
              text={chapter.title}
              anchor={helpAnchor.title(chapter.id)}
              kind="title"
            />
          </span>
          {chapter.hit && chapter.hit.snippet.length > 0 && (
            <span
              id={`help-found-${chapter.id}`}
              className="help-guide__entry-found"
            >
              {chapter.hit.snippet.map((part, partIndex) => (
                <Fragment key={part.text}>
                  {partIndex > 0 && (
                    <span className="help-guide__entry-gap" aria-hidden="true">
                      {' · '}
                    </span>
                  )}
                  <MarkedText text={part.text} marks={part.marks} />
                </Fragment>
              ))}
            </span>
          )}
        </span>
      </button>
    </>
  );
}

export default memo(HelpContentsEntry);
