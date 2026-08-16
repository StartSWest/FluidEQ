/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import {
  ICanvasSelectionBox,
  IDragState,
  INoteLinkDragState,
  INotePaintDraft,
} from './makerCanvasTypes';
import { IHitRegion } from './makerCanvasGeometry';

/** Where a pan started, so the view can be moved relative to the grab. */
export interface ICanvasPanState {
  pointerX: number;
  viewStartMs: number;
}

/** A scrub in progress, and the grain of audio it is auditioning. */
export interface ICanvasScrubState {
  pointerId?: number;
  anchorMs: number;
  auditionWordGrain: boolean;
  grainTimerId?: number;
}

/**
 * What the pointer is currently doing to the canvas.
 *
 * Eight refs that were eight separate declarations in the component, and the
 * reason the pointer handlers needed forty-five parameters: press decides what
 * the drag *is*, and move and release do nothing but read that decision back.
 * Passing them individually made the four handlers look like they each wanted
 * their own slice of the editor, when in truth they all want this.
 *
 * Refs rather than state, and deliberately. A drag produces a value on every
 * pointer event; routing that through React would re-render the whole editor
 * sixty times a second to move one note. The canvas is repainted directly
 * instead, and these are what it paints from.
 *
 * Only one gesture runs at a time — you cannot pan and paint notes with the
 * same pointer — so at most one of the mutually exclusive ones is ever set.
 * They stay separate rather than becoming a discriminated union because the
 * handlers ask "is a pan happening" far more often than "what is happening",
 * and a union would turn every one of those into a tag comparison.
 */
export interface IMakerCanvasGesture {
  /** What is under the cursor, republished by every repaint. */
  hitRegions: React.MutableRefObject<IHitRegion[]>;
  /** A note or token edge being dragged. */
  drag: React.MutableRefObject<IDragState | undefined>;
  /** The view being pushed sideways. */
  pan: React.MutableRefObject<ICanvasPanState | undefined>;
  /** The playhead being dragged along, auditioning as it goes. */
  scrub: React.MutableRefObject<ICanvasScrubState | undefined>;
  /** A rubber-band selection being drawn. */
  selectionBox: React.MutableRefObject<ICanvasSelectionBox | undefined>;
  /** A new note being painted in. */
  notePaintDraft: React.MutableRefObject<INotePaintDraft | undefined>;
  /** A link being dragged from a note to the word it belongs to. */
  noteLinkDrag: React.MutableRefObject<INoteLinkDragState | undefined>;
  /**
   * The last pitch auditioned during a drag.
   *
   * Kept so dragging across a note does not retrigger the same pitch on every
   * pointer event, which arrives as a stutter rather than as a note.
   */
  lastDragAuditionMidi: React.MutableRefObject<number | undefined>;
}

/**
 * The gesture refs, created together because they are read together.
 *
 * A hook rather than a plain object so the refs keep React's identity rules:
 * one set per mounted editor, surviving every render, and never shared between
 * two Makers open at once.
 */
export const useMakerCanvasGesture = (): IMakerCanvasGesture => ({
  hitRegions: useRef<IHitRegion[]>([]),
  drag: useRef<IDragState | undefined>(undefined),
  pan: useRef<ICanvasPanState | undefined>(undefined),
  scrub: useRef<ICanvasScrubState | undefined>(undefined),
  selectionBox: useRef<ICanvasSelectionBox | undefined>(undefined),
  notePaintDraft: useRef<INotePaintDraft | undefined>(undefined),
  noteLinkDrag: useRef<INoteLinkDragState | undefined>(undefined),
  lastDragAuditionMidi: useRef<number | undefined>(undefined),
});
