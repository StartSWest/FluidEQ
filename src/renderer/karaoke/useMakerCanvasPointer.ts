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
  resizeKaraokeMakerTokenBoundary,
  shiftKaraokeMakerLineTailFromToken,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';
import {
  karaokeMakerFittedLyricViewport,
  karaokeMakerPannedViewportStart,
} from './makerCanvasLayout';
import {
  ICanvasLyricWord,
  ICanvasSelectionBox,
  IDragState,
  INotePaintDraft,
} from './makerCanvasTypes';
import { MAX_NOTE_MIDI, MIN_NOTE_MIDI } from './makerCanvasGeometry';
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
import { flattenTokens, replaceNote } from './makerProjectEdits';

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

  /** Transport, so a drag can scrub and audition against real playback. */
  playheadMs: number;
  readPlayheadMs?: () => number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (positionMs: number) => void;
  cancelAudibleInteractions: (pause?: boolean) => void;
  setScrubAuditionAnchorMs: Dispatch<SetStateAction<number | undefined>>;

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
  playheadMs,
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

  const canvasTimeAtX = (x: number, width: number): number => {
    const plotWidth = Math.max(1, width - 72);
    return Math.max(
      0,
      Math.min(
        effectiveDurationMs,
        viewStartMs + ((x - 54) / plotWidth) * visibleViewDurationMs,
      ),
    );
  };

  const canvasMidiAtY = (y: number, height: number): number => {
    const plotHeight = Math.max(1, height - headerHeight - 28);
    return Math.max(
      MIN_NOTE_MIDI,
      Math.min(
        MAX_NOTE_MIDI,
        Math.round(
          MAX_NOTE_MIDI -
            ((y - headerHeight) / plotHeight) * (MAX_NOTE_MIDI - MIN_NOTE_MIDI),
        ),
      ),
    );
  };

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
    if (drag.auditionTimerId !== undefined) {
      return;
    }
    const playCurrentRange = () => {
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
      drag.auditionTimerId = window.setTimeout(
        playCurrentRange,
        Math.max(20, drag.auditionEndMs - drag.auditionStartMs),
      );
    };
    playCurrentRange();
  };

  const auditionWordScrubGrain = (scrub: ICanvasScrubState) => {
    if (!scrub.auditionWordGrain) {
      if (scrub.grainTimerId !== undefined) {
        window.clearTimeout(scrub.grainTimerId);
        scrub.grainTimerId = undefined;
        onPause();
        onSeek(scrub.anchorMs);
      }
      return;
    }
    if (scrub.grainTimerId !== undefined) {
      window.clearTimeout(scrub.grainTimerId);
    }
    onSeek(scrub.anchorMs);
    Promise.resolve(onPlay()).catch(() => undefined);
    scrub.grainTimerId = window.setTimeout(() => {
      if (gesture.scrub.current !== scrub) {
        return;
      }
      onPause();
      onSeek(scrub.anchorMs);
      scrub.grainTimerId = undefined;
    }, 90);
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
        Math.min(maximumViewStartMs, playheadMs - visibleViewDurationMs * 0.2),
      ),
    );
  };

  const resetLyricZoom = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const plotWidth = Math.max(1, (canvas?.clientWidth ?? 392) - 72);
    const selected =
      selection?.kind === 'word'
        ? canvasLyricWords.find((word) =>
            word.syllables.some(({ token }) => token.id === selection.id),
          )
        : undefined;
    const focusMs =
      selected !== undefined
        ? (selected.startMs + selected.endMs) / 2
        : playheadMs;
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
    minimumViewDurationMs,
    playheadMs,
    selection,
  ]);

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    const plotWidth = Math.max(1, point.width - 72);
    const playheadX =
      54 + ((playheadMs - viewStartMs) / visibleViewDurationMs) * plotWidth;
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
    if (handPanMode && hit?.kind !== 'note') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.pan.current = {
        pointerX: point.x,
        viewStartMs,
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
          ? Math.max(0, readPlayheadMs?.() ?? playheadMs)
          : undefined,
    };
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const noteLinkDrag = gesture.noteLinkDrag.current;
    if (noteLinkDrag?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      noteLinkDrag.currentX = point.x;
      noteLinkDrag.currentY = point.y;
      renderCanvasRef.current();
      return;
    }
    const paintDraft = gesture.notePaintDraft.current;
    if (paintDraft?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      const next = { ...paintDraft, currentX: point.x };
      gesture.notePaintDraft.current = next;
      renderCanvasRef.current();
      return;
    }
    const activeSelectionBox = gesture.selectionBox.current;
    if (activeSelectionBox?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      const next = {
        ...activeSelectionBox,
        currentX: point.x,
        currentY: point.y,
      };
      gesture.selectionBox.current = next;
      renderCanvasRef.current();
      const left = Math.min(next.startX, next.currentX);
      const right = Math.max(next.startX, next.currentX);
      const top = Math.min(next.startY, next.currentY);
      const bottom = Math.max(next.startY, next.currentY);
      const nextIds = new Set(next.initialNoteIds);
      gesture.hitRegions.current.forEach((region) => {
        if (
          region.kind === 'note' &&
          region.right >= left &&
          region.left <= right &&
          region.bottom >= top &&
          region.top <= bottom
        ) {
          nextIds.add(region.id);
        }
      });
      setSelectedNoteIds(nextIds);
      setSelection((current) => {
        if (current?.kind === 'note' && nextIds.has(current.id)) {
          return current;
        }
        const firstId = nextIds.values().next().value as string | undefined;
        return firstId ? { kind: 'note', id: firstId } : undefined;
      });
      return;
    }
    const pan = gesture.pan.current;
    if (pan) {
      const point = canvasPoint(event);
      const plotWidth = Math.max(1, point.width - 72);
      setViewStartMs(
        karaokeMakerPannedViewportStart(
          pan.viewStartMs,
          point.x - pan.pointerX,
          plotWidth,
          visibleViewDurationMs,
          maximumViewStartMs,
        ),
      );
      return;
    }
    if (gesture.scrub.current?.pointerId === event.pointerId) {
      const scrub = gesture.scrub.current;
      const scrubPoint = canvasPoint(event);
      scrub.anchorMs = seekCanvasPoint(scrubPoint);
      scrub.auditionWordGrain = gesture.hitRegions.current.some(
        (region) =>
          region.kind === 'word' &&
          region.behavior === undefined &&
          scrubPoint.x >= region.left &&
          scrubPoint.x <= region.right &&
          scrubPoint.y >= region.top &&
          scrubPoint.y <= region.bottom,
      );
      setScrubAuditionAnchorMs(scrub.anchorMs);
      auditionWordScrubGrain(scrub);
      return;
    }
    const drag = gesture.drag.current;
    const point = canvasPoint(event);
    if (!drag) {
      const hovered = [...gesture.hitRegions.current]
        .reverse()
        .find(
          (region) =>
            (region.kind === 'note' || region.behavior !== undefined) &&
            point.x >= region.left - 5 &&
            point.x <= region.right + 5 &&
            point.y >= region.top &&
            point.y <= region.bottom,
        );
      setIsPitchPanReady(
        !hovered &&
          !handPanMode &&
          noteEditMode === undefined &&
          !lineEntryMode &&
          point.y >= headerHeight,
      );
      if (!hovered) {
        setHoveredEditHandle(undefined);
        return;
      }
      const leftDistance = Math.abs(point.x - hovered.left);
      const rightDistance = Math.abs(point.x - hovered.right);
      let behavior: IDragState['behavior'] = hovered.behavior ?? 'move';
      const attachedNote =
        hovered.kind === 'note'
          ? project.melody.notes.find((note) => note.id === hovered.id)
          : undefined;
      if (attachedNote?.tokenId) {
        setHoveredEditHandle(undefined);
        return;
      }
      if (!hovered.behavior && Math.min(leftDistance, rightDistance) <= 8) {
        behavior = leftDistance < rightDistance ? 'resize-start' : 'resize-end';
      }
      setHoveredEditHandle((current) =>
        current?.kind === hovered.kind &&
        current.id === hovered.id &&
        current.behavior === behavior
          ? current
          : { kind: hovered.kind, id: hovered.id, behavior },
      );
      return;
    }
    setIsPitchPanReady(false);
    setHoveredEditHandle(undefined);
    const timeDelta =
      ((point.x - drag.pointerX) / Math.max(1, point.width - 72)) *
      visibleViewDurationMs;
    const semitoneDelta = Math.round(
      (-(point.y - drag.pointerY) /
        Math.max(1, event.currentTarget.clientHeight - headerHeight - 28)) *
        (MAX_NOTE_MIDI - MIN_NOTE_MIDI),
    );
    if (drag.selection.kind === 'note') {
      const movingNoteIds = new Set(
        drag.noteIds?.length ? drag.noteIds : [drag.selection.id],
      );
      const movingNotes = drag.base.melody.notes.filter((note) =>
        movingNoteIds.has(note.id),
      );
      if (drag.behavior === 'move') {
        const baseNote = drag.base.melody.notes.find(
          (note) => note.id === drag.selection.id,
        );
        if (movingNotes.length) {
          const movableNotes = movingNotes.filter((note) => !note.tokenId);
          const minimumStartMs = movableNotes.length
            ? Math.min(...movableNotes.map((note) => note.startMs))
            : 0;
          const maximumEndMs = movableNotes.length
            ? Math.max(...movableNotes.map((note) => note.endMs))
            : effectiveDurationMs;
          const minimumMidi = movableNotes.length
            ? Math.min(...movableNotes.map((note) => note.targetMidi))
            : MIN_NOTE_MIDI;
          const maximumMidi = movableNotes.length
            ? Math.max(...movableNotes.map((note) => note.targetMidi))
            : MAX_NOTE_MIDI;
          const clampedTimeDelta = movableNotes.length
            ? Math.max(
                -minimumStartMs,
                Math.min(effectiveDurationMs - maximumEndMs, timeDelta),
              )
            : 0;
          const clampedSemitoneDelta = movableNotes.length
            ? Math.max(
                MIN_NOTE_MIDI - minimumMidi,
                Math.min(MAX_NOTE_MIDI - maximumMidi, semitoneDelta),
              )
            : 0;
          if (
            baseNote &&
            !baseNote.tokenId &&
            (Math.abs(clampedTimeDelta) > 0.5 || clampedSemitoneDelta !== 0)
          ) {
            const auditionMidi = baseNote.targetMidi + clampedSemitoneDelta;
            drag.finalAuditionMidi = auditionMidi;
            drag.finalAuditionDurationMs =
              karaokeLeadNoteArticulation(baseNote).durationMs;
            if (gesture.lastDragAuditionMidi.current !== auditionMidi) {
              gesture.lastDragAuditionMidi.current = auditionMidi;
              noteAudition.play(auditionMidi, 190);
            }
          }
          setProject({
            ...drag.base,
            melody: {
              ...drag.base.melody,
              source: 'manual',
              notes: drag.base.melody.notes.map((note) =>
                movingNoteIds.has(note.id) && !note.tokenId
                  ? {
                      ...note,
                      startMs: note.startMs + clampedTimeDelta,
                      endMs: note.endMs + clampedTimeDelta,
                      targetMidi: note.targetMidi + clampedSemitoneDelta,
                      source: 'manual' as const,
                    }
                  : note,
              ),
            },
          });
        }
        return;
      }
      setProject(
        replaceNote(drag.base, drag.selection.id, (note) => {
          if (note.tokenId) {
            return note;
          }
          if (drag.behavior === 'resize-start') {
            return {
              ...note,
              startMs: Math.max(
                0,
                Math.min(note.endMs - 40, note.startMs + timeDelta),
              ),
              source: 'manual',
            };
          }
          return {
            ...note,
            endMs: Math.min(
              effectiveDurationMs,
              Math.max(note.startMs + 40, note.endMs + timeDelta),
            ),
            source: 'manual',
          };
        }),
      );
      return;
    }
    const baseToken = flattenTokens(drag.base).find(
      (token) => token.id === drag.selection.id,
    );
    if (
      !baseToken ||
      baseToken.startMs === undefined ||
      baseToken.endMs === undefined
    ) {
      return;
    }
    const shifted =
      drag.behavior === 'move'
        ? shiftKaraokeMakerLineTailFromToken(drag.base, baseToken.id, timeDelta)
        : resizeKaraokeMakerTokenBoundary(
            drag.base,
            baseToken.id,
            drag.behavior === 'resize-start' ? 'start' : 'end',
            (drag.behavior === 'resize-start'
              ? baseToken.startMs
              : baseToken.endMs) + timeDelta,
          );
    const movedToken = flattenTokens(shifted).find(
      (token) => token.id === baseToken.id,
    );
    if (movedToken?.startMs !== undefined && movedToken.endMs !== undefined) {
      auditionDraggedWord(drag, movedToken.startMs, movedToken.endMs);
    }
    setProject(shifted);
  };

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
      const targetMidi = canvasMidiAtY(paintDraft.y, point.height);
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
      if (scrub.grainTimerId !== undefined) {
        window.clearTimeout(scrub.grainTimerId);
      }
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
    if (drag.auditionTimerId !== undefined) {
      window.clearTimeout(drag.auditionTimerId);
    }
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

  const onCanvasWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setFollowViewport(false);
    if (event.ctrlKey || event.metaKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorProgress = Math.max(
        0,
        Math.min(
          1,
          (event.clientX - rect.left - 54) / Math.max(1, rect.width - 72),
        ),
      );
      const cursorTime = viewStartMs + cursorProgress * visibleViewDurationMs;
      const nextDuration = Math.max(
        minimumViewDurationMs,
        Math.min(
          maximumViewDurationMs,
          visibleViewDurationMs * Math.exp(event.deltaY * 0.002),
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
