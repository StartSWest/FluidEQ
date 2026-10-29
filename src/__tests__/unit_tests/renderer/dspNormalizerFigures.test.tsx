/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Normalizer's figures under the FluidEQ Engine arrive with every host
 * frame, twenty-three a second, as a new meter object each time — and the
 * stats row read it whole, so it redrew with each frame whether or not any
 * tenth of a decibel it shows had moved. Each figure now subscribes to its own
 * text. The control beside each null: a frame that does move a figure is
 * drawn at once.
 */

import '@testing-library/jest-dom';
import { Profiler } from 'react';
import { act, render, screen } from '@testing-library/react';
import { DspNormalizerStats } from 'renderer/dsp/DspNormalizerReadouts';
import { IDspNormalizerMeter, setDspNormalizerMeter } from 'renderer/dsp/store';

const frame = (
  overrides: Partial<IDspNormalizerMeter> = {},
): IDspNormalizerMeter => ({
  inputTruePeakDb: -3.2,
  inputLufs: -14.1,
  outputLufs: -16.4,
  levelState: 1,
  inputPeaks: [0.5, 0.5],
  outputPeaks: [0.4, 0.4],
  appliedGainDb: -2.3,
  ...overrides,
});

const showStats = () => {
  let renders = 0;
  render(
    <Profiler
      id="stats"
      onRender={() => {
        renders += 1;
      }}
    >
      <DspNormalizerStats isLive analysis={undefined} />
    </Profiler>,
  );
  return () => renders;
};

beforeEach(() => {
  act(() => setDspNormalizerMeter(frame()));
});

it('draws nothing for a host frame that moved none of its figures', () => {
  const renders = showStats();
  const before = renders();

  // The bars move with every frame; the figures below them did not.
  act(() =>
    setDspNormalizerMeter(
      frame({ inputPeaks: [0.6, 0.55], outputPeaks: [0.45, 0.42] }),
    ),
  );
  // A change under the tenth of a decibel each figure shows.
  act(() => setDspNormalizerMeter(frame({ appliedGainDb: -2.31 })));

  expect(renders()).toBe(before);
  expect(screen.getByText('-2.3 dB')).toBeInTheDocument();
});

it('draws a figure that did move, on the frame it moved', () => {
  const renders = showStats();
  const before = renders();

  act(() => setDspNormalizerMeter(frame({ appliedGainDb: -4.8 })));

  expect(renders()).toBe(before + 1);
  expect(screen.getByText('-4.8 dB')).toBeInTheDocument();
  expect(screen.getByText('-3.2 dBTP')).toBeInTheDocument();
});

it('labels the measured input and output loudness separately', () => {
  showStats();
  expect(
    screen.getByText('Input loudness (3 s)').parentElement,
  ).toHaveTextContent('-14.1 LUFS');
  expect(
    screen.getByText('Output loudness (3 s)').parentElement,
  ).toHaveTextContent('-16.4 LUFS');
});

it('updates output loudness independently of input loudness and gain', () => {
  const renders = showStats();
  const before = renders();
  act(() => setDspNormalizerMeter(frame({ outputLufs: -18.2 })));
  expect(renders()).toBe(before + 1);
  expect(screen.getByText('-18.2 LUFS')).toBeInTheDocument();
  expect(screen.getByText('-14.1 LUFS')).toBeInTheDocument();
  expect(screen.getByText('-2.3 dB')).toBeInTheDocument();
});

it('does not invent output LUFS for an older engine or an incomplete window', () => {
  act(() => setDspNormalizerMeter(frame({ outputLufs: undefined })));
  showStats();
  expect(
    screen.getByText('Output loudness (3 s)').parentElement,
  ).toHaveTextContent('—');
  act(() =>
    setDspNormalizerMeter(frame({ inputLufs: -120, outputLufs: -120 })),
  );
  expect(screen.queryByText('-120.0 LUFS')).not.toBeInTheDocument();
  expect(
    screen.getByText('Input loudness (3 s)').parentElement,
  ).toHaveTextContent('—');
});
