/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MutableRefObject, RefObject, useCallback, useEffect } from 'react';
import { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import { paintMakerCanvas } from './makerCanvasPaint';
import { ICanvasLyricWord, IDragState } from './makerCanvasTypes';
import { TSelection } from './useKaraokeMakerSelection';
import { IMakerCanvasGesture } from './useMakerCanvasGesture';
import {
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
} from './makerCanvasLayout';

/**
 * Painting the canvas, and every reason to paint it again.
 *
 * A hundred lines that do one thing: gather everything the painter needs, hand
 * it over, and repaint whenever any of it changes or the element resizes.
 *
 * The parameter list is long because a frame is a picture of the whole editor —
 * the project, the view window, the selection, the gesture in progress. There
 * is no smaller set that produces a correct frame, so there is no smaller list.
 *
 * The repaint is exposed through a ref as well as being run by an effect. The
 * pointer handlers repaint synchronously while a drag is happening — waiting
 * for React to notice would make a dragged note lag a frame behind the cursor —
 * and a ref is how they reach it without depending on this hook's identity.
 */
export interface IMakerCanvasRenderParams {
  project: IKaraokeMakerProject;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasHostRef: RefObject<HTMLDivElement | null>;
  gesture: IMakerCanvasGesture;

  /** What the painter draws: the words, the sections, and what is picked out. */
  canvasLyricWords: ICanvasLyricWord[];
  canvasSectionGroups: ReturnType<typeof karaokeMakerSectionGroups>;
  activeLyricFocus: ReturnType<typeof karaokeMakerLyricFocus>;
  activeLyricWordId: string | undefined;
  selection: TSelection;
  selectedNoteIds: Set<string>;
  hoveredEditHandle:
    | { kind: 'word' | 'note'; id: string; behavior: IDragState['behavior'] }
    | undefined;
  controlLinkMode: boolean;

  /** The window being drawn, and where the playhead sits inside it. */
  viewStartMs: number;
  visibleViewDurationMs: number;
  visualPlayheadMs: number;
  effectiveDurationMs: number;
  headerHeight: number;
  lyricSectionTop: number;

  /**
   * When the focused word last changed, so its highlight can be animated.
   *
   * A ref because the animation is read on every frame and written only when
   * the focus moves; as state it would re-render the editor to start a fade.
   */
  wordFocusAnimationRef: MutableRefObject<{
    tokenId?: string;
    startedAt: number;
  }>;
  /** How the pointer handlers repaint without waiting for React. */
  renderCanvasRef: MutableRefObject<() => void>;
}

export const useMakerCanvasRender = ({
  activeLyricFocus,
  activeLyricWordId,
  canvasHostRef,
  canvasLyricWords,
  canvasRef,
  canvasSectionGroups,
  controlLinkMode,
  effectiveDurationMs,
  gesture,
  headerHeight,
  hoveredEditHandle,
  lyricSectionTop,
  project,
  renderCanvasRef,
  selectedNoteIds,
  selection,
  viewStartMs,
  visibleViewDurationMs,
  visualPlayheadMs,
  wordFocusAnimationRef,
}: IMakerCanvasRenderParams) => {
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const host = canvasHostRef.current;
    if (!canvas || !host) {
      return;
    }
    // CSS owns the visible canvas size. Writing the measured size back as an
    // inline width trapped the editor at its pre-fullscreen width, because the
    // next ResizeObserver pass could only measure that same locked width.
    // Measure the host instead and resize only the backing bitmap.
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    const width = Math.max(320, host.clientWidth);
    const height = Math.max(260, canvas.clientHeight);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    paintMakerCanvas({
      context,
      ratio,
      width,
      height,
      headerHeight,
      lyricSectionTop,
      project,
      selection,
      selectedNoteIds,
      canvasLyricWords,
      canvasSectionGroups,
      activeLyricFocus,
      activeLyricWordId,
      hoveredEditHandle,
      controlLinkMode,
      viewStartMs,
      visibleViewDurationMs,
      visualPlayheadMs,
      effectiveDurationMs,
      hitRegionsRef: gesture.hitRegions,
      selectionBoxRef: gesture.selectionBox,
      notePaintDraftRef: gesture.notePaintDraft,
      noteLinkDragRef: gesture.noteLinkDrag,
      wordFocusAnimationRef,
    });
  }, [
    canvasHostRef,
    canvasRef,
    wordFocusAnimationRef,
    gesture.hitRegions,
    gesture.noteLinkDrag,
    gesture.notePaintDraft,
    gesture.selectionBox,
    activeLyricFocus,
    activeLyricWordId,
    canvasSectionGroups,
    canvasLyricWords,
    controlLinkMode,
    effectiveDurationMs,
    headerHeight,
    lyricSectionTop,
    visualPlayheadMs,
    project,
    hoveredEditHandle,
    selection,
    selectedNoteIds,
    visibleViewDurationMs,
    viewStartMs,
  ]);

  renderCanvasRef.current = renderCanvas;

  useEffect(() => {
    if (!activeLyricWordId) {
      return undefined;
    }
    let animationFrame = 0;
    const animateFocus = (now: number) => {
      renderCanvasRef.current();
      if (now - wordFocusAnimationRef.current.startedAt < 180) {
        animationFrame = window.requestAnimationFrame(animateFocus);
      }
    };
    animationFrame = window.requestAnimationFrame(animateFocus);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeLyricWordId, renderCanvasRef, wordFocusAnimationRef]);

  useEffect(() => {
    renderCanvas();
    const host = canvasHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(renderCanvas);
    observer.observe(host);
    return () => observer.disconnect();
  }, [canvasHostRef, renderCanvas]);
};
