/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import { useTagEditor } from './TagEditorContext';

const BackGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </svg>
);

/**
 * The way out of a tag page, first thing at its top left: Back, or — when a
 * view, a shelf or Back itself was pressed over unsaved edits — the question
 * whether to leave them. It sat at the head's far right beside a paragraph
 * of help, and leaving was the hardest thing on the page to find (Ivan,
 * 2026-11-16: "para salir aquí es mi candela").
 */
const LibraryTagBack = () => {
  const { t } = useTranslation();
  const { leavePage, isLeaveAsked, answerLeave } = useTagEditor();
  const askRef = useRef<HTMLDivElement>(null);
  // The question stands at the head of the page, which may be scrolled away
  // when a view is pressed at the foot of a long album.
  useEffect(() => {
    if (isLeaveAsked) {
      askRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isLeaveAsked]);

  if (isLeaveAsked) {
    return (
      <div className="library-tags-back__ask" role="alert" ref={askRef}>
        <span>{t('library.tags.set.leaveAsk')}</span>
        <button
          type="button"
          className="button small subtle"
          onClick={() => answerLeave(false)}
        >
          {t('library.tags.set.keepEditing')}
        </button>
        <button
          type="button"
          className="button small danger"
          onClick={() => answerLeave(true)}
        >
          {t('library.tags.set.discard')}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="button small subtle library-tags-back"
      onClick={() => leavePage()}
    >
      <BackGlyph />
      {t('library.tags.set.back')}
    </button>
  );
};

export default LibraryTagBack;
