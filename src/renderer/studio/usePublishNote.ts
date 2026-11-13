/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { readVersionNote, type TVersionNotes } from 'common/sceneVersionNote';
import { isOldNote, type IStudioNotes } from 'common/studioNotes';
import {
  askStudioChatForNote,
  askStudioChatToTranslateNote,
} from './chat/studioChatStore';
import type { IPublishDraft } from './useStudioPublish';

/**
 * The publish dialog's "What's new" line arrives written (Ivan, 2026-11-12:
 * "I want to avoid user typing manually", "we need to load that in that
 * field if exists in notes"), in every language the chat wrote it in, each
 * listener reading their own. The notes were read once, at the press, so a
 * line the member's AI wrote after it never reached the box; and an update
 * whose notes held none opened empty, with only the red "say what is new"
 * to show for it.
 *
 * While the dialog is open, every reply the project's chat finishes has the
 * notes read again, and the lines they carry are offered (the dialog keeps
 * what the member typed: `publishNoteLines.ts`). A publication that opens
 * with no line, a first version as much as an update, asks the scene's chat
 * to write one, shown as being written until
 * that reply ends. A line the member changed is handed to the chat to write
 * in every language at Send (`translate`), and the reply's end is the
 * signal the dialog sends on: never a wait of its own.
 */

/**
 * The lines the notes offer for this publication: none when they are older
 * than the gallery's version (`isOldNote`), which is the last version's line
 * and would go out again as this one's unread. Notes written before 2.5
 * hold the English line alone.
 */
export const notesToOffer = (
  notes: IStudioNotes | undefined,
  published: IPublishDraft['published'],
): TVersionNotes | undefined => {
  const galleryAt = published ? Date.parse(published.updatedAt) : Number.NaN;
  if (isOldNote(notes, Number.isFinite(galleryAt) ? galleryAt : undefined)) {
    return undefined;
  }
  if (notes?.whatsNewLines) {
    return notes.whatsNewLines;
  }
  if (notes?.whatsNew) {
    return { en: notes.whatsNew };
  }
  // A scene never published has no change to name, and an AI told to write
  // its notes put what the scene is under "description" (2026-11-13). Short
  // enough to be a line, it is the first version's line to start from.
  const described = published ? null : readVersionNote(notes?.description);
  return typeof described === 'string' ? { en: described } : undefined;
};

/**
 * The draft's word on the notes as just read: their line when they offer
 * one, and whether they hold a line FluidEQ cannot use, which the dialog
 * says rather than leaving the box empty with nothing to explain it.
 */
export const noteFieldsOf = (
  notes: IStudioNotes | undefined,
  published: IPublishDraft['published'],
): Pick<IPublishDraft, 'suggestedNotes' | 'noteUnreadable'> => {
  const offered = notesToOffer(notes, published);
  return {
    ...(offered ? { suggestedNotes: offered } : {}),
    noteUnreadable: !offered && notes?.whatsNewUnreadable === true,
  };
};

export default function usePublishNote(
  draft: IPublishDraft | undefined,
  currentDraft: MutableRefObject<IPublishDraft | undefined>,
  setDraft: (next: IPublishDraft | undefined) => void,
  projectId: string | undefined,
) {
  const open = draft !== undefined;
  // Each opening of the dialog: an answer to an earlier one is not this one's.
  const opening = useRef(0);

  useEffect(() => {
    if (!open || !projectId) {
      return undefined;
    }
    opening.current += 1;
    const mine = opening.current;
    const still = () =>
      opening.current === mine ? currentDraft.current : undefined;
    // Whether the chat took FluidEQ's ask for the line in this opening. A
    // chat answering something else when the dialog opened refuses it, and
    // nothing asked again: the reply ended, the box stayed empty and Send
    // stayed held (2026-11-13). So every reply's end asks again, until one
    // ask has gone - never twice, or a chat that wrote nothing would be
    // asked for ever.
    let asked = false;
    const ask = () => {
      const now = still();
      if (asked || !now || now.suggestedNotes) {
        return;
      }
      // Every publication: a first version's line says what the scene is.
      askStudioChatForNote({ first: !now.published })
        .then((went) => {
          const later = still();
          if (went) {
            asked = true;
            if (later && !later.suggestedNotes) {
              setDraft({ ...later, noteWriting: true });
            }
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    const api = window.electron?.ipcRenderer;
    const reread = (replyEnded: boolean) =>
      (api?.readStudioNotes?.(projectId) ?? Promise.resolve(undefined))
        .then((notes) => {
          const now = still();
          if (!now) {
            return undefined;
          }
          const read = noteFieldsOf(notes, now.published);
          setDraft({
            ...now,
            ...read,
            // Offered or not, a reply's end means nothing is being written.
            ...(replyEnded || read.suggestedNotes
              ? { noteWriting: false }
              : {}),
            // A translation's reply ended, whatever it wrote: the dialog
            // sends what it has now (`StudioPublishDialog`).
            ...(replyEnded && now.noteTranslating
              ? { noteTranslating: false, noteTranslated: true }
              : {}),
          });
          return undefined;
        })
        .catch(() => undefined);
    ask();
    const stopEntries = api?.onStudioChatEntry?.(
      ({ projectId: from, entry }) => {
        if (
          from !== projectId ||
          entry.kind !== 'claude' ||
          entry.state === 'working'
        ) {
          return;
        }
        reread(true)
          .then(ask)
          .catch(() => undefined);
      },
    );
    // Written by anyone - the chat's tool, another AI, the member's editor -
    // the line reaches the box at once, with no reopen.
    const stopNotes = api?.onStudioNotesChanged?.((from) => {
      if (from === projectId) {
        reread(false).catch(() => undefined);
      }
    });
    return () => {
      opening.current += 1;
      stopEntries?.();
      stopNotes?.();
    };
  }, [open, projectId, currentDraft, setDraft]);

  /**
   * The member's changed line handed to the scene's chat to write in every
   * language. False when there is no chat to ask, or it is answering
   * something else: the dialog then says the line goes as written.
   */
  const translate = useCallback(
    (line: string, from: string) =>
      askStudioChatToTranslateNote(line, from)
        .catch(() => false)
        .then((asked) => {
          const now = currentDraft.current;
          if (now) {
            setDraft(
              asked
                ? { ...now, noteTranslating: true, noteTranslated: false }
                : { ...now, noteAsWritten: true },
            );
          }
          return asked;
        }),
    [currentDraft, setDraft],
  );

  return { translate };
}
