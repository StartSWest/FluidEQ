/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { IKaraokeMakerToken } from '../../common/karaoke/makerProject';
import {
  parseKaraokeText,
  readKaraokeTextFile,
} from '../../common/karaoke/files';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { TSelection } from './useKaraokeMakerSelection';
import {
  plainLyrics,
  useKaraokeMakerLyricsDraft,
} from './useKaraokeMakerLyricsDraft';
import { karaokeMakerLyricFocus } from './makerCanvasLayout';
import { TDestructiveMakerAction } from './KaraokeMakerConfirmDialog';

/**
 * Opening the lyrics, loading a file into them, and throwing work away.
 *
 * Four of these five destroy something: clearing the notes, clearing the
 * lyrics, restoring the original, and replacing the draft from a file. They are
 * together because they share the one confirmation — the component owns the
 * prompt, and each of these only names what it is about to destroy.
 *
 * openLyricsEditor is the odd one out and belongs here anyway: it seeds the
 * draft from whatever is currently timed, so it reads the same project state
 * the destructive four are about to discard.
 */
export interface IMakerLyricsActionsParams extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'commit' | 'projectRef'
> {
  tokens: IKaraokeMakerToken[];
  t: ReturnType<typeof useTranslation>['t'];
  setNotice: (message?: string) => void;
  localizeMakerError: (
    error: unknown,
    context: 'analysis' | 'export' | 'import' | 'whisper',
  ) => string;

  /** Which word the canvas is highlighting, so the draft opens on it. */
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;

  /** The draft, owned by the hook that persists it. */
  openLyricsDraft: ReturnType<typeof useKaraokeMakerLyricsDraft>['openEditor'];
  setLyricsDraft: Dispatch<SetStateAction<string>>;
  setLyricsFileName: Dispatch<SetStateAction<string | undefined>>;

  /** Puts back the project the Maker was opened with. */
  restoreOriginalProject: ReturnType<
    typeof useKaraokeMakerProject
  >['restoreOriginal'];
  setDestructiveAction: Dispatch<
    SetStateAction<TDestructiveMakerAction | undefined>
  >;
  setSelection: Dispatch<SetStateAction<TSelection>>;
  setSelectedNoteIds: Dispatch<SetStateAction<Set<string>>>;
}

export const useMakerLyricsActions = ({
  activeLyricFocus,
  commit,
  localizeMakerError,
  openLyricsDraft,
  projectRef,
  restoreOriginalProject,
  setDestructiveAction,
  setLyricsDraft,
  setLyricsFileName,
  setNotice,
  setSelectedNoteIds,
  setSelection,
  t,
  tokens,
}: IMakerLyricsActionsParams) => {
  const openLyricsEditor = () => {
    openLyricsDraft(projectRef.current);
    setDestructiveAction(undefined);
    const preferredToken =
      tokens.find((token) => token.id === activeLyricFocus?.tokenId) ??
      tokens[0];
    if (preferredToken) {
      setSelection({ kind: 'word', id: preferredToken.id });
    }
  };

  const clearNotes = () => {
    commit((current) => ({
      ...current,
      melody: { ...current.melody, source: 'manual', notes: [] },
    }));
    setSelection(undefined);
    setSelectedNoteIds(new Set());
    setDestructiveAction(undefined);
    setNotice(t('karaoke.maker.notesCleared'));
  };

  const clearLyrics = () => {
    commit((current) => ({
      ...current,
      lyrics: { ...current.lyrics, source: 'manual', lines: [] },
      analysis: {
        ...current.analysis,
        whisperPasses: 0,
        whisperAlignmentVersion: undefined,
      },
      melody: {
        ...current.melody,
        notes: current.melody.notes.map((note) => ({
          ...note,
          tokenId: undefined,
        })),
      },
    }));
    setLyricsDraft('');
    setLyricsFileName(undefined);
    setSelection(undefined);
    setDestructiveAction(undefined);
    setNotice(t('karaoke.maker.lyricsCleared'));
  };

  /**
   * Throw the editing away and rebuild the project the import produced.
   *
   * Undoable like the other destructive actions: `commit` leaves the discarded
   * work one Undo away, which is what the confirmation promises.
   *
   * The saved draft is deleted rather than left for autosave to overwrite.
   * Autosave does write the pristine project a moment later, but a user who
   * closes the Maker inside that moment would otherwise reopen onto the very
   * work they just discarded.
   */
  // The project half of Restore is the hook's; what is left here is the view
  // state that has to follow it back.
  const restoreOriginal = () => {
    const original = restoreOriginalProject();
    setLyricsDraft(plainLyrics(original));
    setLyricsFileName(undefined);
    setSelection(undefined);
    setSelectedNoteIds(new Set());
    setDestructiveAction(undefined);
    setNotice(t('karaoke.maker.restored'));
  };

  const selectLyricsFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const contents = await readKaraokeTextFile(file);
      let text = contents;
      try {
        const parsed = parseKaraokeText(file.name, contents);
        text = parsed.lines
          .map((line) =>
            line.tokens
              .reduce(
                (lineText, token) =>
                  `${lineText}${
                    lineText && token.startsWord !== false ? ' ' : ''
                  }${token.text}`,
                '',
              )
              .trim(),
          )
          .filter(Boolean)
          .join('\n');
      } catch {
        // Plain unsynchronised text is already a valid lyric reference.
      }
      setLyricsDraft(text);
      setLyricsFileName(file.name);
      setNotice(t('karaoke.maker.lyricsFileLoaded', { file: file.name }));
    } catch (error) {
      setNotice(localizeMakerError(error, 'import'));
    }
  };

  return {
    clearLyrics,
    clearNotes,
    openLyricsEditor,
    restoreOriginal,
    selectLyricsFile,
  };
};
