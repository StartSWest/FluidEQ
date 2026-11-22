/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An artist line as links, one per name with a page (`libraryRecordLinks.ts`
 * says where they lead and why).
 */

import { Fragment, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useLibraryRecordLinks } from './libraryRecordLinks';
import useArtistLinks from './useArtistLinks';

/**
 * An artist line with each name that has a page drawn as a link to it —
 * "Britney Spears feat. *NSYNC" as two — and everything between as the text
 * it is. Until main has said which names those are, and wherever nothing
 * can open a page, the line as plain text, in the same place and size.
 *
 * A link is an inline run of the line (`role="link"`), not a button: the
 * cells and lines it stands in cut long text with an ellipsis, and only
 * inline text takes one — a button is a box, clipped without it.
 */
const LibraryArtistName = ({
  line,
  fallback = '',
}: {
  line: string | undefined;
  /** Drawn when there is no line at all: "Unknown artist". */
  fallback?: ReactNode;
}) => {
  const { t } = useTranslation();
  const links = useLibraryRecordLinks();
  const parts = useArtistLinks(links === undefined ? undefined : line);
  if (line === undefined || line.trim() === '') {
    return fallback;
  }
  if (links === undefined || parts === undefined) {
    return line;
  }
  return (
    <>
      {parts.map((part, index) => {
        const { id, text } = part;
        // The runs of one line, always in its order: their place is who they
        // are.
        const key = String(index);
        if (id === undefined) {
          return <Fragment key={key}>{text}</Fragment>;
        }
        const open = () => links.openArtist(id);
        return (
          <span
            key={key}
            role="link"
            tabIndex={0}
            className="library-artist-link"
            title={t('library.artist.show', { name: text })}
            // The row under a name plays on a press, a double press and
            // Enter: a name's own press is the name's alone.
            onClick={(event) => {
              event.stopPropagation();
              open();
            }}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                open();
              }
            }}
          >
            {text}
          </span>
        );
      })}
    </>
  );
};

export default LibraryArtistName;
