/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_NOTE_MIDI,
  MIN_NOTE_MIDI,
  makerPitchAtY,
  makerPlot,
} from 'renderer/karaoke/makerCanvasGeometry';
import {
  FIT_MARGIN_SEMITONES,
  FULL_PITCH_WINDOW,
  IMakerPitchWindow,
  MIN_PITCH_SPAN,
  clampPitchWindow,
  fitPitchWindow,
  panPitchWindow,
  pitchWindowSpan,
  zoomPitchWindow,
} from 'renderer/karaoke/makerPitchView';

const plotFor = (pitchWindow: IMakerPitchWindow) =>
  makerPlot({
    width: 900,
    height: 500,
    headerHeight: 180,
    viewStartMs: 0,
    visibleViewDurationMs: 12_000,
    pitchWindow,
  });

const FULL_SPAN = MAX_NOTE_MIDI - MIN_NOTE_MIDI;

/**
 * The pitch zoom is one window read by everything that turns a pitch into a
 * height and back: the paint, the hit-testing and the note drag. If the two
 * directions disagree at any zoom, a note is drawn on one row and dropped on
 * another.
 */
describe('the Maker note grid pitch window', () => {
  it.each([
    ['the whole grid', FULL_PITCH_WINDOW],
    ['two octaves', { lowMidi: 48, highMidi: 72 }],
    ['one octave', { lowMidi: 60, highMidi: 72 }],
    ['a fractional window', { lowMidi: 50.4, highMidi: 67.9 }],
  ])('maps pitch to height and back exactly at %s', (_name, window) => {
    const plot = plotFor(window);
    expect(plot.noteY(window.highMidi)).toBeCloseTo(plot.top, 9);
    expect(plot.noteY(window.lowMidi)).toBeCloseTo(plot.bottom, 9);
    for (let midi = window.lowMidi; midi <= window.highMidi; midi += 0.75) {
      expect(plot.yNote(plot.noteY(midi))).toBeCloseTo(midi, 9);
    }
    expect(plot.semitoneHeight).toBeCloseTo(
      plot.height / (window.highMidi - window.lowMidi),
      9,
    );
  });

  it('draws a pitch higher up the screen as the window zooms in on it', () => {
    // The positive control for the round trip: a mapping that ignored the
    // window would round-trip perfectly too, and put C4 in the same place at
    // every zoom.
    // The whole grid (24 to 96) is centred on C4, so the octave zoomed into
    // stands off it, C4 two semitones from its top: centred on C4 as well,
    // the two would agree there by the arithmetic alone.
    const whole = plotFor(FULL_PITCH_WINDOW);
    const octave = plotFor({ lowMidi: 50, highMidi: 62 });
    expect(whole.noteY(60)).toBeCloseTo((whole.top + whole.bottom) / 2, 9);
    expect(octave.noteY(60)).toBeLessThan(whole.noteY(60) - 1);
    expect(octave.noteY(60)).toBeCloseTo(
      octave.top + octave.semitoneHeight * 2,
      9,
    );
    expect(octave.semitoneHeight).toBeCloseTo(whole.semitoneHeight * 6, 9);
  });

  it('commits a press to a row the window shows, inside the grid', () => {
    const plot = plotFor({ lowMidi: 60, highMidi: 72 });
    expect(makerPitchAtY(plot, plot.noteY(65.2))).toBe(65);
    expect(makerPitchAtY(plot, plot.top - 40)).toBe(72);
    expect(makerPitchAtY(plot, plot.bottom + 40)).toBe(60);
    const whole = plotFor(FULL_PITCH_WINDOW);
    expect(makerPitchAtY(whole, whole.top - 400)).toBe(MAX_NOTE_MIDI);
  });

  it('fits the notes with two semitones to spare, and the whole grid without notes', () => {
    const notes = [{ targetMidi: 55 }, { targetMidi: 69 }, { targetMidi: 62 }];
    expect(fitPitchWindow(notes)).toEqual({
      lowMidi: 55 - FIT_MARGIN_SEMITONES,
      highMidi: 69 + FIT_MARGIN_SEMITONES,
    });
    // The control: without notes there is nothing to fit, and the fit above
    // is not simply what every call returns.
    expect(fitPitchWindow([])).toEqual(FULL_PITCH_WINDOW);
    expect(fitPitchWindow(notes)).not.toEqual(FULL_PITCH_WINDOW);
  });

  it('opens a fit around one note to an octave, centred on it', () => {
    expect(fitPitchWindow([{ targetMidi: 60 }])).toEqual({
      lowMidi: 54,
      highMidi: 66,
    });
  });

  it('fits notes past the grid at the grid edge they are pinned to', () => {
    const window = fitPitchWindow([{ targetMidi: 100 }, { targetMidi: 90 }]);
    expect(window.highMidi).toBe(MAX_NOTE_MIDI);
    expect(pitchWindowSpan(window)).toBeGreaterThanOrEqual(MIN_PITCH_SPAN);
  });

  it('never zooms in past one octave', () => {
    let window: IMakerPitchWindow = FULL_PITCH_WINDOW;
    for (let notch = 0; notch < 40; notch += 1) {
      window = zoomPitchWindow(window, 60, 0.5);
    }
    expect(pitchWindowSpan(window)).toBeCloseTo(MIN_PITCH_SPAN, 9);
    // The control: one moderate step is not clamped, so the floor above is
    // the floor and not a zoom that always lands on twelve.
    const oneStep = zoomPitchWindow(FULL_PITCH_WINDOW, 60, 0.5);
    expect(pitchWindowSpan(oneStep)).toBeCloseTo(FULL_SPAN / 2, 9);
  });

  it('never shows more than the whole grid, nor anything past it', () => {
    let window: IMakerPitchWindow = { lowMidi: 60, highMidi: 72 };
    for (let notch = 0; notch < 40; notch += 1) {
      window = zoomPitchWindow(window, 90, 2);
    }
    expect(window).toEqual(FULL_PITCH_WINDOW);
    expect(panPitchWindow({ lowMidi: 80, highMidi: 92 }, 30)).toEqual({
      lowMidi: MAX_NOTE_MIDI - 12,
      highMidi: MAX_NOTE_MIDI,
    });
    expect(clampPitchWindow({ lowMidi: Number.NaN, highMidi: 70 })).toEqual(
      FULL_PITCH_WINDOW,
    );
  });

  it('keeps the pitch under the pointer where it was while zooming', () => {
    const before = { lowMidi: 40, highMidi: 80 };
    const after = zoomPitchWindow(before, 50, 0.5);
    const share = (window: IMakerPitchWindow) =>
      (50 - window.lowMidi) / pitchWindowSpan(window);
    expect(share(after)).toBeCloseTo(share(before), 9);
    expect(pitchWindowSpan(after)).toBeCloseTo(20, 9);
  });
});
