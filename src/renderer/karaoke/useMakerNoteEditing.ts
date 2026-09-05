/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, SetStateAction, useCallback, useEffect } from 'react';
import {
  IKaraokeMakerNote,
  IKaraokeMakerToken,
  karaokeMakerId,
  splitKaraokeMakerWordIntoSyllables,
} from '../../common/karaoke/makerProject';
import { splitKaraokeWordSyllables } from '../../common/karaoke/syllables';
import { useTranslation } from '../utils/I18nContext';
import useKaraokeMakerProject from './useKaraokeMakerProject';
import { useKaraokeMakerSelection } from './useKaraokeMakerSelection';
import {
  karaokeMakerWordTokensFor,
  replaceNote,
  syllablesAtCutPoints,
} from './makerProjectEdits';

/** A word being cut into syllables, with the cuts the user has placed so far. */
export interface ISyllableSplitDraft {
  tokenId: string;
  word: string;
  cutPoints: number[];
}

/**
 * Changing what is already there: splitting, deleting, copying and pasting.
 *
 * Three hundred lines of one component, and the one part of it that only ever
 * edits — no playback, no models, no canvas arithmetic. Each of these takes the
 * current selection, produces a new project, and commits it, which is why they
 * came out together and why the list below is mostly selection and history.
 *
 * The keyboard bindings for delete and paste live here too. They are the same
 * operations reached a different way, and leaving them behind would have split
 * one behaviour across two files.
 */
export interface IMakerNoteEditingParams
  extends
    Pick<ReturnType<typeof useKaraokeMakerProject>, 'project' | 'commit'>,
    Pick<
      ReturnType<typeof useKaraokeMakerSelection>,
      | 'selection'
      | 'setSelection'
      | 'selectedNoteIds'
      | 'setSelectedNoteIds'
      | 'copiedNotes'
      | 'setCopiedNotes'
    > {
  selectedNote: IKaraokeMakerNote | undefined;
  selectedToken: IKaraokeMakerToken | undefined;
  t: ReturnType<typeof useTranslation>['t'];

  /**
   * The word being cut, if one is.
   *
   * Owned by the component because the dialog that shows the cuts is rendered
   * there; this hook starts the draft and applies it, but does not display it.
   */
  syllableSplitDraft: ISyllableSplitDraft | undefined;
  setSyllableSplitDraft: Dispatch<
    SetStateAction<ISyllableSplitDraft | undefined>
  >;

  /** Where a paste lands, and how far it may reach. */
  playheadMs: number;
  readPlayheadMs?: () => number;
  effectiveDurationMs: number;

  /** Keyboard editing is off while a capture is running — see the effects. */
  lineEntryMode: boolean;
  setNotice: (message?: string) => void;
}

export const useMakerNoteEditing = ({
  commit,
  copiedNotes,
  effectiveDurationMs,
  lineEntryMode,
  playheadMs,
  project,
  readPlayheadMs,
  selectedNote,
  selectedNoteIds,
  selectedToken,
  selection,
  setCopiedNotes,
  setNotice,
  setSelectedNoteIds,
  setSelection,
  setSyllableSplitDraft,
  syllableSplitDraft,
  t,
}: IMakerNoteEditingParams) => {
  const splitSelectedLyricsWord = () => {
    const tokenId = selectedToken?.id ?? selectedNote?.tokenId;
    if (!tokenId) {
      return;
    }
    const wordTokens = karaokeMakerWordTokensFor(project, tokenId);
    const word = wordTokens.map((token) => token.text).join('');
    const characters = Array.from(word);
    if (characters.length < 2) {
      return;
    }
    const existingCutPoints = wordTokens
      .slice(0, -1)
      .reduce<number[]>((points, token) => {
        const previous = points[points.length - 1] ?? 0;
        points.push(previous + Array.from(token.text).length);
        return points;
      }, []);
    const suggestedSyllables = splitKaraokeWordSyllables(
      word,
      project.lyrics.language ?? 'en',
    );
    const suggestedCutPoints = suggestedSyllables
      .slice(0, -1)
      .reduce<number[]>((points, syllable) => {
        const previous = points[points.length - 1] ?? 0;
        points.push(previous + Array.from(syllable).length);
        return points;
      }, []);
    setSyllableSplitDraft({
      tokenId: wordTokens[0].id,
      word,
      cutPoints:
        existingCutPoints.length > 0 ? existingCutPoints : suggestedCutPoints,
    });
  };

  const toggleSyllableCutPoint = (cutPoint: number) => {
    setSyllableSplitDraft((current) => {
      if (!current) {
        return current;
      }
      const next = new Set(current.cutPoints);
      if (next.has(cutPoint)) {
        next.delete(cutPoint);
      } else {
        next.add(cutPoint);
      }
      return { ...current, cutPoints: [...next].sort((a, b) => a - b) };
    });
  };

  const applySyllableSplit = () => {
    if (!syllableSplitDraft) {
      return;
    }
    const syllables = syllablesAtCutPoints(
      syllableSplitDraft.word,
      syllableSplitDraft.cutPoints,
    );
    if (syllables.length < 2) {
      return;
    }
    commit((current) =>
      splitKaraokeMakerWordIntoSyllables(
        current,
        syllableSplitDraft.tokenId,
        current.lyrics.language ?? 'en',
        syllables,
      ),
    );
    setSelection({ kind: 'word', id: syllableSplitDraft.tokenId });
    setSyllableSplitDraft(undefined);
  };

  const splitNote = () => {
    if (!selectedNote) {
      return;
    }
    const splitAt =
      playheadMs > selectedNote.startMs + 40 &&
      playheadMs < selectedNote.endMs - 40
        ? playheadMs
        : (selectedNote.startMs + selectedNote.endMs) / 2;
    const second: IKaraokeMakerNote = {
      ...selectedNote,
      id: karaokeMakerId('note'),
      startMs: splitAt,
      source: 'manual',
    };
    commit((current) => {
      const first = replaceNote(current, selectedNote.id, (note) => ({
        ...note,
        endMs: splitAt,
        source: 'manual',
      }));
      return {
        ...first,
        melody: {
          ...first.melody,
          source: 'manual',
          notes: [...first.melody.notes, second],
        },
      };
    });
    setSelection({ kind: 'note', id: second.id });
  };

  const deleteSelection = useCallback(() => {
    if (!selection) {
      return;
    }
    if (selection.kind === 'note') {
      const noteIds = selectedNoteIds.size
        ? selectedNoteIds
        : new Set([selection.id]);
      commit((current) => ({
        ...current,
        melody: {
          ...current.melody,
          source: 'manual',
          notes: current.melody.notes.filter((note) => !noteIds.has(note.id)),
        },
      }));
    } else {
      commit((current) => ({
        ...current,
        lyrics: {
          ...current.lyrics,
          lines: current.lyrics.lines
            .map((line) => ({
              ...line,
              tokens: line.tokens.filter((token) => token.id !== selection.id),
            }))
            .filter((line) => line.tokens.length),
        },
        melody: {
          ...current.melody,
          notes: current.melody.notes.map((note) =>
            note.tokenId === selection.id
              ? { ...note, tokenId: undefined }
              : note,
          ),
        },
      }));
    }
    setSelection(undefined);
    setSelectedNoteIds(new Set());
  }, [commit, selectedNoteIds, selection, setSelectedNoteIds, setSelection]);

  const detachSelectedNotes = useCallback(() => {
    const noteIds = new Set(selectedNoteIds);
    if (!noteIds.size && selection?.kind === 'note') {
      noteIds.add(selection.id);
    }
    if (!noteIds.size) {
      return;
    }
    commit((current) => ({
      ...current,
      melody: {
        ...current.melody,
        source: 'manual',
        notes: current.melody.notes.map((note) =>
          noteIds.has(note.id)
            ? { ...note, tokenId: undefined, source: 'manual' as const }
            : note,
        ),
      },
    }));
  }, [commit, selectedNoteIds, selection]);

  const copySelectedNotes = useCallback(() => {
    const noteIds = new Set(selectedNoteIds);
    if (!noteIds.size && selection?.kind === 'note') {
      noteIds.add(selection.id);
    }
    if (!noteIds.size) {
      return;
    }
    setCopiedNotes(
      project.melody.notes
        .filter((note) => noteIds.has(note.id))
        .sort((left, right) => left.startMs - right.startMs)
        .map((note) => ({ ...note })),
    );
  }, [
    project.melody.notes,
    selectedNoteIds,
    selection?.id,
    selection?.kind,
    setCopiedNotes,
  ]);

  const pasteCopiedNotes = useCallback(() => {
    if (!copiedNotes.length) {
      return;
    }
    const anchorMs = Math.max(
      0,
      Math.min(effectiveDurationMs, readPlayheadMs?.() ?? playheadMs),
    );
    const sourceStartMs = Math.min(...copiedNotes.map((note) => note.startMs));
    const pastedNotes = copiedNotes.flatMap((note) => {
      const startMs = anchorMs + (note.startMs - sourceStartMs);
      if (startMs >= effectiveDurationMs) {
        return [];
      }
      const endMs = Math.min(
        effectiveDurationMs,
        Math.max(startMs + 1, startMs + (note.endMs - note.startMs)),
      );
      return [
        {
          ...note,
          id: karaokeMakerId('note'),
          tokenId: undefined,
          startMs,
          endMs,
          source: 'manual' as const,
        },
      ];
    });
    if (!pastedNotes.length) {
      return;
    }
    commit((current) => {
      return {
        ...current,
        melody: {
          ...current.melody,
          source: 'manual',
          notes: [...current.melody.notes, ...pastedNotes].sort(
            (left, right) => left.startMs - right.startMs,
          ),
        },
      };
    });
    setSelectedNoteIds(new Set(pastedNotes.map((note) => note.id)));
    setSelection({ kind: 'note', id: pastedNotes[0].id });
    setNotice(
      pastedNotes.length === 1
        ? t('karaoke.maker.notePasted')
        : t('karaoke.maker.notesPasted', { count: pastedNotes.length }),
    );
  }, [
    commit,
    copiedNotes,
    effectiveDurationMs,
    playheadMs,
    readPlayheadMs,
    setNotice,
    setSelectedNoteIds,
    setSelection,
    t,
  ]);

  useEffect(() => {
    const copyOrPasteNotes = (event: KeyboardEvent) => {
      if (
        lineEntryMode ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.matches(
            'input, textarea, select, [contenteditable="true"]',
          ))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'c' && selection?.kind === 'note') {
        event.preventDefault();
        event.stopImmediatePropagation();
        copySelectedNotes();
      } else if (key === 'v' && copiedNotes.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pasteCopiedNotes();
      }
    };
    window.addEventListener('keydown', copyOrPasteNotes, true);
    return () => window.removeEventListener('keydown', copyOrPasteNotes, true);
  }, [
    copiedNotes.length,
    copySelectedNotes,
    lineEntryMode,
    pasteCopiedNotes,
    selection?.kind,
  ]);

  useEffect(() => {
    const deleteSelectedNotes = (event: KeyboardEvent) => {
      if (
        lineEntryMode ||
        selection?.kind !== 'note' ||
        (event.key !== 'Delete' && event.key !== 'Backspace') ||
        (event.target instanceof HTMLElement &&
          event.target.matches(
            'button, input, textarea, select, [contenteditable="true"]',
          ))
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSelection();
    };
    window.addEventListener('keydown', deleteSelectedNotes, true);
    return () =>
      window.removeEventListener('keydown', deleteSelectedNotes, true);
  }, [deleteSelection, lineEntryMode, selection?.kind]);

  return {
    applySyllableSplit,
    copySelectedNotes,
    deleteSelection,
    detachSelectedNotes,
    pasteCopiedNotes,
    splitNote,
    splitSelectedLyricsWord,
    toggleSyllableCutPoint,
  };
};
