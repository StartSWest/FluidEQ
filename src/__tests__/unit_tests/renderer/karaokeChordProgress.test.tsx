/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chord guide's "Finding chords… 42%", and what it costs to move it.
 *
 * The percentage was state of the analysis hook, so every step of it — some
 * sixty in one song — re-rendered whatever held the hook, and that is the
 * whole karaoke workspace: playlist, stage and an open Maker, to change one
 * number. It is a live value now, read only by the percentage itself.
 */

import '@testing-library/jest-dom';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { IKaraokeSong } from '../../../common/karaoke/types';
import KaraokeChordGuide from '../../../renderer/karaoke/KaraokeChordGuide';
import { createKaraokeLiveValue } from '../../../renderer/karaoke/karaokeLiveValue';
import { useKaraokeChordAnalysis } from '../../../renderer/karaoke/useKaraokeChordAnalysis';

const PROGRESS_STEPS = 60;

jest.mock('../../../common/karaoke/chords', () => ({
  ...jest.requireActual('../../../common/karaoke/chords'),
  // The analysis itself is not what is measured: it reports its steps and
  // finds one chord.
  analyzeKaraokeChords: async (
    _samples: Float32Array,
    _rate: number,
    options: { onProgress?: (progress: number) => void } = {},
  ) => {
    for (let step = 1; step <= PROGRESS_STEPS; step += 1) {
      options.onProgress?.(step / PROGRESS_STEPS);
      // eslint-disable-next-line no-await-in-loop -- one step per turn, as the real one yields.
      await Promise.resolve();
    }
    return [
      {
        startMs: 0,
        endMs: 1_000,
        rootPitchClass: 0,
        quality: 'major',
        label: 'C',
        confidence: 0.9,
      },
    ];
  },
}));

/** Decodes anything to a second of silence. */
const FakeDecodingContext = jest.fn(() => {
  const samples = new Float32Array(11_025);
  return {
    decodeAudioData: () =>
      Promise.resolve({
        duration: 1,
        length: samples.length,
        numberOfChannels: 1,
        sampleRate: 11_025,
        getChannelData: () => samples,
      }),
    close: () => Promise.resolve(),
  };
});

const song: IKaraokeSong = {
  id: 'chord-song',
  title: 'Chord Song',
  assets: [
    {
      role: 'audio',
      file: {
        name: 'chord-song.mp3',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as File,
    },
  ] as IKaraokeSong['assets'],
  timingPrecision: 'line',
  lines: [],
  pitch: { kind: 'none', reason: 'missing' },
  meta: { sourceFormat: 'lrc', gapMs: 0 },
};

describe('chord analysis progress', () => {
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: FakeDecodingContext,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    });
  });

  it('moves the percentage without re-rendering whatever holds the analysis', async () => {
    let hostRenders = 0;
    const { result } = renderHook(() => {
      hostRenders += 1;
      return useKaraokeChordAnalysis(song, true);
    });
    const heard: number[] = [];
    const stopListening = result.current.progress.subscribe(() =>
      heard.push(result.current.progress.read()),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    stopListening();

    // The control: the percentage really did move, step by step, to the end.
    expect(heard.length).toBeGreaterThan(PROGRESS_STEPS / 2);
    expect(result.current.progress.read()).toBe(1);
    // Mounted, analysing, ready — and nothing for the steps between. It was
    // one render of the holder for every step.
    expect(hostRenders).toBeLessThan(6);
  });

  it('prints the percentage and follows it', () => {
    const progress = createKaraokeLiveValue(0.42);
    render(
      <KaraokeChordGuide
        status="analyzing"
        progress={progress}
        playheadMs={0}
        chords={[]}
      />,
    );
    expect(screen.getByText('Finding chords… 42%')).toBeVisible();

    act(() => progress.write(0.5));
    expect(screen.getByText('Finding chords… 50%')).toBeVisible();
  });
});
