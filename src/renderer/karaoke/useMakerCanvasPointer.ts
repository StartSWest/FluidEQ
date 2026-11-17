/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, SetStateAction, useCallback } from 'react';
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import {
  IKaraokeMakerNote,
  karaokeMakerId,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';
import { karaokeMakerFittedLyricViewport } from './makerCanvasLayout';
import {
  ICanvasLyricWord,
  ICanvasSelectionBox,
  IDragState,
  INotePaintDraft,
} from './makerCanvasTypes';
import { IMakerPlot, makerPitchAtY, makerPlot } from './makerCanvasGeometry';
import { IMakerPitchWindow } from './makerPitchView';
import type useMakerPitchView from './useMakerPitchView';
import {
  ICanvasScrubState,
  IMakerCanvasGesture,
} from './useMakerCanvasGesture';
import useKaraokeMakerProject from './useKaraokeMakerProject';
import {
  TSelection,
  useKaraokeMakerSelection,
} from './useKaraokeMakerSelection';
import useKaraokeNoteAudition from './useKaraokeNoteAudition';
import { flattenTokens } from './makerProjectEdits';
import { TWhenPlayheadReaches } from './karaokeMediaCue';
import makerPointerMove from './makerPointerMove';
import type { IKaraokeLiveValue } from './karaokeLiveValue';

/** How fast a wheel zooms, per pixel of turn; the time zoom's rate. */
const WHEEL_ZOOM_RATE = 0.002;

/**
 * A wheel notch (about 100 px of turn) scrolls pitch by a tenth of the
 * window, so it moves the same share of what is on screen at any zoom.
 */
const PITCH_SCROLL_PER_WINDOW = 1_000;

/**
 * Everything the pointer does on the Maker canvas.
 *
 * Nine hundred lines of one component: the four handlers, the coordinate
 * arithmetic that turns a pixel into a time and a pitch, the two auditions a
 * drag triggers, and the four viewport moves. They came out together because
 * they only work together — what a move means depends entirely on what the
 * press decided the drag was, and both are expressed in the same coordinates.
 *
 * The parameter list is long and stays long. These handlers genuinely need this
 * much of the editor, and the honest way to say so is to say so. What they do
 * not do is take it apart: the values that already travel as a group — the
 * gesture, the selection, the project and its history — arrive as that group,
 * derived from the hooks that own them so this cannot drift when they change.
 */
export interface IMakerCanvasPointerParams
  extends
    Pick<
      ReturnType<typeof useKaraokeMakerSelection>,
      'selection' | 'setSelection' | 'selectedNoteIds' | 'setSelectedNoteIds'
    >,
    Pick<
      ReturnType<typeof useKaraokeMakerProject>,
      'project' | 'setProject' | 'projectRef' | 'commit' | 'pushHistory'
    > {
  gesture: IMakerCanvasGesture;
  noteAudition: ReturnType<typeof useKaraokeNoteAudition>;

  /** The visible window, and the limits it may not be dragged past. */
  viewStartMs: number;
  visibleViewDurationMs: number;
  effectiveDurationMs: number;
  minimumViewDurationMs: number;
  maximumViewDurationMs: number;
  maximumViewStartMs: number;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  setViewDurationMs: Dispatch<SetStateAction<number>>;
  setFollowViewport: Dispatch<SetStateAction<boolean>>;
  setLyricFollowRequestKey: Dispatch<SetStateAction<number>>;

  /** The pitch the grid shows, and the wheel's two ways of moving it. */
  pitchWindow: IMakerPitchWindow;
  zoomPitch: ReturnType<typeof useMakerPitchView>['zoomPitch'];
  panPitch: ReturnType<typeof useMakerPitchView>['panPitch'];

  /** Transport, so a drag can scrub and audition against real playback. */
  playhead: IKaraokeLiveValue<number>;
  readPlayheadMs?: () => number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (positionMs: number) => void;
  cancelAudibleInteractions: (pause?: boolean) => void;
  setScrubAuditionAnchorMs: Dispatch<SetStateAction<number | undefined>>;
  /** What says an audition's stretch of the song has been heard. */
  whenPlayheadReaches: TWhenPlayheadReaches;

  /** What the canvas is showing, and how to make it show it again. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  renderCanvasRef: React.MutableRefObject<() => void>;
  canvasLyricWords: ICanvasLyricWord[];
  activeLyricWordId: string | undefined;
  headerHeight: number;

  /** Which tool is armed, which changes what a press means. */
  handPanMode: boolean;
  lineEntryMode: boolean;
  noteEditMode: 'select' | 'paint' | undefined;

  selectedNote: IKaraokeMakerNote | undefined;
  setHoveredEditHandle: Dispatch<
    SetStateAction<
      | { kind: 'word' | 'note'; id: string; behavior: IDragState['behavior'] }
      | undefined
    >
  >;
  setIsCanvasPanning: Dispatch<SetStateAction<boolean>>;
  setIsCanvasScrubbing: Dispatch<SetStateAction<boolean>>;
  setIsPitchPanReady: Dispatch<SetStateAction<boolean>>;
}

export const useMakerCanvasPointer = ({
  activeLyricWordId,
  cancelAudibleInteractions,
  canvasLyricWords,
  canvasRef,
  commit,
  effectiveDurationMs,
  gesture,
  handPanMode,
  headerHeight,
  lineEntryMode,
  maximumViewDurationMs,
  maximumViewStartMs,
  minimumViewDurationMs,
  noteAudition,
  noteEditMode,
  onPause,
  onPlay,
  onSeek,
  panPitch,
  pitchWindow,
  playhead,
  project,
  projectRef,
  pushHistory,
  readPlayheadMs,
  renderCanvasRef,
  selectedNote,
  selectedNoteIds,
  selection,
  setFollowViewport,
  setHoveredEditHandle,
  setIsCanvasPanning,
  setIsCanvasScrubbing,
  setIsPitchPanReady,
  setLyricFollowRequestKey,
  setProject,
  setScrubAuditionAnchorMs,
  setSelectedNoteIds,
  setSelection,
  setViewDurationMs,
  setViewStartMs,
  viewStartMs,
  visibleViewDurationMs,
  whenPlayheadReaches,
  zoomPitch,
}: IMakerCanvasPointerParams) => {
  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  // Every pixel read here goes through the plot the painter drew with. These
  // were hand-copied insets (54 and 72), and when the paint's left margin
  // went to 34 they stayed, so every press landed 20px later in time than
  // the note or word under it.
  const plotAt = ({
    width,
    height,
  }: {
    width: number;
    height: number;
  }): IMakerPlot =>
    makerPlot({
      width,
      height,
      headerHeight,
      viewStartMs,
      visibleViewDurationMs,
      pitchWindow,
    });

  const canvasTimeAtX = (x: number, width: number): number =>
    Math.max(
      0,
      Math.min(effectiveDurationMs, plotAt({ width, height: 1 }).xTime(x)),
    );

  const seekCanvasPoint = (point: ReturnType<typeof canvasPoint>): number => {
    const nextTimeMs = canvasTimeAtX(point.x, point.width);
    setFollowViewport(false);
    onSeek(nextTimeMs);
    return nextTimeMs;
  };

  const auditionDraggedWord = (
    drag: IDragState,
    startMs: number,
    endMs: number,
  ) => {
    if (drag.audioAnchorMs === undefined) {
      return;
    }
    drag.auditionStartMs = Math.max(0, startMs);
    drag.auditionEndMs = Math.max(drag.auditionStartMs + 20, endMs);
    setScrubAuditionAnchorMs(drag.audioAnchorMs);
    if (drag.cancelAudition !== undefined) {
      // A pass is playing; the next one plays the range as it is by then.
      return;
    }
    // Round and round while the word is dragged, each pass ending when the
    // playhead reaches the range's end. It was a timer of the range's length
    // from the seek, which lost the seek and the start-up off every pass.
    const playCurrentRange = () => {
      drag.cancelAudition = undefined;
      if (
        gesture.drag.current !== drag ||
        drag.auditionStartMs === undefined ||
        drag.auditionEndMs === undefined
      ) {
        return;
      }
      drag.auditionStarted = true;
      onSeek(drag.auditionStartMs);
      Promise.resolve(onPlay()).catch(() => undefined);
      drag.cancelAudition = whenPlayheadReaches(
        drag.auditionEndMs,
        playCurrentRange,
      );
    };
    playCurrentRange();
  };

  const auditionWordScrubGrain = (scrub: ICanvasScrubState) => {
    if (!scrub.auditionWordGrain) {
      if (scrub.cancelGrain !== undefined) {
        scrub.cancelGrain();
        scrub.cancelGrain = undefined;
        onPause();
        onSeek(scrub.anchorMs);
      }
      return;
    }
    scrub.cancelGrain?.();
    onSeek(scrub.anchorMs);
    Promise.resolve(onPlay()).catch(() => undefined);
    // 90 ms of the song as played, not 90 ms from the seek: a timer counted
    // the seek and the element's start-up into the grain, and a grain that
    // short was left with little or nothing of the word in it.
    scrub.cancelGrain = whenPlayheadReaches(scrub.anchorMs + 90, () => {
      scrub.cancelGrain = undefined;
      if (gesture.scrub.current !== scrub) {
        return;
      }
      onPause();
      onSeek(scrub.anchorMs);
    });
  };

  const moveViewport = (requestedStartMs: number) => {
    setFollowViewport(false);
    setViewStartMs(Math.max(0, Math.min(maximumViewStartMs, requestedStartMs)));
  };

  const resizeViewport = (
    requestedStartMs: number,
    requestedDurationMs: number,
  ) => {
    const nextDurationMs = Math.max(
      minimumViewDurationMs,
      Math.min(maximumViewDurationMs, requestedDurationMs),
    );
    setFollowViewport(false);
    setViewDurationMs(nextDurationMs);
    setViewStartMs(
      Math.max(
        0,
        Math.min(
          Math.max(0, effectiveDurationMs - nextDurationMs),
          requestedStartMs,
        ),
      ),
    );
  };

  const followPlayhead = () => {
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    setViewStartMs(
      Math.max(
        0,
        Math.min(
          maximumViewStartMs,
          playhead.read() - visibleViewDurationMs * 0.2,
        ),
      ),
    );
  };

  const resetLyricZoom = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const plotWidth = makerPlot({
      width: canvas?.clientWidth ?? 392,
      height: canvas?.clientHeight ?? 1,
      headerHeight,
      viewStartMs,
      visibleViewDurationMs,
    }).width;
    const selected =
      selection?.kind === 'word'
        ? canvasLyricWords.find((word) =>
            word.syllables.some(({ token }) => token.id === selection.id),
          )
        : undefined;
    const focusMs =
      selected !== undefined
        ? (selected.startMs + selected.endMs) / 2
        : playhead.read();
    if (context) {
      context.font = '650 13px Inter, system-ui, sans-serif';
    }
    const priorityForWord = (word: ICanvasLyricWord) => {
      if (word.id === activeLyricWordId) {
        return 100;
      }
      if (word.id === selected?.id) {
        return 80;
      }
      return 0;
    };
    const fitted = karaokeMakerFittedLyricViewport(
      canvasLyricWords.map((word) => ({
        id: word.id,
        startMs: word.startMs,
        endMs: word.endMs,
        width: Math.max(
          34,
          (context?.measureText(word.text).width ?? word.text.length * 7.2) +
            18,
        ),
        preferredLane: word.wordIndex % 3,
        priority: priorityForWord(word),
      })),
      focusMs,
      plotWidth,
      effectiveDurationMs,
      minimumViewDurationMs,
      3,
      12,
      true,
    );
    setFollowViewport(false);
    setViewStartMs(fitted.startMs);
    setViewDurationMs(fitted.durationMs);
  }, [
    setFollowViewport,
    setViewDurationMs,
    setViewStartMs,
    activeLyricWordId,
    canvasLyricWords,
    canvasRef,
    effectiveDurationMs,
    headerHeight,
    minimumViewDurationMs,
    playhead,
    selection,
    viewStartMs,
    visibleViewDurationMs,
  ]);

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    const playheadX = plotAt(point).timeX(playhead.read());
    const grabbedPlayhead = Math.abs(point.x - playheadX) <= 9;
    const hit = [...gesture.hitRegions.current]
      .reverse()
      .find(
        (region) =>
          point.x >= region.left - 5 &&
          point.x <= region.right + 5 &&
          point.y >= region.top &&
          point.y <= region.bottom,
      );
    // The middle button grabs the grid wherever it is pressed, as the hand
    // does (Ivan, 2026-11-15: "the mouse in the centre moves in both
    // directions, the hand").
    if (event.button === 1 || (handPanMode && hit?.kind !== 'note')) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.pan.current = {
        pointerX: point.x,
        viewStartMs,
        pointerY: point.y,
      };
      setFollowViewport(false);
      setIsPitchPanReady(false);
      setIsCanvasPanning(true);
      return;
    }
    if (
      noteEditMode === 'paint' &&
      !lineEntryMode &&
      !hit &&
      point.y >= headerHeight
    ) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const draft: INotePaintDraft = {
        pointerId: event.pointerId,
        startX: point.x,
        currentX: point.x,
        y: point.y,
      };
      gesture.notePaintDraft.current = draft;
      renderCanvasRef.current();
      return;
    }
    if (
      noteEditMode === 'select' &&
      !hit &&
      !grabbedPlayhead &&
      !lineEntryMode &&
      point.y >= headerHeight
    ) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      const box: ICanvasSelectionBox = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        additive,
        initialNoteIds: additive ? new Set(selectedNoteIds) : new Set<string>(),
      };
      gesture.selectionBox.current = box;
      renderCanvasRef.current();
      if (!additive) {
        setSelection(undefined);
        setSelectedNoteIds(new Set());
      }
      return;
    }
    if (!hit && !grabbedPlayhead && !lineEntryMode && point.y >= headerHeight) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.pan.current = {
        pointerX: point.x,
        viewStartMs,
        pointerY: point.y,
      };
      setFollowViewport(false);
      setIsPitchPanReady(false);
      setIsCanvasPanning(true);
      return;
    }
    if (!hit || (grabbedPlayhead && hit?.kind !== 'note') || lineEntryMode) {
      event.preventDefault();
      cancelAudibleInteractions(false);
      onPause();
      event.currentTarget.setPointerCapture(event.pointerId);
      const anchorMs = seekCanvasPoint(point);
      const scrub: ICanvasScrubState = {
        pointerId: event.pointerId,
        anchorMs,
        auditionWordGrain: hit?.kind === 'word',
      };
      gesture.scrub.current = scrub;
      setIsCanvasScrubbing(true);
      setScrubAuditionAnchorMs(anchorMs);
      auditionWordScrubGrain(scrub);
      setSelection(undefined);
      setSelectedNoteIds(new Set());
      return;
    }
    const edgeDistance = Math.min(
      Math.abs(point.x - hit.left),
      Math.abs(point.x - hit.right),
    );
    let behavior: IDragState['behavior'] = hit.behavior ?? 'move';
    const hitNote =
      hit.kind === 'note'
        ? project.melody.notes.find((note) => note.id === hit.id)
        : undefined;
    if (
      !hit.behavior &&
      hit.kind === 'note' &&
      !hitNote?.tokenId &&
      edgeDistance <= 8
    ) {
      behavior =
        Math.abs(point.x - hit.left) < Math.abs(point.x - hit.right)
          ? 'resize-start'
          : 'resize-end';
    }
    const nextSelection = { kind: hit.kind, id: hit.id } as Exclude<
      TSelection,
      undefined
    >;
    if (hit.kind === 'note' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.noteLinkDrag.current = {
        pointerId: event.pointerId,
        noteId: hit.id,
        startX: (hit.left + hit.right) / 2,
        startY: (hit.top + hit.bottom) / 2,
        currentX: point.x,
        currentY: point.y,
        initialNoteIds: new Set(selectedNoteIds),
      };
      setSelection(nextSelection);
      setSelectedNoteIds(new Set([hit.id]));
      renderCanvasRef.current();
      return;
    }
    if (hit.kind === 'note' && event.shiftKey && selectedNote) {
      event.preventDefault();
      const orderedNotes = [...project.melody.notes].sort(
        (left, right) => left.startMs - right.startMs,
      );
      const anchorIndex = orderedNotes.findIndex(
        (note) => note.id === selectedNote.id,
      );
      const hitIndex = orderedNotes.findIndex((note) => note.id === hit.id);
      if (anchorIndex >= 0 && hitIndex >= 0) {
        const rangeStart = Math.min(anchorIndex, hitIndex);
        const rangeEnd = Math.max(anchorIndex, hitIndex);
        setSelectedNoteIds(
          new Set(
            orderedNotes.slice(rangeStart, rangeEnd + 1).map((note) => note.id),
          ),
        );
        setSelection(nextSelection);
        return;
      }
    }
    let activeNoteIds = new Set<string>();
    if (hit.kind === 'note') {
      activeNoteIds = selectedNoteIds.has(hit.id)
        ? new Set(selectedNoteIds)
        : new Set([hit.id]);
    }
    setSelection(nextSelection);
    setSelectedNoteIds(activeNoteIds);
    // A lyric-linked note takes its complete timing and pitch identity from the
    // attached word/syllable. Select it normally, but require an explicit
    // detach before any direct note movement (including vertical pitch edits).
    if (hit.kind === 'note' && hitNote?.tokenId) {
      noteAudition.stop();
      return;
    }
    const dragBehavior =
      hit.kind === 'note' && activeNoteIds.size > 1 ? 'move' : behavior;
    if (hit.kind === 'note' && dragBehavior === 'move') {
      const note = project.melody.notes.find((item) => item.id === hit.id);
      if (note) {
        gesture.lastDragAuditionMidi.current = Math.round(note.targetMidi);
        noteAudition.play(
          note.targetMidi,
          karaokeLeadNoteArticulation(note).durationMs,
        );
      }
    } else if (hit.kind === 'note') {
      noteAudition.stop();
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.drag.current = {
      selection: nextSelection,
      behavior: dragBehavior,
      pointerX: point.x,
      pointerY: point.y,
      base: project,
      noteIds: hit.kind === 'note' ? [...activeNoteIds] : undefined,
      audioAnchorMs:
        hit.kind === 'word'
          ? Math.max(0, readPlayheadMs?.() ?? playhead.read())
          : undefined,
    };
  };

  const { onCanvasPointerMove } = makerPointerMove({
    panPitch,
    gesture,
    canvasPoint,
    plotAt,
    renderCanvasRef,
    setSelectedNoteIds,
    setSelection,
    setViewStartMs,
    visibleViewDurationMs,
    maximumViewStartMs,
    seekCanvasPoint,
    setScrubAuditionAnchorMs,
    auditionWordScrubGrain,
    setIsPitchPanReady,
    handPanMode,
    noteEditMode,
    lineEntryMode,
    headerHeight,
    setHoveredEditHandle,
    project,
    effectiveDurationMs,
    noteAudition,
    setProject,
    auditionDraggedWord,
  });

  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const wasCancelled = event.type === 'pointercancel';
    const noteLinkDrag = gesture.noteLinkDrag.current;
    if (noteLinkDrag?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      const targetWord = wasCancelled
        ? undefined
        : [...gesture.hitRegions.current]
            .reverse()
            .find(
              (region) =>
                region.kind === 'word' &&
                region.behavior === undefined &&
                point.x >= region.left &&
                point.x <= region.right &&
                point.y >= region.top &&
                point.y <= region.bottom,
            );
      const targetToken = targetWord
        ? flattenTokens(projectRef.current).find(
            (token) => token.id === targetWord.id,
          )
        : undefined;
      if (
        targetToken?.startMs !== undefined &&
        targetToken.endMs !== undefined
      ) {
        commit((current) => ({
          ...current,
          melody: {
            ...current.melody,
            source: 'manual',
            notes: current.melody.notes.map((note) =>
              note.id === noteLinkDrag.noteId
                ? {
                    ...note,
                    tokenId: targetToken.id,
                    startMs: targetToken.startMs as number,
                    endMs: targetToken.endMs as number,
                    source: 'manual' as const,
                  }
                : note,
            ),
          },
        }));
        setSelection({ kind: 'note', id: noteLinkDrag.noteId });
        setSelectedNoteIds(new Set([noteLinkDrag.noteId]));
      } else {
        const movedDistance = Math.hypot(
          point.x - noteLinkDrag.startX,
          point.y - noteLinkDrag.startY,
        );
        const nextNoteIds = new Set(noteLinkDrag.initialNoteIds);
        if (!wasCancelled && movedDistance < 5) {
          if (nextNoteIds.has(noteLinkDrag.noteId)) {
            nextNoteIds.delete(noteLinkDrag.noteId);
          } else {
            nextNoteIds.add(noteLinkDrag.noteId);
          }
        }
        setSelectedNoteIds(nextNoteIds);
        const firstSelectedId = nextNoteIds.values().next().value as
          string | undefined;
        setSelection(
          firstSelectedId ? { kind: 'note', id: firstSelectedId } : undefined,
        );
      }
      gesture.noteLinkDrag.current = undefined;
      renderCanvasRef.current();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const paintDraft = gesture.notePaintDraft.current;
    if (paintDraft?.pointerId === event.pointerId) {
      if (wasCancelled) {
        gesture.notePaintDraft.current = undefined;
        renderCanvasRef.current();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      const point = canvasPoint(event);
      const requestedStartTime = canvasTimeAtX(
        Math.min(paintDraft.startX, paintDraft.currentX),
        point.width,
      );
      const startTime = Math.min(
        Math.max(0, effectiveDurationMs - 40),
        requestedStartTime,
      );
      const draggedEndTime = canvasTimeAtX(
        Math.max(paintDraft.startX, paintDraft.currentX),
        point.width,
      );
      const endTime =
        Math.abs(paintDraft.currentX - paintDraft.startX) < 4
          ? Math.min(effectiveDurationMs, startTime + 500)
          : Math.max(startTime + 40, draggedEndTime);
      const targetMidi = makerPitchAtY(plotAt(point), paintDraft.y);
      const note: IKaraokeMakerNote = {
        id: karaokeMakerId('note'),
        startMs: startTime,
        endMs: endTime,
        targetMidi,
        kind: 'normal',
        source: 'manual',
      };
      gesture.notePaintDraft.current = undefined;
      renderCanvasRef.current();
      commit((current) => ({
        ...current,
        melody: {
          ...current.melody,
          source: 'manual',
          notes: [...current.melody.notes, note].sort(
            (left, right) => left.startMs - right.startMs,
          ),
        },
      }));
      setSelection({ kind: 'note', id: note.id });
      setSelectedNoteIds(new Set([note.id]));
      noteAudition.play(note.targetMidi, 240);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (gesture.selectionBox.current?.pointerId === event.pointerId) {
      gesture.selectionBox.current = undefined;
      renderCanvasRef.current();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (gesture.pan.current) {
      gesture.pan.current = undefined;
      setIsCanvasPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (gesture.scrub.current?.pointerId === event.pointerId) {
      const scrub = gesture.scrub.current;
      scrub.cancelGrain?.();
      scrub.cancelGrain = undefined;
      if (scrub.auditionWordGrain) {
        onPause();
        onSeek(scrub.anchorMs);
      }
      gesture.scrub.current = undefined;
      setIsCanvasScrubbing(false);
      setScrubAuditionAnchorMs(undefined);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const drag = gesture.drag.current;
    if (!drag) {
      return;
    }
    drag.cancelAudition?.();
    drag.cancelAudition = undefined;
    if (drag.auditionStarted && drag.audioAnchorMs !== undefined) {
      onPause();
      onSeek(drag.audioAnchorMs);
      setScrubAuditionAnchorMs(undefined);
    }
    gesture.drag.current = undefined;
    gesture.lastDragAuditionMidi.current = undefined;
    noteAudition.stop();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pushHistory(drag.base);
    setProject((current) => touchKaraokeMakerProject(current));
    if (
      !wasCancelled &&
      drag.behavior === 'move' &&
      drag.finalAuditionMidi !== undefined &&
      drag.finalAuditionDurationMs !== undefined
    ) {
      noteAudition.play(drag.finalAuditionMidi, drag.finalAuditionDurationMs);
    }
  };

  /**
   * The wheel: alone it scrolls time, with Ctrl it zooms time — as before —
   * and Shift moves it to pitch, the other axis: Shift scrolls pitch, and
   * Ctrl + Shift zooms pitch about the row under the pointer. Shift is the
   * free key here because Chromium already turns a Shift-held wheel
   * sideways, which this canvas scrolled exactly like a plain one.
   */
  const onCanvasWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const plot = plotAt(rect);
    const zoomKey = event.ctrlKey || event.metaKey;
    if (event.shiftKey) {
      // That sideways turn is why the amount is read from either axis.
      const turn = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (zoomKey) {
        zoomPitch(
          plot.yNote(event.clientY - rect.top),
          Math.exp(turn * WHEEL_ZOOM_RATE),
        );
      } else {
        panPitch(
          (-turn * (plot.highMidi - plot.lowMidi)) / PITCH_SCROLL_PER_WINDOW,
        );
      }
      return;
    }
    setFollowViewport(false);
    if (zoomKey) {
      const cursorProgress = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left - plot.left) / plot.width),
      );
      const cursorTime = viewStartMs + cursorProgress * visibleViewDurationMs;
      const nextDuration = Math.max(
        minimumViewDurationMs,
        Math.min(
          maximumViewDurationMs,
          visibleViewDurationMs * Math.exp(event.deltaY * WHEEL_ZOOM_RATE),
        ),
      );
      setViewDurationMs(nextDuration);
      setViewStartMs(
        Math.max(
          0,
          Math.min(
            effectiveDurationMs - nextDuration,
            cursorTime - cursorProgress * nextDuration,
          ),
        ),
      );
      return;
    }
    setViewStartMs((start) =>
      Math.max(
        0,
        Math.min(
          maximumViewStartMs,
          start +
            (event.deltaX + event.deltaY) * (visibleViewDurationMs / 2_000),
        ),
      ),
    );
  };

  return {
    followPlayhead,
    moveViewport,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasWheel,
    resetLyricZoom,
    resizeViewport,
  };
};
