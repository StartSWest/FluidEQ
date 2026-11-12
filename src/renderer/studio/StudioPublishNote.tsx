/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { MAX_VERSION_NOTE } from 'common/sceneVersionNote';
import { useTranslation } from '../utils/I18nContext';

/**
 * The note the publish dialog holds. It opens on the line the member's AI
 * wrote about its own change, when there is one: the assistant that made
 * the change remembers it and the member, three days later, does not. A
 * newer line written while the dialog is open (`usePublishNote.ts`)
 * replaces the one offered only while the box still holds it untouched:
 * what the member typed is never written over.
 */
export const useOfferedNote = (
  suggested: string | undefined,
): [string, Dispatch<SetStateAction<string>>] => {
  const [note, setNote] = useState(suggested ?? '');
  const offered = useRef(suggested ?? '');
  useEffect(() => {
    if (suggested === undefined || suggested === offered.current) {
      return;
    }
    const before = offered.current;
    offered.current = suggested;
    setNote((shown) => (shown === before ? suggested : shown));
  }, [suggested]);
  return [note, setNote];
};

interface IStudioPublishNoteProps {
  note: string;
  setNote: (line: string) => void;
  running: boolean;
  /** Publish was pressed with the box empty. */
  missing: boolean;
  /** Something was typed after `missing`: the red line goes. */
  onFilled: () => void;
  /** The scene's chat is writing the line now. */
  writing: boolean;
  noteRef: RefObject<HTMLTextAreaElement | null>;
}

/** "What's new in this version", for an update. */
export default function StudioPublishNote({
  note,
  setNote,
  running,
  missing,
  onFilled,
  writing,
  noteRef,
}: IStudioPublishNoteProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const noteWrongId = useId();
  const noteHintId = useId();
  return (
    <div className="studio-publish__note">
      <span className="studio-publish__note-head">
        <label className="gallery-dialog__label" htmlFor={noteId}>
          {t('studio.publish.note')}
        </label>
        {/* Said before the press as well as after it: the quiet word is
            what stops the red one ever being needed. Outside the label on
            purpose — the field is already announced as required, and the
            marker would otherwise become part of its name. */}
        <span className="studio-publish__note-needed" aria-hidden="true">
          {t('studio.publish.noteNeeded')}
        </span>
        {/* Marked at the limit: the field stops taking letters silently,
            and a note that ends mid-sentence is one the author believed
            they had finished. */}
        <span
          className={`studio-publish__note-count${
            note.length >= MAX_VERSION_NOTE
              ? ' studio-publish__note-count--full'
              : ''
          }`}
          aria-hidden="true"
        >
          {note.length} / {MAX_VERSION_NOTE}
        </span>
      </span>
      <textarea
        ref={noteRef}
        id={noteId}
        value={note}
        rows={2}
        maxLength={MAX_VERSION_NOTE}
        disabled={running}
        required
        aria-required="true"
        aria-invalid={missing}
        aria-describedby={missing ? `${noteWrongId} ${noteHintId}` : noteHintId}
        placeholder={t('studio.publish.notePlaceholder')}
        onChange={(event) => {
          // One line: what a card and a notice have room for.
          const line = event.target.value.replace(/\s*\n\s*/g, ' ');
          setNote(line);
          if (line.trim()) {
            onFilled();
          }
        }}
      />
      {/* The gallery is one for every language, so its notes are in
          English (Ivan, 2026-11-12: "the whats new always in English for
          publish"); the member's chat is told so too (`noteDue.ts`). */}
      <span id={noteHintId} className="studio-publish__category-hint">
        {t('studio.publish.noteEnglish')}
      </span>
      {/* The chat's own working mark: it is the chat writing it. */}
      {writing && !note.trim() && (
        <p className="studio-chat__thinking" role="status">
          <span className="studio-chat__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {t('studio.publish.noteWriting')}
        </p>
      )}
      {missing && (
        <p id={noteWrongId} className="studio-publish__note-wrong" role="alert">
          {t('studio.publish.needNote')}
        </p>
      )}
    </div>
  );
}
