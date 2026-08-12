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
import KaraokePitchLane, {
  buildKaraokeMelodyGuide,
  easeKaraokeSingerTrace,
  findKaraokePitchIssues,
  groupKaraokePitchWords,
  IKaraokePitchPoint,
  karaokeNoteTimingState,
  karaokePitchScrubTime,
} from '../../renderer/karaoke/KaraokePitchLane';

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

  it('builds a smooth lead-melody guide and preserves real phrase gaps', () => {
    const guide = buildKaraokeMelodyGuide([
      { text: 'one', startMs: 0, endMs: 200, targetMidi: 60 },
      { text: 'two', startMs: 200, endMs: 400, targetMidi: 64 },
      { text: 'three', startMs: 600, endMs: 800, targetMidi: 67 },
    ]);

    const joinedBoundary = guide.filter((point) => point.songTimeMs === 200);
    expect(joinedBoundary).toHaveLength(1);
    expect(joinedBoundary[0]).toMatchObject({
      midi: 62,
      startsPhrase: false,
    });
    expect(guide.find((point) => point.songTimeMs === 600)).toMatchObject({
      midi: 67,
      startsPhrase: true,
    });
  });

  it('outlines a note as it approaches and when it reaches the playhead', () => {
    expect(karaokeNoteTimingState(1_000, 1_500, 200)).toBe('idle');
    expect(karaokeNoteTimingState(1_000, 1_500, 400)).toBe('approaching');
    expect(karaokeNoteTimingState(1_000, 1_500, 1_000)).toBe('active');
    expect(karaokeNoteTimingState(1_000, 1_500, 1_500)).toBe('active');
    expect(karaokeNoteTimingState(1_000, 1_500, 1_501)).toBe('idle');
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
    const expectedTime = karaokePitchScrubTime(4_000, -100, 940, 10_000);

    expect(onScrubStart).toHaveBeenCalledTimes(1);
    expect(onScrub).toHaveBeenLastCalledWith(expectedTime);
    expect(canvas).toHaveClass('is-scrubbing');

    fireTestPointer(canvas, 'pointerup', 7, 400);
    expect(onScrubEnd).toHaveBeenCalledWith(expectedTime);
    expect(canvas).not.toHaveClass('is-scrubbing');
  });

  it('joins timed syllables into complete display words', () => {
    expect(
      groupKaraokePitchWords([
        { text: 'jun', startMs: 0, endMs: 100, targetMidi: 60 },
        { text: 'gle', startMs: 100, endMs: 200, targetMidi: 62 },
        { text: ' friend', startMs: 200, endMs: 400, targetMidi: 64 },
      ]),
    ).toEqual([
      { text: 'jungle', startMs: 0, endMs: 200 },
      { text: 'friend', startMs: 200, endMs: 400 },
    ]);
  });

  it('matches each word span to all of its notes and melismas', () => {
    expect(
      groupKaraokePitchWords([
        {
          text: 'rou',
          startsWord: true,
          startMs: 0,
          endMs: 100,
          targetMidi: 60,
        },
        {
          text: 'nd',
          startsWord: false,
          startMs: 100,
          endMs: 240,
          targetMidi: 62,
        },
        {
          text: 'And',
          startsWord: true,
          startMs: 300,
          endMs: 400,
          targetMidi: 64,
        },
        {
          text: 'A',
          startsWord: true,
          startMs: 500,
          endMs: 600,
          targetMidi: 65,
        },
        {
          text: 'bout',
          startsWord: false,
          startMs: 600,
          endMs: 720,
          targetMidi: 67,
        },
        {
          text: '',
          startsWord: false,
          startMs: 720,
          endMs: 900,
          targetMidi: 67,
        },
      ]),
    ).toEqual([
      { text: 'round', startMs: 0, endMs: 240 },
      { text: 'And', startMs: 300, endMs: 400 },
      { text: 'About', startMs: 500, endMs: 900 },
    ]);
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

  it('explains how to start and exposes an accessible graph', () => {
    render(<KaraokePitchLane isActive analysisStatus="idle" playheadMs={0} />);

    expect(screen.getByRole('heading', { name: 'Pitch lane' })).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Live microphone pitch and target-note lane',
      }),
    ).toBeVisible();
    expect(
      screen.getByText('Turn on the microphone to see your pitch.'),
    ).toBeVisible();
  });

  it('shows a live note and identifies imported UltraStar targets', () => {
    const { container } = render(
      <KaraokePitchLane
        isActive
        analysisStatus="ready"
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

    expect(screen.getByText('A4')).toBeVisible();
    expect(screen.queryByText('Song note')).not.toBeInTheDocument();
    expect(screen.getByText('+0 ¢ · 440.0 Hz')).toBeVisible();
    expect(screen.getByText('singstar-xml')).toBeVisible();
    expect(
      container.querySelector('.karaoke-pitch__canvas canvas'),
    ).toBeVisible();
    expect(container.querySelector('.karaoke-pitch__syllables')).toBeNull();
    expect(
      screen.getByText(
        'Blue blocks are the song notes; the thin live curve is the pitch coming from your microphone.',
      ),
    ).toBeVisible();
  });

  it('offers the shared app-style microphone switch in the lane', () => {
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
    expect(turnOn).toHaveClass('button', 'small', 'subtle');
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
    expect(
      screen.getByRole('button', { name: 'Turn off mic' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.karaoke-pitch')).toHaveClass(
      'is-microphone-live',
    );
  });

  it('offers a melody-tone mode with its own volume control', () => {
    const onToggleMelodyTone = jest.fn();
    const onMelodyToneVolume = jest.fn();
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
    const { container, rerender } = render(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        playheadMs={1_000}
        target={target}
        onToggleMelodyTone={onToggleMelodyTone}
        onMelodyToneVolume={onMelodyToneVolume}
      />,
    );

    const enableTone = screen.getByRole('button', {
      name: 'Play melody guide tone',
    });
    expect(enableTone).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(enableTone);
    expect(onToggleMelodyTone).toHaveBeenCalledTimes(1);

    rerender(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        playheadMs={1_000}
        target={target}
        melodyToneEnabled
        melodyToneVolume={0.34}
        onToggleMelodyTone={onToggleMelodyTone}
        onMelodyToneVolume={onMelodyToneVolume}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Stop melody guide tone' }),
    ).toHaveAttribute('aria-pressed', 'true');
    const volume = screen.getByRole('slider', {
      name: 'Melody tone volume',
    });
    expect(volume).toHaveValue('0.34');
    fireEvent.change(volume, { target: { value: '0.5' } });
    expect(onMelodyToneVolume).toHaveBeenCalledWith(0.5);
    expect(container.querySelector('.karaoke-pitch')).toHaveClass(
      'is-melody-tone-enabled',
    );
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
    expect(
      screen.getByText(
        'Blue blocks are the song notes; the thin live curve is the pitch coming from your microphone.',
      ),
    ).toBeVisible();
  });
});
