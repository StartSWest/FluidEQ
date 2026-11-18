/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import KaraokePitchLane from '../../renderer/karaoke/KaraokePitchLane';
import {
  easeKaraokeSingerTrace,
  findKaraokePitchIssues,
  IKaraokePitchPoint,
  karaokePitchScrubTime,
  PLOT_LEFT,
  PLOT_RIGHT,
} from '../../renderer/karaoke/karaokePitchGeometry';

const fireTestPointer = (
  target: Element,
  type: string,
  pointerId: number,
  clientX: number,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: 0 },
    pointerId: { value: pointerId },
  });
  fireEvent(target, event);
};

describe('KaraokePitchLane', () => {
  it('eases the visible singer trace without following brief octave spikes', () => {
    const eased = easeKaraokeSingerTrace(
      [
        { midi: 60, timeMs: 0, voiced: true },
        { midi: 60, timeMs: 45, voiced: true },
        { midi: 72, timeMs: 90, voiced: true },
        { midi: 60, timeMs: 135, voiced: true },
      ],
      60,
    );

    expect(eased).toEqual([60, 60, 60, 60]);
  });

  it('moves smoothly to a sustained note and settles gently through silence', () => {
    const eased = easeKaraokeSingerTrace(
      [
        { midi: 60, timeMs: 0, voiced: true },
        { midi: 67, timeMs: 45, voiced: true },
        { midi: 67, timeMs: 90, voiced: true },
        { midi: 67, timeMs: 135, voiced: true },
        { midi: 60, timeMs: 360, voiced: false },
      ],
      60,
    );

    expect(eased[1]).toBeGreaterThan(60);
    expect(eased[1]).toBeLessThan(67);
    expect(eased[2]).toBeGreaterThan(eased[1]);
    expect(eased[3]).toBeGreaterThan(eased[2]);
    expect(eased[4]).toBeLessThan(eased[3]);
    expect(eased[4]).toBeGreaterThan(60);
  });

  it('scrubs the song by dragging the game lane and pauses on release', () => {
    const onScrubStart = jest.fn();
    const onScrub = jest.fn();
    const onScrubEnd = jest.fn();
    render(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        playheadMs={4_000}
        durationMs={10_000}
        onScrubStart={onScrubStart}
        onScrub={onScrub}
        onScrubEnd={onScrubEnd}
      />,
    );
    const canvas = screen.getByRole('button', {
      name: 'Live microphone pitch and target-note lane',
    });
    jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1_000,
      bottom: 240,
      width: 1_000,
      height: 240,
      toJSON: () => ({}),
    });

    fireTestPointer(canvas, 'pointerdown', 7, 500);
    fireTestPointer(canvas, 'pointermove', 7, 400);
    // Over the plot's own width: the gutter and the right inset are not time.
    const expectedTime = karaokePitchScrubTime(
      4_000,
      -100,
      1_000 - PLOT_LEFT - PLOT_RIGHT,
      10_000,
    );

    expect(onScrubStart).toHaveBeenCalledTimes(1);
    expect(onScrub).toHaveBeenLastCalledWith(expectedTime);
    expect(canvas).toHaveClass('is-scrubbing');

    fireTestPointer(canvas, 'pointerup', 7, 400);
    expect(onScrubEnd).toHaveBeenCalledWith(expectedTime);
    expect(canvas).not.toHaveClass('is-scrubbing');
  });

  it('finds high, low, and missed regions in the latest vocal pass', () => {
    const point = (
      songTimeMs: number,
      midi: number,
      voiced = true,
    ): IKaraokePitchPoint => ({
      midi,
      songTimeMs,
      wallTimeMs: songTimeMs,
      energy: voiced ? 0.2 : 0,
      confidence: voiced ? 0.95 : 0.2,
      voiced,
    });
    const issues = findKaraokePitchIssues(
      [
        point(50, 61),
        point(100, 61),
        point(150, 61),
        point(550, 61),
        point(600, 61),
        point(650, 61),
        point(1_050, 64, false),
        point(1_100, 64, false),
        point(1_150, 64, false),
      ],
      [
        { text: 'high', startMs: 0, endMs: 400, targetMidi: 60 },
        { text: 'low', startMs: 500, endMs: 900, targetMidi: 62 },
        { text: 'missed', startMs: 1_000, endMs: 1_400, targetMidi: 64 },
      ],
      'absolute',
    );

    expect(issues).toEqual([
      expect.objectContaining({
        kind: 'high',
        startMs: 0,
        endMs: 400,
        averageCents: 100,
      }),
      expect.objectContaining({
        kind: 'low',
        startMs: 500,
        endMs: 900,
        averageCents: -100,
      }),
      expect.objectContaining({
        kind: 'missed',
        startMs: 1_000,
        endMs: 1_400,
        averageCents: 0,
      }),
    ]);
  });

  it('renders dense word labels exclusively through the chart canvas', () => {
    const { container } = render(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        playheadMs={1_000}
        target={{
          kind: 'notes',
          source: 'singstar-xml',
          coordinateSystem: 'midi-semitones',
          octavePolicy: 'nearest-target',
          notes: Array.from({ length: 12 }, (_, index) => ({
            text: ` word${index}`,
            startsWord: true,
            startMs: index * 80,
            endMs: index * 80 + 70,
            targetMidi: 60 + (index % 3),
          })),
        }}
      />,
    );
    expect(container.querySelector('.karaoke-pitch__syllables')).toBeNull();
    expect(container.querySelector('.karaoke-pitch__legend')).toBeNull();
    expect(container.querySelector('.karaoke-pitch__review')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Real-time singer pitch curve over the song notes',
      }),
    ).toBeVisible();
  });

  // A slim strip with no title of its own since the K1 mockup (2026-11-16):
  // it is named for assistive technology, and says what fills it.
  it('explains how to start and exposes an accessible graph', () => {
    render(<KaraokePitchLane isActive analysisStatus="idle" playheadMs={0} />);

    expect(screen.getByRole('article', { name: 'Pitch lane' })).toBeVisible();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Live microphone pitch and target-note lane',
      }),
    ).toBeVisible();
    expect(
      screen.getByText('Turn on the microphone to see your pitch.'),
    ).toBeVisible();
  });

  // The note being sung and how far off it is, in the strip's corner beside
  // the microphone's button, only while the microphone is on (K1, E mockup).
  it('shows the live note beside the microphone while it is on', () => {
    const { container } = render(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="live"
        playheadMs={1_000}
        pitch={{
          frequencyHz: 440,
          midi: 69,
          note: 'A4',
          cents: 0,
          confidence: 0.99,
          rms: 0.2,
          capturedAtMs: 12,
          processingMs: 1,
        }}
        target={{
          kind: 'notes',
          source: 'singstar-xml',
          coordinateSystem: 'midi-semitones',
          octavePolicy: 'nearest-target',
          notes: [
            {
              text: 'Sing',
              startMs: 900,
              endMs: 1_400,
              targetMidi: 69,
            },
          ],
        }}
      />,
    );

    const readout = container.querySelector('.karaoke-pitch__readout');
    expect(readout).toHaveTextContent('A4');
    expect(readout).toHaveTextContent('+0 ¢');
    expect(container.querySelector('.karaoke-pitch')).toHaveClass(
      'has-targets',
    );
    expect(container.querySelector('.karaoke-pitch__syllables')).toBeNull();
  });

  it('shows no live note while the microphone is off', () => {
    const { container } = render(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        microphoneStatus="off"
        playheadMs={1_000}
        pitch={{
          frequencyHz: 440,
          midi: 69,
          note: 'A4',
          cents: 0,
          confidence: 0.99,
          rms: 0.2,
          capturedAtMs: 12,
          processingMs: 1,
        }}
      />,
    );
    expect(container.querySelector('.karaoke-pitch__readout')).toBeNull();
    expect(screen.queryByText('A4')).toBeNull();
  });

  // The strip's own round key in its corner (the K1 mockup), pressed while
  // the microphone is live.
  it('offers the microphone switch in the strip’s corner', () => {
    const onToggleMicrophone = jest.fn();
    const { container, rerender } = render(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        playheadMs={0}
        microphoneStatus="off"
        onToggleMicrophone={onToggleMicrophone}
      />,
    );

    const turnOn = screen.getByRole('button', { name: 'Turn on mic' });
    expect(turnOn).toHaveClass('karaoke-pitch__mic');
    expect(turnOn).toHaveAttribute('aria-pressed', 'false');
    expect(turnOn.closest('.karaoke-pitch__corner')).not.toBeNull();
    fireEvent.click(turnOn);
    expect(onToggleMicrophone).toHaveBeenCalledTimes(1);

    rerender(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        playheadMs={0}
        microphoneStatus="live"
        onToggleMicrophone={onToggleMicrophone}
      />,
    );
    const turnOff = screen.getByRole('button', { name: 'Turn off mic' });
    expect(turnOff).toHaveAttribute('aria-pressed', 'true');
    expect(turnOff).toHaveClass('is-live');
    // And it says what it hears beside it: nothing yet.
    expect(
      container.querySelector('.karaoke-pitch__readout'),
    ).toBeInTheDocument();
  });

  it('keeps the melody-tone controls in the shared transport', () => {
    const target = {
      kind: 'notes' as const,
      source: 'ultrastar',
      coordinateSystem: 'midi-semitones' as const,
      octavePolicy: 'nearest-target' as const,
      notes: [
        {
          text: 'sing',
          startMs: 500,
          endMs: 1_500,
          targetMidi: 69,
        },
      ],
    };
    render(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        playheadMs={1_000}
        target={target}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Play melody guide tone' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('slider', { name: 'Melody tone volume' }),
    ).not.toBeInTheDocument();
  });

  it('uses one combined song-note and live singer-pitch view', () => {
    render(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
        playheadMs={1_000}
        target={{
          kind: 'notes',
          source: 'ultrastar',
          coordinateSystem: 'midi-semitones',
          octavePolicy: 'nearest-target',
          notes: [
            {
              text: 'sing',
              startMs: 500,
              endMs: 1_500,
              targetMidi: 69,
              kind: 'normal',
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Real-time singer pitch curve over the song notes',
      }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Curve' })).toBeNull();
    // No legend under it since the K1 mockup: the strip is the notes and the
    // voice, and nothing written round it.
    expect(document.querySelector('.karaoke-pitch__legend')).toBeNull();
  });
});
