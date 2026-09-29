/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import {
  IKaraokeMakerProject,
  shiftKaraokeMakerLineTailFromToken,
  shiftKaraokeMakerTimeline,
} from '../../common/karaoke/makerProject';
import { flattenTokens } from './makerProjectEdits';
import { type IKaraokeMakerToken } from '../../common/karaoke/makerProject/model';

interface IMakerTimelineShiftInput {
  timingScope: 'all' | 'from-word';
  selectedToken: IKaraokeMakerToken | undefined;
  project: IKaraokeMakerProject;
  commit: (
    edit: (current: IKaraokeMakerProject) => IKaraokeMakerProject,
  ) => void;
  setWordShiftMs: Dispatch<SetStateAction<number>>;
  canShiftFromWord: boolean;
  setTimingScope: Dispatch<SetStateAction<'all' | 'from-word'>>;
}

/**
 * Nudging the timing: the whole song, or from the selected word to the end
 * of its line, with every moved word and note marked as set by hand. The
 * shift shown for a word counts from when it was selected.
 */
const useMakerTimelineShift = ({
  timingScope,
  selectedToken,
  project,
  commit,
  setWordShiftMs,
  canShiftFromWord,
  setTimingScope,
}: IMakerTimelineShiftInput) => {
  const shiftTimeline = useCallback(
    (deltaMs: number) => {
      if (timingScope === 'from-word' && selectedToken) {
        const shiftSelected = (current: IKaraokeMakerProject) =>
          shiftKaraokeMakerLineTailFromToken(
            current,
            selectedToken.id,
            deltaMs,
          );
        const previewShift = shiftSelected(project);
        const shiftedStart = flattenTokens(previewShift).find(
          (token) => token.id === selectedToken.id,
        )?.startMs;
        const effectiveDelta =
          selectedToken.startMs !== undefined && shiftedStart !== undefined
            ? shiftedStart - selectedToken.startMs
            : 0;
        commit(shiftSelected);
        setWordShiftMs((offset) => offset + effectiveDelta);
        return;
      }
      commit((current) => {
        const shifted = shiftKaraokeMakerTimeline(current, deltaMs);
        return {
          ...shifted,
          lyrics: {
            ...shifted.lyrics,
            source: 'manual',
            lines: shifted.lyrics.lines.map((line) => ({
              ...line,
              tokens: line.tokens.map((token) =>
                token.startMs !== undefined && token.endMs !== undefined
                  ? { ...token, source: 'manual', timingLocked: true }
                  : token,
              ),
            })),
          },
          melody: {
            ...shifted.melody,
            source: 'manual',
            notes: shifted.melody.notes.map((note) => ({
              ...note,
              source: 'manual',
            })),
          },
        };
      });
    },
    [commit, project, selectedToken, setWordShiftMs, timingScope],
  );

  useEffect(() => {
    setWordShiftMs(0);
  }, [selectedToken?.id, setWordShiftMs]);

  useEffect(() => {
    if (timingScope === 'from-word' && !canShiftFromWord) {
      setTimingScope('all');
    }
  }, [canShiftFromWord, setTimingScope, timingScope]);

  return { shiftTimeline };
};

export default useMakerTimelineShift;
