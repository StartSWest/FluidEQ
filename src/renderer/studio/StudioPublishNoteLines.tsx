/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useState } from 'react';
import {
  MAX_VERSION_NOTE,
  VERSION_NOTE_LOCALES,
  type TVersionNoteLocale,
} from 'common/sceneVersionNote';
import { useTranslation } from '../utils/I18nContext';
import { languageName, type INoteLines } from './publishNoteLines';

interface IStudioPublishNoteLinesProps {
  state: INoteLines;
  /** The languages already on show above, left out here. */
  shown: readonly TVersionNoteLocale[];
  disabled: boolean;
  /** Nothing translated the line: the rest go out as written. */
  asWritten: boolean;
  /** The languages still to be written before the line goes out. */
  pending: readonly TVersionNoteLocale[];
  onType: (locale: TVersionNoteLocale, text: string) => void;
}

/**
 * Every other language the line goes out in, folded away (Ivan, 2026-11-12:
 * the member's language and English on show, the rest in a fold-out). Each
 * row can be read and corrected on its own; a change to one row changes that
 * row only. A row the chat has not written says it will go out as written.
 */
export default function StudioPublishNoteLines({
  state,
  shown,
  disabled,
  asWritten,
  pending,
  onType,
}: IStudioPublishNoteLinesProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const rest = VERSION_NOTE_LOCALES.filter((locale) => !shown.includes(locale));
  // Written and current: a line about the member's old words is not.
  const written = rest.filter((locale) => !pending.includes(locale)).length;
  let summary = t('studio.publish.noteMore', { count: String(rest.length) });
  if (written === rest.length) {
    summary = t('studio.publish.noteMoreWritten', {
      count: String(rest.length),
    });
  } else if (asWritten) {
    summary = t('studio.publish.noteMoreAsWritten', {
      count: String(rest.length),
    });
  }
  return (
    <details
      className="studio-publish__note-more"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {open && (
        <div className="studio-publish__note-rows">
          {rest.map((locale) => {
            const id = `${baseId}-${locale}`;
            return (
              <div key={locale} className="studio-publish__note-row">
                <label htmlFor={id}>{languageName(locale)}</label>
                <textarea
                  id={id}
                  value={state.lines[locale]}
                  rows={1}
                  maxLength={MAX_VERSION_NOTE}
                  disabled={disabled}
                  placeholder={t('studio.publish.noteRowEmpty')}
                  onChange={(event) => onType(locale, event.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}
    </details>
  );
}
