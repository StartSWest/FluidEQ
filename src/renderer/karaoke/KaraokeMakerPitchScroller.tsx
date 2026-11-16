/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { midiToNoteName } from '../../common/karaoke/pitch';
import {
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
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

const FULL_SPAN = MAX_NOTE_MIDI - MIN_NOTE_MIDI;

/** Arrow keys scroll a semitone; Page keys a window, less a shared row. */
const KEY_STEP_SEMITONES = 1;

/** `+` and `-` zoom by this much, as the song strip's keys zoom time. */
const KEY_ZOOM_FACTOR = 0.8;

/** A wheel notch over the bar scrolls a tenth of the window, as on the grid. */
const WHEEL_SCROLL_PER_WINDOW = 1_000;

interface IKaraokeMakerPitchScrollerProps {
  pitchWindow: IMakerPitchWindow;
  /** Where the note grid starts, in pixels from the canvas top. */
  gridTop: number;
  /** The canvas the bar scrolls, for assistive technology. */
  controls: string;
  label: string;
  /** The gestures, said once on the bar's tooltip. */
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

/**
 * The note grid's pitch scroller: a slim bar in the gutter beside the octave
 * names, its thumb the window of pitch on screen against the whole grid —
 * the song strip under the canvas, turned on its side for pitch.
 *
 * It is drawn and handled as that strip's window is: an accent frame with a
 * grip at each end. Drag a grip to zoom from that end, drag the body to
 * scroll, press the bar off the window to jump there, double-click to fit
 * the song's notes. The wheel over it scrolls pitch with no key held, as any
 * scroll bar does. There is no separate fit button: a glyph floating over
 * the octave names read as a stray box, framed or not (Ivan, 2026-11-15:
 * "this icon not good", "still not good").
 */
const KaraokeMakerPitchScroller = ({
  pitchWindow,
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
  const dragRef = useRef<IPitchScrollerDrag | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const span = pitchWindowSpan(pitchWindow);

  // Through a ref so one listener serves the life of the bar; see
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
    const pressedMidi =
      MAX_NOTE_MIDI - ((event.clientY - rect.top) / trackHeight) * FULL_SPAN;
    const grip = (event.target as Element).closest('[data-edge]');
    const edgeName = grip?.getAttribute('data-edge');
    const edge: TPitchWindowEdge | undefined =
      edgeName === 'high' || edgeName === 'low' ? edgeName : undefined;
    let origin = pitchWindow;
    // Off the thumb, the window jumps to centre on the press first, and the
    // drag carries on from there, as a scroll bar's track does.
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

  const thumbTop = ((MAX_NOTE_MIDI - pitchWindow.highMidi) / FULL_SPAN) * 100;
  const thumbHeight = (span / FULL_SPAN) * 100;
  const range = `${midiToNoteName(pitchWindow.lowMidi)}–${midiToNoteName(
    pitchWindow.highMidi,
  )}`;

  return (
    <div
      ref={trackRef}
      className={`karaoke-maker-pitch${dragging ? ' is-dragging' : ''}`}
      style={{ top: gridTop, bottom: PLOT_BOTTOM_INSET }}
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
      onKeyDown={onKeyDown}
      onDoubleClick={onFit}
    >
      <span
        className="karaoke-maker-pitch__thumb"
        style={{ top: `${thumbTop}%`, height: `${thumbHeight}%` }}
      >
        <span className="karaoke-maker-pitch__grip is-high" data-edge="high" />
        <span className="karaoke-maker-pitch__grip is-low" data-edge="low" />
      </span>
    </div>
  );
};

export default KaraokeMakerPitchScroller;
