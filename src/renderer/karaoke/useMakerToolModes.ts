/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  IKaraokeMakerLine,
  IKaraokeMakerToken,
} from '../../common/karaoke/makerProject';
import { TSelection } from './useKaraokeMakerSelection';
import { IMakerCanvasGesture } from './useMakerCanvasGesture';
import { IGuidedLineCapture, TLineEntrySession } from './useMakerLineCapture';

/**
 * Arming a tool, and putting every other one away.
 *
 * Six functions that all do the same two things: turn one mode on, and turn
 * whatever was on off. That second half is the reason they are together —
 * entering line capture has to cancel a pan, a scrub, an open panel and the
 * export menu, and every one of these has the same list to clear. Scattered,
 * each was a chance to forget one and leave the editor in two modes at once.
 *
 * Called before the analysis hook, which needs startLineEntrySync. Nothing here
 * needs anything from a run, so the order costs nothing.
 */
export interface IMakerToolModesParams {
  tokens: IKaraokeMakerToken[];
  lyricLines: IKaraokeMakerLine[];
  selectedToken: IKaraokeMakerToken | undefined;
  lineEntryMode: boolean;
  gesture: IMakerCanvasGesture;

  onPause: () => void;
  onSeek: (positionMs: number) => void;
  cancelAudibleInteractions: (pause?: boolean) => void;
  clearLineEntryCountdown: () => void;

  /** The view, which jumps to the line a capture is about to start on. */
  visibleViewDurationMs: number;
  maximumViewStartMs: number;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  setFollowViewport: Dispatch<SetStateAction<boolean>>;
  setLyricFollowRequestKey: Dispatch<SetStateAction<number>>;

  setLineEntryMode: Dispatch<SetStateAction<boolean>>;
  setLineEntrySession: Dispatch<SetStateAction<TLineEntrySession>>;
  setLineEntryCapture: Dispatch<SetStateAction<IGuidedLineCapture | undefined>>;
  setLineEntryIndex: Dispatch<SetStateAction<number>>;
  /** The index a callback reads, written directly so it is never a step behind. */
  lineEntryIndexRef: MutableRefObject<number>;
  setHandPanMode: Dispatch<SetStateAction<boolean>>;
  setNoteEditMode: Dispatch<SetStateAction<'select' | 'paint' | undefined>>;

  /** Everything that has to be put away when a mode is entered. */
  setToolPanel: Dispatch<
    SetStateAction<'timing' | 'edit' | 'analysis' | undefined>
  >;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
  setLyricsOpen: Dispatch<SetStateAction<boolean>>;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setIsCanvasPanning: Dispatch<SetStateAction<boolean>>;
  setIsCanvasScrubbing: Dispatch<SetStateAction<boolean>>;
  setSelection: Dispatch<SetStateAction<TSelection>>;
}

export const useMakerToolModes = ({
  cancelAudibleInteractions,
  clearLineEntryCountdown,
  gesture,
  lineEntryMode,
  lineEntryIndexRef,
  lyricLines,
  maximumViewStartMs,
  onPause,
  onSeek,
  selectedToken,
  setExportOpen,
  setFollowViewport,
  setHandPanMode,
  setIsCanvasPanning,
  setIsCanvasScrubbing,
  setLineEntryCapture,
  setLineEntryIndex,
  setLineEntryMode,
  setLineEntrySession,
  setLyricFollowRequestKey,
  setLyricsOpen,
  setNoteEditMode,
  setPreviewOpen,
  setSelection,
  setToolPanel,
  setViewStartMs,
  tokens,
  visibleViewDurationMs,
}: IMakerToolModesParams) => {
  const toggleToolPanel = (panel: 'timing' | 'edit' | 'analysis') => {
    setExportOpen(false);
    setToolPanel((current) => (current === panel ? undefined : panel));
  };

  /**
   * Put every mode and every half-finished gesture away.
   *
   * This list was written out four times and no two copies agreed. Switching to
   * the hand tool left a scrub in progress behind, because that copy cleared
   * six of the seven gesture refs; starting a capture from the toolbar left
   * paint mode armed and a note link half-dragged, because that copy cleared
   * different ones again. Each was correct about what it meant and wrong about
   * what it did.
   *
   * One list, so entering any mode leaves the editor in the same known state.
   */
  const resetModes = () => {
    clearLineEntryCountdown();
    setLineEntryMode(false);
    setLineEntryCapture(undefined);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    gesture.scrub.current = undefined;
    gesture.drag.current = undefined;
    gesture.selectionBox.current = undefined;
    gesture.notePaintDraft.current = undefined;
    gesture.noteLinkDrag.current = undefined;
    cancelAudibleInteractions();
    setToolPanel(undefined);
  };

  /**
   * Arm a guided capture on one line, wherever the caller found it.
   *
   * The two ways in differ only in which line they pick and where the playhead
   * starts: the toolbar resumes at the first untimed word, and a fresh set of
   * lyrics starts at the top. Everything after that decision was written out
   * twice — once here and once in the component — and the two had already
   * drifted apart in three places.
   */
  const beginLineCapture = ({
    lineIndex,
    tokenId,
    seekMs,
    viewStartMs,
  }: {
    lineIndex: number;
    tokenId: string;
    /**
     * Where to start playing, when there is somewhere to start.
     *
     * Omitted for a line that has never been timed: there is no position to
     * seek to, and moving the playhead or the view on the way in would throw
     * away wherever the user had got to.
     */
    seekMs?: number;
    viewStartMs?: number;
  }) => {
    // A focused input would otherwise swallow the keys the capture listens for.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLyricsOpen(false);
    resetModes();
    setHandPanMode(false);
    setNoteEditMode(undefined);
    // After the reset, which switches capture off along with everything else.
    setLineEntryMode(true);
    setLineEntrySession('setup');
    setLineEntryIndex(lineIndex);
    // Written directly as well as through state: the first keystroke can land
    // before the re-render that syncs the ref, and stepping from a stale index
    // repeats or skips a line.
    lineEntryIndexRef.current = lineIndex;
    setSelection({ kind: 'word', id: tokenId });
    setPreviewOpen(true);
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    if (seekMs !== undefined) {
      onSeek(seekMs);
    }
    if (viewStartMs !== undefined) {
      setViewStartMs(viewStartMs);
    }
  };

  const startLineEntrySync = (preferredTokenId = selectedToken?.id) => {
    if (!tokens.length) {
      return;
    }
    const preferredWordIndex = preferredTokenId
      ? tokens.findIndex((token) => token.id === preferredTokenId)
      : -1;
    const firstUntimed = tokens.findIndex(
      (token) => token.startMs === undefined,
    );
    let wordIndex = 0;
    if (preferredWordIndex >= 0) {
      wordIndex = preferredWordIndex;
    } else if (firstUntimed >= 0) {
      wordIndex = firstUntimed;
    }
    const lineIndex = Math.max(
      0,
      lyricLines.findIndex((line) =>
        line.tokens.some((token) => token.id === tokens[wordIndex]?.id),
      ),
    );
    const target = lyricLines[lineIndex]?.tokens[0];
    if (!target) {
      return;
    }
    // A second of run-up, so the user hears the bar before the one they are
    // about to tap in rather than starting cold on the beat.
    beginLineCapture({
      lineIndex,
      tokenId: target.id,
      seekMs:
        target.startMs === undefined
          ? undefined
          : Math.max(0, target.startMs - 1_000),
      viewStartMs:
        target.startMs === undefined
          ? undefined
          : Math.max(
              0,
              Math.min(
                maximumViewStartMs,
                target.startMs - visibleViewDurationMs * 0.3,
              ),
            ),
    });
  };

  const stopLineEntryRecording = () => {
    onPause();
    clearLineEntryCountdown();
    setLineEntryCapture(undefined);
    setLineEntrySession('setup');
    setLineEntryMode(false);
  };

  const toggleLineEntryMode = () => {
    if (lineEntryMode) {
      stopLineEntryRecording();
      return;
    }
    startLineEntrySync();
  };

  const toggleHandPanMode = () => {
    setHandPanMode((active) => !active);
    setNoteEditMode(undefined);
    resetModes();
  };

  const toggleNoteEditMode = (mode: 'select' | 'paint') => {
    setNoteEditMode((current) => (current === mode ? undefined : mode));
    setHandPanMode(false);
    resetModes();
  };

  return {
    beginLineCapture,
    resetModes,
    startLineEntrySync,
    stopLineEntryRecording,
    toggleHandPanMode,
    toggleLineEntryMode,
    toggleNoteEditMode,
    toggleToolPanel,
  };
};
