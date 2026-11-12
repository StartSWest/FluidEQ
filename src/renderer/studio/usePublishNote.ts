/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, type MutableRefObject } from 'react';
import { askStudioChatForNote } from './chat/studioChatStore';
import type { IPublishDraft } from './useStudioPublish';

/**
 * The publish dialog's "What's new" line arrives written (Ivan, 2026-11-12:
 * "I want to avoid user typing manually", "we need to load that in that
 * field if exists in notes"). The notes were read once, at the press, so a
 * line the member's AI wrote after it never reached the box; and an update
 * whose notes held none opened empty, with only the red "say what is new"
 * to show for it.
 *
 * While the dialog is open, every reply the project's chat finishes has the
 * notes read again, and the line they carry is offered (the dialog keeps
 * what the member typed: `StudioPublishDialog`). An update that opens with
 * no line asks the scene's chat to write one, shown as being written until
 * that reply ends.
 */
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
    const opened = currentDraft.current;
    if (opened?.published && !opened.suggestedNote) {
      askStudioChatForNote()
        .then((asked) => {
          const now = still();
          if (asked && now && !now.suggestedNote) {
            setDraft({ ...now, noteWriting: true });
          }
          return undefined;
        })
        .catch(() => undefined);
    }
    const api = window.electron?.ipcRenderer;
    const stop = api?.onStudioChatEntry?.(({ projectId: from, entry }) => {
      if (
        from !== projectId ||
        entry.kind !== 'claude' ||
        entry.state === 'working'
      ) {
        return;
      }
      (api.readStudioNotes?.(projectId) ?? Promise.resolve(undefined))
        .then((notes) => {
          const now = still();
          if (!now) {
            return undefined;
          }
          const line = notes?.whatsNew;
          setDraft({
            ...now,
            ...(line ? { suggestedNote: line } : {}),
            noteWriting: false,
          });
          return undefined;
        })
        .catch(() => undefined);
    });
    return () => {
      opening.current += 1;
      stop?.();
    };
  }, [open, projectId, currentDraft, setDraft]);
}
