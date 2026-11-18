/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { midiToNoteName } from '../../common/karaoke/pitch';
import { IKaraokeMakerNote } from '../../common/karaoke/makerProject';
import {
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  PITCH_STRIP_LEFT,
  PITCH_STRIP_WIDTH,
  PLOT_BOTTOM_INSET,
} from './makerCanvasGeometry';
import {
  IMakerPitchWindow,
  TPitchWindowEdge,
  clampPitchWindow,
  panPitchWindow,
  pitchWindowSpan,
  resizePitchWindow,
} from './makerPitchView';
import { readAccent, readAccentLight } from '../utils/theme';
import { inkForSide } from './karaokeCanvasInk';

const FULL_SPAN = MAX_NOTE_MIDI - MIN_NOTE_MIDI;

/** Arrow keys scroll a semitone; Page keys a window, less a shared row. */
const KEY_STEP_SEMITONES = 1;

/** `+` and `-` zoom by this much, as the song strip's keys zoom time. */
const KEY_ZOOM_FACTOR = 0.8;

/** A wheel notch over the strip scrolls a tenth of the window, as on the grid. */
const WHEEL_SCROLL_PER_WINDOW = 1_000;

/** How near a window's end a press takes that end, in pixels: the grip. */
const GRIP_REACH_PX = 7;

/** The window's frame stands in from the strip's sides by this much. */
const WINDOW_INSET_PX = 1;

interface IKaraokeMakerPitchScrollerProps {
  pitchWindow: IMakerPitchWindow;
  /** The song's notes, drawn small inside the strip. */
  notes: readonly IKaraokeMakerNote[];
  /** The song's length, which the strip's width stands for. */
  durationMs: number;
  /** Where the note grid starts, in pixels from the canvas top. */
  gridTop: number;
  /** The canvas the strip scrolls, for assistive technology. */
  controls: string;
  label: string;
  /** The gestures, said once on the strip's tooltip. */
  hint: string;
  onPan: (semitones: number) => void;
  onZoom: (anchorMidi: number, factor: number) => void;
  onShow: (window: IMakerPitchWindow) => void;
  onFit: () => void;
}

interface IPitchScrollerDrag {
  pointerId: number;
  /** A grip resizes the window from that end; the body moves it whole. */
  edge: TPitchWindowEdge | undefined;
  originY: number;
  origin: IMakerPitchWindow;
  trackHeight: number;
}

/** The window's top and bottom in the strip, in pixels. */
const windowExtent = (window: IMakerPitchWindow, height: number) => ({
  top: ((MAX_NOTE_MIDI - window.highMidi) / FULL_SPAN) * height,
  bottom: ((MAX_NOTE_MIDI - window.lowMidi) / FULL_SPAN) * height,
});

/** Which end of the window a point `y` pixels down the strip would take. */
const edgeAt = (
  window: IMakerPitchWindow,
  y: number,
  height: number,
): TPitchWindowEdge | undefined => {
  const { top, bottom } = windowExtent(window, height);
  // A short window keeps a body to drag: each grip reaches at most a third.
  const reach = Math.min(GRIP_REACH_PX, (bottom - top) / 3);
  if (Math.abs(y - top) <= reach) {
    return 'high';
  }
  if (Math.abs(y - bottom) <= reach) {
    return 'low';
  }
  return undefined;
};

/**
 * The note grid's pitch strip: the whole song in miniature down the gutter
 * against the left edge, the note names beside it - every note at its pitch,
 * time running across - and over it the window of pitch on screen. It is
 * the song strip under the canvas turned on its side, drawn as that strip
 * is (the notes in the accent, what is off screen faint, the window in the
 * light accent with a bright grip at each end) but on no floor of its own,
 * and handled as it is: drag a grip to zoom from that end, the body to
 * scroll, press off the window to jump there, double-click to fit the
 * song's notes. The wheel over it scrolls
 * pitch with no key held, as any scroll bar does.
 *
 * Ivan, 2026-11-15, on the slim bar it replaced: "make it like the
 * horizontal one, covering the notes so I can see them inside", and then
 * "don't do a background, and put it on the left, the notes to its right".
 */
const KaraokeMakerPitchScroller = ({
  pitchWindow,
  notes,
  durationMs,
  gridTop,
  controls,
  label,
  hint,
  onPan,
  onZoom,
  onShow,
  onFit,
}: IKaraokeMakerPitchScrollerProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<IPitchScrollerDrag | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<TPitchWindowEdge | undefined>();
  const span = pitchWindowSpan(pitchWindow);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
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
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    // No floor of its own (Ivan, 2026-11-15: "don't do a background"): the
    // notes and the window stand on the canvas's own plot colour.
    // Every note at its pitch, the song's time across the strip: the melody
    // in miniature, so where the window sits says what it shows.
    const rowHeight = Math.max(1, Math.min(2, height / FULL_SPAN));
    const length = Math.max(1, durationMs);
    notes.forEach((note) => {
      const midi = Math.min(
        MAX_NOTE_MIDI,
        Math.max(MIN_NOTE_MIDI, note.targetMidi),
      );
      const y = ((MAX_NOTE_MIDI - midi) / FULL_SPAN) * height;
      const left = 2 + (note.startMs / length) * (width - 4);
      const right = 2 + (note.endMs / length) * (width - 4);
      // What is off screen is faint, where the song strip dims it under a
      // veil: with no floor, a veil would draw the floor back.
      const isShown =
        midi >= pitchWindow.lowMidi && midi <= pitchWindow.highMidi;
      const strength = isShown ? 1 : 0.4;
      let tick = readAccent(0.85 * strength, 'rgba(54, 225, 213, .85)');
      if (note.kind === 'golden') {
        tick = inkForSide(`rgba(255, 207, 87, ${0.85 * strength})`);
      } else if (note.kind === 'free') {
        tick = readAccent(0.3 * strength, 'rgba(54, 225, 213, .3)');
      }
      context.fillStyle = tick;
      context.fillRect(
        left,
        y - rowHeight / 2,
        Math.max(1, right - left),
        rowHeight,
      );
    });

    const { top, bottom } = windowExtent(pitchWindow, height);

    // The window: its fill and its light edge, flat.
    const frameTop = Math.max(1, top);
    const frameBottom = Math.min(height - 1, bottom);
    context.fillStyle = readAccent(0.2, 'rgba(26, 187, 186, .2)');
    context.strokeStyle = readAccentLight(0.98, 'rgba(132, 255, 245, .98)');
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(
      WINDOW_INSET_PX,
      frameTop,
      width - WINDOW_INSET_PX * 2,
      Math.max(2, frameBottom - frameTop),
      5,
    );
    context.fill();
    context.stroke();

    // A grip at each end, the song strip's own turned across.
    [frameTop, frameBottom].forEach((edgeY) => {
      context.fillStyle = readAccentLight(1, '#bafff8');
      context.beginPath();
      context.roundRect(width / 2 - 8, edgeY - 3, 16, 6, 3);
      context.fill();
      context.fillStyle = readAccent(0.55, 'rgba(0, 229, 207, 0.55)');
      context.fillRect(width / 2 - 4, edgeY - 0.6, 8, 1.2);
    });
  }, [durationMs, notes, pitchWindow]);

  useLayoutEffect(() => {
    draw();
  }, [draw]);

  // Redrawn at its new size whenever the strip is resized: the grid's height
  // follows the window, and a canvas keeps the pixels it was drawn at.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // Through a ref so one listener serves the life of the strip; see
  // `useCanvasWheel.ts` for why a wheel that cancels must be attached by hand.
  const wheelRef = useRef({ onPan, span });
  wheelRef.current = { onPan, span };
  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const turn = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      wheelRef.current.onPan(
        (-turn * wheelRef.current.span) / WHEEL_SCROLL_PER_WINDOW,
      );
    };
    track.addEventListener('wheel', onWheel, { passive: false });
    return () => track.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const trackHeight = Math.max(1, rect.height);
    const y = event.clientY - rect.top;
    const pressedMidi = MAX_NOTE_MIDI - (y / trackHeight) * FULL_SPAN;
    const edge = edgeAt(pitchWindow, y, trackHeight);
    let origin = pitchWindow;
    // Off the window, it jumps to centre on the press first, and the drag
    // carries on from there, as a scroll bar's track does.
    if (
      edge === undefined &&
      (pressedMidi > pitchWindow.highMidi || pressedMidi < pitchWindow.lowMidi)
    ) {
      origin = clampPitchWindow({
        lowMidi: pressedMidi - span / 2,
        highMidi: pressedMidi + span / 2,
      });
      onShow(origin);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      edge,
      originY: event.clientY,
      origin,
      trackHeight,
    };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      setHoverEdge(
        edgeAt(pitchWindow, event.clientY - rect.top, Math.max(1, rect.height)),
      );
      return;
    }
    const semitones =
      (-(event.clientY - drag.originY) / drag.trackHeight) * FULL_SPAN;
    onShow(
      drag.edge === undefined
        ? panPitchWindow(drag.origin, semitones)
        : resizePitchWindow(drag.origin, drag.edge, semitones),
    );
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = undefined;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const centre = (pitchWindow.lowMidi + pitchWindow.highMidi) / 2;
    const actions: Record<string, () => void> = {
      ArrowUp: () => onPan(KEY_STEP_SEMITONES),
      ArrowDown: () => onPan(-KEY_STEP_SEMITONES),
      PageUp: () => onPan(span - KEY_STEP_SEMITONES),
      PageDown: () => onPan(-(span - KEY_STEP_SEMITONES)),
      Home: () =>
        onShow({ lowMidi: MAX_NOTE_MIDI - span, highMidi: MAX_NOTE_MIDI }),
      End: () =>
        onShow({ lowMidi: MIN_NOTE_MIDI, highMidi: MIN_NOTE_MIDI + span }),
      '+': () => onZoom(centre, KEY_ZOOM_FACTOR),
      '=': () => onZoom(centre, KEY_ZOOM_FACTOR),
      '-': () => onZoom(centre, 1 / KEY_ZOOM_FACTOR),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const range = `${midiToNoteName(pitchWindow.lowMidi)}–${midiToNoteName(
    pitchWindow.highMidi,
  )}`;
  const edgeClass =
    hoverEdge !== undefined || dragRef.current?.edge !== undefined
      ? ' is-at-edge'
      : '';

  return (
    <div
      ref={trackRef}
      className={`karaoke-maker-pitch${dragging ? ' is-dragging' : ''}${edgeClass}`}
      style={{
        top: gridTop,
        bottom: PLOT_BOTTOM_INSET,
        left: PITCH_STRIP_LEFT,
        width: PITCH_STRIP_WIDTH,
      }}
      role="slider"
      tabIndex={0}
      aria-orientation="vertical"
      aria-controls={controls}
      aria-label={label}
      aria-valuemin={MIN_NOTE_MIDI}
      aria-valuemax={Math.round(MAX_NOTE_MIDI - span)}
      aria-valuenow={Math.round(pitchWindow.lowMidi)}
      aria-valuetext={range}
      title={`${label} ${range} · ${hint}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHoverEdge(undefined)}
      onKeyDown={onKeyDown}
      onDoubleClick={onFit}
    >
      <canvas ref={canvasRef} className="karaoke-maker-pitch__map" />
    </div>
  );
};

export default KaraokeMakerPitchScroller;
