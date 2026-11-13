/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  readVersionNote,
  type TVersionNoteLocale,
  type TVersionNotes,
} from 'common/sceneVersionNote';
import {
  asWritten,
  linesFrom,
  notesOf,
  settleTranslation,
  sourceOf,
  toTranslate,
  type INoteLines,
} from './publishNoteLines';
import type { IPublishDraft } from './useStudioPublish';

type TSend = (notes: TVersionNotes | undefined) => void;

/**
 * Sending an update whose line is not yet in every language (Ivan,
 * 2026-11-12: the chat translates a line the member changed, "only if it
 * can, otherwise it just [puts] it on all other languages").
 *
 * Nothing is ever sent on the chat's behalf (Ivan, 2026-11-12: "it needs to
 * keep open, update the note text and enable the Send for review button at
 * that last moment"). It sent the publication itself when the reply ended,
 * and the dialog closed on a line the member never read. Now:
 * - while the chat writes or translates the line, Send is held and the
 *   progress shown, with "Stop waiting" as the way out;
 * - the reply's end (`noteTranslated`, set by `usePublishNote`) fills the
 *   boxes and gives Send back, and the member sends what they have read;
 * - a reply whose lines do not carry the member's line as they left it, or
 *   stopping the wait, leaves the boxes as they are with the quiet note, and
 *   Send then sends the line as written in every language;
 * - no chat to ask says the same at once.
 */
export default function usePublishNoteSend({
  draft,
  state,
  setState,
  mine,
  onTranslate,
}: {
  draft: IPublishDraft;
  state: INoteLines;
  setState: Dispatch<SetStateAction<INoteLines>>;
  mine: TVersionNoteLocale;
  onTranslate: (line: string, from: string) => Promise<boolean>;
}) {
  // A translation this dialog asked for whose reply has not been read yet.
  const awaiting = useRef(false);
  // The member stopped waiting on the chat; the draft's own marks stay as
  // main left them, and are read through this.
  const [stopped, setStopped] = useState(false);
  // Nothing translated the member's line: it goes as written.
  const [notTranslated, setNotTranslated] = useState(false);
  const live = useRef({ state, mine });
  live.current = { state, mine };
  const pending = toTranslate(state, mine);
  const translating = draft.noteTranslating === true && !stopped;
  const writing = draft.noteWriting === true && !stopped;
  const goesAsWritten = draft.noteAsWritten === true || notTranslated;

  // Only pressed while nothing is being written: the dialog holds Send then.
  const press = (send: TSend) => {
    if (pending.length === 0) {
      send(notesOf(state.lines));
      return;
    }
    if (goesAsWritten) {
      send(asWritten(state, mine));
      return;
    }
    // Handed to the chat; the press sends nothing. The member presses again
    // on the lines it writes.
    const source = sourceOf(state, mine);
    awaiting.current = true;
    setStopped(false);
    onTranslate(state.lines[source], source)
      .then((asked) => {
        // No chat to ask: `usePublishNote` marks the draft as written.
        if (!asked) {
          awaiting.current = false;
        }
        return undefined;
      })
      .catch(() => {
        awaiting.current = false;
        setNotTranslated(true);
      });
  };

  const stopWaiting = () => {
    setStopped(true);
    if (awaiting.current) {
      awaiting.current = false;
      setNotTranslated(true);
    }
  };

  const { noteTranslated, suggestedNotes } = draft;
  useEffect(() => {
    if (!noteTranslated || !awaiting.current) {
      return;
    }
    awaiting.current = false;
    const { state: now, mine: reader } = live.current;
    const source = sourceOf(now, reader);
    const offer = linesFrom(suggestedNotes);
    // The chat's lines are for the member's line only when they carry it as
    // the member left it; anything else is a set written for an older line.
    if (readVersionNote(offer[source]) === readVersionNote(now.lines[source])) {
      setState(settleTranslation(now, offer));
    } else {
      setNotTranslated(true);
    }
  }, [noteTranslated, suggestedNotes, setState]);

  return {
    press,
    stopWaiting,
    /** How many languages the chat is writing now, while it is. */
    translating: translating ? pending.length : undefined,
    /** The chat is writing the line itself now. */
    writing,
    /** The line goes in every language as written. */
    asWritten: goesAsWritten,
  };
}
