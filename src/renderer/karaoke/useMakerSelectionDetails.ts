/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import {
  type IKaraokeMakerProject,
  karaokeMakerProjectToSong,
  karaokeMakerTokenBoundaryLimits,
  recordKaraokeMakerLineRange,
} from '../../common/karaoke/makerProject';
import { type IGuidedLineCapture } from './useMakerLineCapture';
import { type IKaraokeSong } from '../../common/karaoke/types';
import { type TSelection } from './useKaraokeMakerSelection';
import {
  type IKaraokeMakerLine,
  type IKaraokeMakerToken,
} from '../../common/karaoke/makerProject/model';

interface IMakerSelectionDetailsInput {
  selection: TSelection;
  tokens: IKaraokeMakerToken[];
  project: IKaraokeMakerProject;
  lineEntryCapture: IGuidedLineCapture | undefined;
  lyricLines: IKaraokeMakerLine[];
  song: IKaraokeSong;
}

/**
 * What the selection is and what it allows: the selected word or note and
 * the word a note sings, the bounds a selected word's timing may move
 * within, and the project and song the live preview shows — with the line
 * being recorded drawn where it will land before it is committed.
 */
const useMakerSelectionDetails = ({
  selection,
  tokens,
  project,
  lineEntryCapture,
  lyricLines,
  song,
}: IMakerSelectionDetailsInput) => {
  const selectedToken =
    selection?.kind === 'word'
      ? tokens.find((token) => token.id === selection.id)
      : undefined;
  const selectedNote =
    selection?.kind === 'note'
      ? project.melody.notes.find((note) => note.id === selection.id)
      : undefined;
  const selectedNoteToken = selectedNote?.tokenId
    ? tokens.find((token) => token.id === selectedNote.tokenId)
    : undefined;
  const selectedTokenTimingControls = useMemo(() => {
    if (
      !selectedToken ||
      selectedToken.startMs === undefined ||
      selectedToken.endMs === undefined
    ) {
      return undefined;
    }
    const startLimits = karaokeMakerTokenBoundaryLimits(
      project,
      selectedToken.id,
      'start',
    );
    const endLimits = karaokeMakerTokenBoundaryLimits(
      project,
      selectedToken.id,
      'end',
    );
    const canResizeStart =
      startLimits !== undefined &&
      startLimits.minimumMs <= startLimits.maximumMs;
    const canResizeEnd =
      endLimits !== undefined && endLimits.minimumMs <= endLimits.maximumMs;
    return {
      startMs: selectedToken.startMs,
      endMs: selectedToken.endMs,
      durationMs: selectedToken.endMs - selectedToken.startMs,
      canResizeStart,
      canResizeEnd,
      minimumStartMs: canResizeStart
        ? startLimits.minimumMs
        : selectedToken.startMs,
      maximumStartMs: canResizeStart
        ? startLimits.maximumMs
        : selectedToken.startMs,
      minimumDurationMs: 20,
      maximumDurationMs: canResizeEnd
        ? endLimits.maximumMs - selectedToken.startMs
        : selectedToken.endMs - selectedToken.startMs,
    };
  }, [project, selectedToken]);

  const canShiftFromWord = selectedToken?.startMs !== undefined;
  const previewProject = useMemo(() => {
    if (!lineEntryCapture) {
      return project;
    }
    const capturedLineIndex = lyricLines.findIndex(
      (line) => line.id === lineEntryCapture.lineId,
    );
    return recordKaraokeMakerLineRange(
      project,
      lineEntryCapture.lineId,
      lineEntryCapture.startMs,
      lineEntryCapture.estimatedEndMs,
      lyricLines[capturedLineIndex - 1]?.id,
      lineEntryCapture.wordBoundariesMs,
    );
  }, [lineEntryCapture, lyricLines, project]);
  const previewSong = useMemo(() => {
    const audioAsset = song.assets.find((asset) => asset.role === 'audio');
    return audioAsset
      ? karaokeMakerProjectToSong(previewProject, audioAsset, song.assets)
      : song;
  }, [previewProject, song]);

  return {
    selectedToken,
    selectedNote,
    selectedNoteToken,
    selectedTokenTimingControls,
    canShiftFromWord,
    previewSong,
  };
};

export default useMakerSelectionDetails;
