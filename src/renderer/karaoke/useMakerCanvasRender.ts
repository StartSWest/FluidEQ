/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createFramePainter } from '../utils/framePainter';
import { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import { paintMakerCanvas } from './makerCanvasPaint';
import {
  ICanvasLyricWord,
  IDragState,
  IMakerCanvasTranslationRow,
} from './makerCanvasTypes';
import { TSelection } from './useKaraokeMakerSelection';
import { IMakerCanvasGesture } from './useMakerCanvasGesture';
import {
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
} from './makerCanvasLayout';
import { IMakerPitchWindow } from './makerPitchView';
import type { IKaraokeLiveValue } from './karaokeLiveValue';

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
  /** Stem overview waves, drawn as two aligned lanes under the original. */
  stemWaveforms?: {
    vocals: number[];
    instrumental: number[];
    /** Localized lane names, drawn at each lane edge so the order needs no manual. */
    labels: { mix: string; backing: string; voice: string };
  };
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
  /** The pitch the note grid shows; see `useMakerPitchView.ts`. */
  pitchWindow: IMakerPitchWindow;
  /**
   * The playhead as it moves, read in each repaint and repainted on each of
   * its ticks without React; and where a scrub audition holds it instead.
   */
  playhead: IKaraokeLiveValue<number>;
  scrubAuditionAnchorMs: number | undefined;
  effectiveDurationMs: number;
  headerHeight: number;
  lyricSectionTop: number;
  /** How tall one original lane is this frame — see useMakerCanvasModel.ts. */
  lyricLaneHeight: number;
  /** Undefined when no translation is selected for this project. */
  translationRow?: IMakerCanvasTranslationRow;

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
  stemWaveforms,
  controlLinkMode,
  effectiveDurationMs,
  gesture,
  headerHeight,
  hoveredEditHandle,
  lyricLaneHeight,
  lyricSectionTop,
  pitchWindow,
  project,
  renderCanvasRef,
  selectedNoteIds,
  selection,
  translationRow,
  viewStartMs,
  visibleViewDurationMs,
  playhead,
  scrubAuditionAnchorMs,
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
      lyricLaneHeight,
      translationRow,
      project,
      selection,
      selectedNoteIds,
      canvasLyricWords,
      canvasSectionGroups,
      stemWaveforms,
      activeLyricFocus,
      activeLyricWordId,
      hoveredEditHandle,
      controlLinkMode,
      viewStartMs,
      visibleViewDurationMs,
      pitchWindow,
      visualPlayheadMs: scrubAuditionAnchorMs ?? playhead.read(),
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
    stemWaveforms,
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
    lyricLaneHeight,
    lyricSectionTop,
    pitchWindow,
    translationRow,
    playhead,
    scrubAuditionAnchorMs,
    project,
    hoveredEditHandle,
    selection,
    selectedNoteIds,
    visibleViewDurationMs,
    viewStartMs,
  ]);

  // Every reason to paint asks for a paint, and the painter paints once in
  // the next frame that is due, with what is current then. The canvas used
  // to be painted on the spot by each of them: a state change painted, then
  // its resize observer was torn down and observed again, which reports at
  // once and painted a second time; a playhead tick or each pointer move of
  // a drag in the same frame painted again, the whole 2116 by 1055 editor
  // each time. With the Maker open in the running window (2026-11-16) the
  // graphics process was seen spending 752 ms of a second unpacking the
  // window's canvas commands while the window waited on it for 605 ms, and
  // every drawing in the app - and moving the view - stood behind it.
  const paintRef = useRef(renderCanvas);
  paintRef.current = renderCanvas;
  const [painter] = useState(() =>
    createFramePainter(() => paintRef.current()),
  );
  useEffect(() => () => painter.cancel(), [painter]);
  renderCanvasRef.current = painter.request;

  // Something it draws changed.
  useEffect(() => {
    painter.request();
  }, [painter, renderCanvas]);

  // Each tick of the playhead repaints the canvas and nothing else. It used
  // to be a prop of the whole Maker, which rendered every component of the
  // editor twenty times a second to move this one line.
  useEffect(() => playhead.subscribe(painter.request), [painter, playhead]);

  useEffect(() => {
    if (!activeLyricWordId) {
      return undefined;
    }
    let animationFrame = 0;
    const animateFocus = (now: number) => {
      painter.request();
      if (now - wordFocusAnimationRef.current.startedAt < 180) {
        animationFrame = window.requestAnimationFrame(animateFocus);
      }
    };
    animationFrame = window.requestAnimationFrame(animateFocus);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeLyricWordId, painter, wordFocusAnimationRef]);

  // One observer for the life of the canvas, not one per render.
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(painter.request);
    observer.observe(host);
    return () => observer.disconnect();
  }, [canvasHostRef, painter]);
};
