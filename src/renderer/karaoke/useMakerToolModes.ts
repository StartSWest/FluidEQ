/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, SetStateAction } from 'react';
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
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLyricsOpen(false);
    setLineEntryMode(true);
    clearLineEntryCountdown();
    setLineEntrySession('setup');
    setLineEntryCapture(undefined);
    setLineEntryIndex(lineIndex);
    setSelection({ kind: 'word', id: target.id });
    setHandPanMode(false);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    cancelAudibleInteractions();
    setPreviewOpen(true);
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    if (target.startMs !== undefined) {
      const preRollMs = Math.max(0, target.startMs - 1_000);
      onSeek(preRollMs);
      setViewStartMs(
        Math.max(
          0,
          Math.min(
            maximumViewStartMs,
            target.startMs - visibleViewDurationMs * 0.3,
          ),
        ),
      );
    }
    setToolPanel(undefined);
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
    gesture.selectionBox.current = undefined;
    gesture.notePaintDraft.current = undefined;
    gesture.noteLinkDrag.current = undefined;
    setLineEntryMode(false);
    clearLineEntryCountdown();
    setLineEntryCapture(undefined);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    cancelAudibleInteractions();
    gesture.drag.current = undefined;
    setToolPanel(undefined);
  };

  const toggleNoteEditMode = (mode: 'select' | 'paint') => {
    setNoteEditMode((current) => (current === mode ? undefined : mode));
    setHandPanMode(false);
    setLineEntryMode(false);
    clearLineEntryCountdown();
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

  return {
    startLineEntrySync,
    stopLineEntryRecording,
    toggleHandPanMode,
    toggleLineEntryMode,
    toggleNoteEditMode,
    toggleToolPanel,
  };
};
