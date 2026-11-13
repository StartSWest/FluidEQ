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
import {
  MAX_VERSION_NOTE,
  type TVersionNoteLocale,
  type TVersionNotes,
} from 'common/sceneVersionNote';
import { useTranslation } from '../utils/I18nContext';
import {
  languageName,
  linesFrom,
  sourceOf,
  startLines,
  takeOffer,
  toTranslate,
  typeLine,
  type INoteLines,
} from './publishNoteLines';
import StudioPublishNoteLines from './StudioPublishNoteLines';

/**
 * The lines the publish dialog holds. They open on what the member's AI
 * wrote about its own change, in every language it wrote: the assistant that
 * made the change remembers it and the member, three days later, does not.
 * Newer lines written while the dialog is open (`usePublishNote.ts`) fill
 * every box the member has not typed in; what they typed is never written
 * over (`publishNoteLines.ts`).
 */
export const useOfferedLines = (
  suggested: TVersionNotes | undefined,
): [INoteLines, Dispatch<SetStateAction<INoteLines>>] => {
  const [state, setState] = useState(() => startLines(suggested));
  const offered = useRef(suggested);
  useEffect(() => {
    if (suggested === undefined || suggested === offered.current) {
      return;
    }
    offered.current = suggested;
    setState((now) => takeOffer(now, linesFrom(suggested)));
  }, [suggested]);
  return [state, setState];
};

interface IStudioPublishNoteProps {
  state: INoteLines;
  setState: Dispatch<SetStateAction<INoteLines>>;
  /** The language the member reads FluidEQ in, as a note's language. */
  mine: TVersionNoteLocale;
  running: boolean;
  /** Publish was pressed with no line. */
  missing: boolean;
  /** Something was typed after `missing`: the red line goes. */
  onFilled: () => void;
  /** The scene's chat is writing the line now. */
  writing: boolean;
  /** The scene's chat is writing the member's line in every language. */
  translating: number | undefined;
  /** Nothing could translate it: it goes out as written. */
  asWritten: boolean;
  noteRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * "What's new in this version", for an update: the member's own language
 * and English on show, every other language a fold-out away (Ivan,
 * 2026-11-12, approved picture). English is what a listener in a language
 * left out reads.
 */
export default function StudioPublishNote({
  state,
  setState,
  mine,
  running,
  missing,
  onFilled,
  writing,
  translating,
  asWritten,
  noteRef,
}: IStudioPublishNoteProps) {
  const { t } = useTranslation();
  const mineId = useId();
  const englishId = useId();
  const noteWrongId = useId();
  const shown: TVersionNoteLocale[] = mine === 'en' ? ['en'] : [mine, 'en'];
  const mineLine = state.lines[mine];
  // The member changed their own line and not the English one: English is
  // written again from theirs at Send, so the box says it follows, rather
  // than show a line that will not go out as it reads.
  const follows =
    mine !== 'en' &&
    sourceOf(state, mine) === mine &&
    toTranslate(state, mine).includes('en');
  const type = (locale: TVersionNoteLocale, text: string) => {
    // One line: what a card and a notice have room for.
    const line = text.replace(/\s*\n\s*/g, ' ');
    setState((now) => typeLine(now, locale, line));
    if (line.trim()) {
      onFilled();
    }
  };
  return (
    <div className="studio-publish__note">
      <span className="studio-publish__note-head">
        <span className="gallery-dialog__label" id={`${mineId}-label`}>
          {t('studio.publish.note')}
        </span>
        {/* Said before the press as well as after it: the quiet word is
            what stops the red one ever being needed. */}
        <span className="studio-publish__note-needed" aria-hidden="true">
          {t('studio.publish.noteNeeded')}
        </span>
        {/* Marked at the limit: the field stops taking letters silently,
            and a note that ends mid-sentence is one the author believed
            they had finished. */}
        <span
          className={`studio-publish__note-count${
            mineLine.length >= MAX_VERSION_NOTE
              ? ' studio-publish__note-count--full'
              : ''
          }`}
          aria-hidden="true"
        >
          {mineLine.length} / {MAX_VERSION_NOTE}
        </span>
      </span>
      {shown.map((locale) => {
        const id = locale === mine ? mineId : englishId;
        const isMine = locale === mine;
        return (
          <div key={locale} className="studio-publish__note-field">
            <label
              className="studio-publish__note-language"
              htmlFor={id}
              id={`${id}-language`}
            >
              {languageName(locale)}
              <span>
                {isMine && t('studio.publish.noteYours')}
                {!isMine &&
                  (follows
                    ? t('studio.publish.noteFollows')
                    : t('studio.publish.noteFallback'))}
              </span>
            </label>
            <textarea
              ref={isMine ? noteRef : undefined}
              id={id}
              className={!isMine && follows ? 'is-following' : undefined}
              aria-labelledby={`${mineId}-label ${id}-language`}
              value={state.lines[locale]}
              rows={2}
              maxLength={MAX_VERSION_NOTE}
              disabled={running || translating !== undefined}
              required={isMine}
              aria-required={isMine}
              aria-invalid={isMine && missing}
              aria-describedby={isMine && missing ? noteWrongId : undefined}
              placeholder={
                isMine ? t('studio.publish.notePlaceholder') : undefined
              }
              onChange={(event) => type(locale, event.target.value)}
            />
          </div>
        );
      })}
      <StudioPublishNoteLines
        state={state}
        shown={shown}
        disabled={running || translating !== undefined}
        asWritten={asWritten}
        pending={toTranslate(state, mine)}
        onType={type}
      />
      {translating !== undefined && (
        <div className="studio-publish__note-working" role="status">
          <strong>
            {t('studio.publish.noteTranslating', {
              count: String(translating),
            })}
          </strong>
          <span className="studio-publish__note-bar" aria-hidden="true">
            <i />
          </span>
          <span>{t('studio.publish.noteTranslatingHint')}</span>
        </div>
      )}
      {asWritten && (
        <p className="studio-publish__note-quiet">
          {t('studio.publish.noteNotTranslated')}
        </p>
      )}
      {/* The chat's own working mark: it is the chat writing it. */}
      {writing && !mineLine.trim() && !state.lines.en.trim() && (
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
