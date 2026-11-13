/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
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
 * The press hands the member's line to the scene's chat and holds the
 * publication; the reply's end (`noteTranslated`, set by `usePublishNote`)
 * is what sends it, with the chat's lines where it wrote them for the line
 * the member left, and the line as written everywhere else. No chat to ask
 * leaves the dialog saying the line goes as written, for the next press.
 * "Send as written" sends at once, without the chat's answer.
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
  const waiting = useRef<TSend | undefined>(undefined);
  const live = useRef({ state, mine });
  live.current = { state, mine };
  const pending = toTranslate(state, mine);

  const press = (send: TSend) => {
    if (waiting.current) {
      return;
    }
    if (pending.length === 0) {
      send(notesOf(state.lines));
      return;
    }
    if (draft.noteAsWritten) {
      send(asWritten(state, mine));
      return;
    }
    const source = sourceOf(state, mine);
    waiting.current = send;
    onTranslate(state.lines[source], source)
      .then((asked) => {
        if (!asked) {
          waiting.current = undefined;
        }
        return undefined;
      })
      .catch(() => {
        waiting.current = undefined;
      });
  };

  const sendAsWritten = () => {
    const send = waiting.current;
    waiting.current = undefined;
    send?.(asWritten(live.current.state, live.current.mine));
  };

  const { noteTranslated, suggestedNotes } = draft;
  useEffect(() => {
    const send = waiting.current;
    if (!noteTranslated || !send) {
      return;
    }
    waiting.current = undefined;
    const { state: now, mine: reader } = live.current;
    const source = sourceOf(now, reader);
    const offer = linesFrom(suggestedNotes);
    // The chat's lines are for the member's line only when they carry it as
    // the member left it; anything else is a set written for an older line.
    const fresh =
      readVersionNote(offer[source]) === readVersionNote(now.lines[source]);
    const settled = fresh ? settleTranslation(now, offer) : now;
    setState(settled);
    send(asWritten(settled, reader));
  }, [noteTranslated, suggestedNotes, setState]);

  return {
    press,
    sendAsWritten,
    /** How many languages the chat is writing now, while it is. */
    translating: draft.noteTranslating ? pending.length : undefined,
  };
}
