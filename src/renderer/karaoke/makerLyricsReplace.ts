/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  makerLinesFromPlainText,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { reconcileKaraokeMakerLyrics } from './makerLyricsReconcile';
import {
  normalizedLyricsText,
  plainLyrics,
} from './useKaraokeMakerLyricsDraft';
import {
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from './makerAlignment';
import { flattenTokens } from './makerProjectEdits';
import { type TDestructiveMakerAction } from './KaraokeMakerConfirmDialog';
import { type IKaraokeMakerAnalysisNote } from './makerAnalysis';
import { type Translate } from '../../common/i18n';
import { type TSelection } from './useKaraokeMakerSelection';

interface IMakerLyricsReplaceInput {
  beginLineCapture: ({
    lineIndex,
    tokenId,
    seekMs,
    viewStartMs,
  }: {
    lineIndex: number;
    tokenId: string;
    seekMs?: number;
    viewStartMs?: number;
  }) => void;
  projectRef: RefObject<IKaraokeMakerProject>;
  lyricsDraft: string;
  setNotice: (message?: string) => void;
  t: Translate;
  destructiveAction: TDestructiveMakerAction | undefined;
  setDestructiveAction: Dispatch<
    SetStateAction<TDestructiveMakerAction | undefined>
  >;
  setLyricsOpen: Dispatch<SetStateAction<boolean>>;
  lyricsWorkflowActiveRef: RefObject<boolean>;
  setLyricsWorkflowActive: Dispatch<SetStateAction<boolean>>;
  prepareAfterWhisperRef: RefObject<boolean>;
  requestWhisper: (
    continueWithMelody: boolean,
    repairMissingTiming?: boolean,
  ) => Promise<void>;
  pushHistory: (snapshot: IKaraokeMakerProject) => void;
  setProject: Dispatch<SetStateAction<IKaraokeMakerProject>>;
  setSelection: Dispatch<SetStateAction<TSelection>>;
  analysisNotes: IKaraokeMakerAnalysisNote[] | undefined;
  project: IKaraokeMakerProject;
  setAnalysisNotes: Dispatch<
    SetStateAction<IKaraokeMakerAnalysisNote[] | undefined>
  >;
}

/**
 * Putting the lyric editor's draft into the project: kept word timings
 * where the edit can be tracked, a confirmation before throwing timings
 * away, the melody re-aligned to the new words, and then whatever the
 * press asked for next — detection, recording lines, or closing the editor.
 * Built on every render from the editor's state; the handlers read the
 * current project through its ref, as they did inside the component.
 */
const makerLyricsReplace = ({
  beginLineCapture,
  projectRef,
  lyricsDraft,
  setNotice,
  t,
  destructiveAction,
  setDestructiveAction,
  setLyricsOpen,
  lyricsWorkflowActiveRef,
  setLyricsWorkflowActive,
  prepareAfterWhisperRef,
  requestWhisper,
  pushHistory,
  setProject,
  setSelection,
  analysisNotes,
  project,
  setAnalysisNotes,
}: IMakerLyricsReplaceInput) => {
  const startLineRecordingForProject = (nextProject: IKaraokeMakerProject) => {
    const nextLyricLines = nextProject.lyrics.lines.filter(
      (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
    );
    const targetLine = nextLyricLines[0];
    if (!targetLine) {
      return;
    }
    // From the top, because these lyrics have never been timed: there is no
    // partly-finished pass to resume, so the first line is the only sensible
    // place to start.
    beginLineCapture({
      lineIndex: 0,
      tokenId: targetLine.tokens[0].id,
      seekMs: 0,
      viewStartMs: 0,
    });
  };

  const replaceLyrics = (
    detectTimingAndMelody = false,
    recordLinesAfter = false,
  ) => {
    const { current } = projectRef;
    const reconciliation = reconcileKaraokeMakerLyrics(current, lyricsDraft);
    const nextLines = reconciliation.project.lyrics.lines;
    if (!nextLines.some((line) => !karaokeMakerLineIsSection(line))) {
      setNotice(t('karaoke.maker.lyricsRequired'));
      return;
    }
    const textChanged =
      normalizedLyricsText(lyricsDraft) !==
      normalizedLyricsText(plainLyrics(current));
    const comparableWordCount = Math.min(
      reconciliation.existingWordCount,
      reconciliation.nextWordCount,
    );
    const canTrackEdit =
      comparableWordCount > 0 &&
      reconciliation.preservedWordCount / comparableWordCount >= 0.5;
    if (
      textChanged &&
      reconciliation.existingWordCount > 0 &&
      !canTrackEdit &&
      destructiveAction !== 'replace-lyrics'
    ) {
      setDestructiveAction('replace-lyrics');
      return;
    }
    setDestructiveAction(undefined);
    if (!textChanged) {
      setLyricsOpen(detectTimingAndMelody);
      if (detectTimingAndMelody) {
        lyricsWorkflowActiveRef.current = true;
        setLyricsWorkflowActive(true);
        prepareAfterWhisperRef.current = true;
        requestWhisper(true, true).catch(() => undefined);
      } else if (recordLinesAfter) {
        startLineRecordingForProject(projectRef.current);
      } else {
        setLyricsOpen(false);
      }
      return;
    }
    if (canTrackEdit) {
      const next = touchKaraokeMakerProject(reconciliation.project);
      projectRef.current = next;
      pushHistory(current);
      setProject(next);
      setSelection(undefined);
      if (detectTimingAndMelody) {
        lyricsWorkflowActiveRef.current = true;
        setLyricsWorkflowActive(true);
        prepareAfterWhisperRef.current = true;
        requestWhisper(true, true).catch(() => undefined);
        return;
      }
      if (recordLinesAfter) {
        startLineRecordingForProject(next);
      } else {
        setLyricsOpen(false);
      }
      if (reconciliation.untimedWordCount > 0) {
        setNotice(t('karaoke.maker.lyricsNeedPreparation'));
      }
      return;
    }
    // A complete preparation run must not expose cached/local melody from the
    // previous lyric set. Whisper establishes the new word timing first; only
    // then may the melody pass publish notes linked to those words.
    let reusableAnalysisNotes: IKaraokeMakerAnalysisNote[] = [];
    if (!detectTimingAndMelody) {
      reusableAnalysisNotes = analysisNotes?.length
        ? analysisNotes
        : karaokeMakerAnalysisNotesFromMelody(project);
    }
    const rebuildingEmptyTimeline =
      detectTimingAndMelody &&
      flattenTokens(current).length === 0 &&
      current.melody.notes.length === 0;
    const withNewLyrics: IKaraokeMakerProject = {
      ...current,
      meta: rebuildingEmptyTimeline
        ? { ...current.meta, gapMs: 0 }
        : current.meta,
      lyrics: {
        ...current.lyrics,
        source: 'manual',
        lines: makerLinesFromPlainText(lyricsDraft),
      },
      analysis: {
        ...current.analysis,
        whisperPasses: 0,
        whisperAlignmentVersion: undefined,
      },
      melody: {
        ...current.melody,
        notes: detectTimingAndMelody
          ? []
          : current.melody.notes.map((note) => ({
              ...note,
              tokenId: undefined,
            })),
      },
    };
    const next = touchKaraokeMakerProject(
      reusableAnalysisNotes.length
        ? autoAlignNewKaraokeMakerLyrics(withNewLyrics, reusableAnalysisNotes)
        : withNewLyrics,
    );
    projectRef.current = next;
    pushHistory(current);
    setProject(next);
    if (detectTimingAndMelody) {
      setAnalysisNotes(undefined);
    }
    setSelection(undefined);
    if (detectTimingAndMelody) {
      lyricsWorkflowActiveRef.current = true;
      setLyricsWorkflowActive(true);
      prepareAfterWhisperRef.current = true;
      requestWhisper(true).catch(() => undefined);
      return;
    }
    if (recordLinesAfter) {
      startLineRecordingForProject(next);
    } else {
      setLyricsOpen(false);
    }
    if (reusableAnalysisNotes.length) {
      setNotice(t('karaoke.maker.lyricsAutoAligned'));
    } else {
      setNotice(t('karaoke.maker.lyricsNeedPreparation'));
    }
  };

  return { replaceLyrics };
};

export default makerLyricsReplace;
