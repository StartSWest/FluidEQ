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

import { useEffect, useState } from 'react';
import {
  IKaraokeMakerNote,
  IKaraokeMakerToken,
} from '../../common/karaoke/makerProject';
import { IKaraokeMakerEditorView } from './karaokeEditorPersistence';

export type TSelection =
  { kind: 'word'; id: string } | { kind: 'note'; id: string } | undefined;

interface IUseKaraokeMakerSelection {
  /** Seeds the first selection, so reopening lands where you left off. */
  initialEditorView: IKaraokeMakerEditorView | undefined;
  /** The words currently in the project, for noticing a selection that died. */
  tokens: IKaraokeMakerToken[];
  notes: IKaraokeMakerNote[];
  /** Until the draft decision is made, nothing on screen is final. */
  draftReady: boolean;
}

/**
 * What is selected, and everything that has to stay true about it.
 *
 * The state was four `useState` calls; the rules that keep it honest were three
 * effects eight hundred lines further down, interleaved with notices and
 * analysis. Together they are one idea:
 *
 *  - A selection whose word or note no longer exists is cleared. Deleting the
 *    selected note used to leave the inspector describing something gone.
 *  - The multi-note set follows the single selection: emptied when the
 *    selection is not a note, and pruned of ids the project no longer has.
 *  - Ctrl is watched only while a note is selected, because the only thing that
 *    key does here is arm linking a note to a lyric. The listener is torn down
 *    the moment the selection changes to anything else, so it is not a
 *    keyboard hook the app carries for the whole session.
 *
 * The blur listener matters more than it looks: Ctrl held while the window
 * loses focus never sends its keyup, so without it the editor stays armed for a
 * gesture the user has walked away from.
 */
export const useKaraokeMakerSelection = ({
  initialEditorView,
  tokens,
  notes,
  draftReady,
}: IUseKaraokeMakerSelection) => {
  const [selection, setSelection] = useState<TSelection>(
    initialEditorView?.selection,
  );
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() =>
    initialEditorView?.selection?.kind === 'note'
      ? new Set([initialEditorView.selection.id])
      : new Set(),
  );
  const [copiedNotes, setCopiedNotes] = useState<IKaraokeMakerNote[]>([]);
  const [controlLinkMode, setControlLinkMode] = useState(false);

  useEffect(() => {
    if (selection?.kind !== 'note') {
      setControlLinkMode(false);
      return undefined;
    }
    const setControlIndicator = (event: KeyboardEvent) => {
      if (
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight' ||
        event.key === 'Control'
      ) {
        setControlLinkMode(event.type === 'keydown');
      }
    };
    const clearControlIndicator = () => setControlLinkMode(false);
    window.addEventListener('keydown', setControlIndicator, true);
    window.addEventListener('keyup', setControlIndicator, true);
    window.addEventListener('blur', clearControlIndicator);
    return () => {
      window.removeEventListener('keydown', setControlIndicator, true);
      window.removeEventListener('keyup', setControlIndicator, true);
      window.removeEventListener('blur', clearControlIndicator);
    };
  }, [selection?.kind]);

  useEffect(() => {
    if (!draftReady || !selection) {
      return;
    }
    const selectionExists =
      selection.kind === 'word'
        ? tokens.some((token) => token.id === selection.id)
        : notes.some((note) => note.id === selection.id);
    if (!selectionExists) {
      setSelection(undefined);
    }
  }, [draftReady, notes, selection, tokens]);

  useEffect(() => {
    if (selection?.kind !== 'note') {
      if (selectedNoteIds.size) {
        setSelectedNoteIds(new Set());
      }
      return;
    }
    const existingIds = new Set(notes.map((note) => note.id));
    setSelectedNoteIds((current) => {
      const next = new Set(
        [...current].filter((noteId) => existingIds.has(noteId)),
      );
      if (existingIds.has(selection.id)) {
        next.add(selection.id);
      }
      // Returning `current` unchanged when nothing moved is what stops this
      // from re-rendering forever: the set is rebuilt every run, so a new
      // object is always a different object.
      return next.size === current.size &&
        [...next].every((noteId) => current.has(noteId))
        ? current
        : next;
    });
  }, [notes, selectedNoteIds.size, selection]);

  return {
    selection,
    setSelection,
    selectedNoteIds,
    setSelectedNoteIds,
    copiedNotes,
    setCopiedNotes,
    controlLinkMode,
  };
};
