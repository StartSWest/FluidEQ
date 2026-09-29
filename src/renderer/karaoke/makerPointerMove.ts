/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import { karaokeMakerPannedViewportStart } from './makerCanvasLayout';
import { IDragState } from './makerCanvasTypes';
import { MAX_NOTE_MIDI, MIN_NOTE_MIDI } from './makerCanvasGeometry';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';
import { flattenTokens, replaceNote } from './makerProjectEdits';
import {
  resizeKaraokeMakerTokenBoundary,
  shiftKaraokeMakerLineTailFromToken,
} from '../../common/karaoke/makerProject';
import {
  type ICanvasScrubState,
  type IMakerCanvasGesture,
} from './useMakerCanvasGesture';
import { type TSelection } from './useKaraokeMakerSelection';
import { type IKaraokeMakerProject } from '../../common/karaoke/makerProject/model';

interface IMakerPointerMoveInput {
  gesture: IMakerCanvasGesture;
  canvasPoint: (event: ReactPointerEvent<HTMLCanvasElement>) => {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  renderCanvasRef: React.MutableRefObject<() => void>;
  setSelectedNoteIds: Dispatch<SetStateAction<Set<string>>>;
  setSelection: Dispatch<SetStateAction<TSelection>>;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  visibleViewDurationMs: number;
  maximumViewStartMs: number;
  seekCanvasPoint: (
    point: ReturnType<
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    >,
  ) => number;
  setScrubAuditionAnchorMs: Dispatch<SetStateAction<number | undefined>>;
  auditionWordScrubGrain: (scrub: ICanvasScrubState) => void;
  setIsPitchPanReady: Dispatch<SetStateAction<boolean>>;
  handPanMode: boolean;
  noteEditMode: 'select' | 'paint' | undefined;
  lineEntryMode: boolean;
  headerHeight: number;
  setHoveredEditHandle: Dispatch<
    SetStateAction<
      | { kind: 'word' | 'note'; id: string; behavior: IDragState['behavior'] }
      | undefined
    >
  >;
  project: IKaraokeMakerProject;
  effectiveDurationMs: number;
  noteAudition: {
    play: (midi: number, durationMs?: number) => void;
    stop: (releaseSeconds?: number) => void;
  };
  setProject: Dispatch<SetStateAction<IKaraokeMakerProject>>;
  auditionDraggedWord: (
    drag: IDragState,
    startMs: number,
    endMs: number,
  ) => void;
}

/**
 * The editor canvas's pointer moving: a note being linked to a word, a pan,
 * a scrub with its word grains, a word or note being dragged or resized
 * (and auditioned as it goes), a selection box growing, or — with no button
 * held — which handle the pointer is over, for the cursor. Built on every
 * render with the gesture and the project it acts on.
 */
const makerPointerMove = ({
  gesture,
  canvasPoint,
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
}: IMakerPointerMoveInput) => {
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

  return { onCanvasPointerMove };
};

export default makerPointerMove;
