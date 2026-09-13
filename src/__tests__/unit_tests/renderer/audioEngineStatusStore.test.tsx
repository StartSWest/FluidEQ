/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One answer about the engine for the whole window.
 *
 * Every component used to hold its own copy, starting from nothing on every
 * mount. The DSP page mounts each time its tab opens, so for the length of
 * main's reply — a helper run and a hash of the engine files — it believed no
 * engine was chosen and said "Library only" in amber over a rack that was
 * running on every output, while the shell beside it had known the answer
 * since launch.
 *
 * Main's replies are held back by hand here, so each case decides exactly
 * when an answer lands.
 */

import { act, render } from '@testing-library/react';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import { resetSystemDspChain } from '../../../renderer/dsp/systemChain';
import { getAudioEngineStatus } from '../../../renderer/utils/audioEngineApi';
import { notifyAudioEngineChanged } from '../../../renderer/utils/audioEngineEvents';
import {
  refreshAudioEngineStatus,
  resetAudioEngineStatus,
  useAudioEngineStatus,
} from '../../../renderer/utils/useAudioEngineStatus';

jest.mock('../../../renderer/utils/audioEngineApi', () => ({
  getAudioEngineStatus: jest.fn(),
}));

jest.mock('../../../renderer/dsp/systemChain', () => ({
  resetSystemDspChain: jest.fn(),
}));

const status = (engine: IAudioEngineStatus['engine']): IAudioEngineStatus => ({
  engine,
  apo: { installed: engine === 'apo' },
  fluid: { installed: engine === 'fluid', endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
});

interface IQuestion {
  answer: (next: IAudioEngineStatus) => void;
}

let questions: IQuestion[] = [];

/** Lands the answer to the question at `index`, and whatever it sets off. */
const answer = async (index: number, next: IAudioEngineStatus) => {
  await act(async () => {
    questions[index].answer(next);
  });
};

/** What a holder is showing now: the value of its latest render. */
const last = (seen: (IAudioEngineStatus | undefined)[]) =>
  seen[seen.length - 1];

/** A component holding the answer, and every value it rendered with. */
const Holder = ({ seen }: { seen: (IAudioEngineStatus | undefined)[] }) => {
  const { status: shown } = useAudioEngineStatus();
  seen.push(shown);
  return null;
};

beforeEach(() => {
  resetAudioEngineStatus();
  questions = [];
  jest.mocked(resetSystemDspChain).mockClear();
  jest.mocked(getAudioEngineStatus).mockImplementation(
    () =>
      new Promise<IAudioEngineStatus>((resolve) => {
        questions.push({ answer: resolve });
      }),
  );
});

describe('the engine status the window holds', () => {
  it('shows a page opened later the answer from its first frame', async () => {
    const first: (IAudioEngineStatus | undefined)[] = [];
    const { unmount } = render(<Holder seen={first} />);
    // POSITIVE CONTROL: before any answer there is nothing to show.
    expect(first).toEqual([undefined]);
    await answer(0, status('fluid'));
    expect(last(first)?.engine).toBe('fluid');
    unmount();

    const later: (IAudioEngineStatus | undefined)[] = [];
    render(<Holder seen={later} />);
    expect(later[0]?.engine).toBe('fluid');
    // Still asked again, so a change nobody announced is picked up.
    expect(questions).toHaveLength(2);
  });

  it('asks main once for holders that open together', () => {
    render(
      <>
        <Holder seen={[]} />
        <Holder seen={[]} />
        <Holder seen={[]} />
      </>,
    );
    expect(questions).toHaveLength(1);
  });

  it('asks once more after an answer that questions arrived during, not once per question', async () => {
    const seen: (IAudioEngineStatus | undefined)[] = [];
    render(<Holder seen={seen} />);
    act(() => {
      refreshAudioEngineStatus();
      refreshAudioEngineStatus();
      refreshAudioEngineStatus();
    });
    expect(questions).toHaveLength(1);

    await answer(0, status('apo'));
    // That answer may predate what prompted the questions.
    expect(questions).toHaveLength(2);
    await answer(1, status('fluid'));
    expect(questions).toHaveLength(2);
    expect(last(seen)?.engine).toBe('fluid');
  });

  it('does not redraw its holders for an answer that changed nothing', async () => {
    const seen: (IAudioEngineStatus | undefined)[] = [];
    render(<Holder seen={seen} />);
    await answer(0, status('fluid'));
    const drawn = seen.length;

    act(() => {
      refreshAudioEngineStatus();
    });
    await answer(1, status('fluid'));
    expect(seen).toHaveLength(drawn);

    // POSITIVE CONTROL: a different answer does redraw them.
    act(() => {
      refreshAudioEngineStatus();
    });
    await answer(2, status('apo'));
    expect(seen.length).toBeGreaterThan(drawn);
  });

  it('asks once per notification, however many components hold the answer', async () => {
    render(
      <>
        <Holder seen={[]} />
        <Holder seen={[]} />
        <Holder seen={[]} />
      </>,
    );
    await answer(0, status('apo'));
    act(() => notifyAudioEngineChanged());
    expect(questions).toHaveLength(2);
  });

  it('forgets the rack delivered to an engine once another one is running', async () => {
    render(<Holder seen={[]} />);
    await answer(0, status('apo'));
    expect(resetSystemDspChain).not.toHaveBeenCalled();

    act(() => {
      refreshAudioEngineStatus();
    });
    await answer(1, status('fluid'));
    expect(resetSystemDspChain).toHaveBeenCalledTimes(1);

    act(() => {
      refreshAudioEngineStatus();
    });
    await answer(2, status('fluid'));
    expect(resetSystemDspChain).toHaveBeenCalledTimes(1);
  });

  it('does not believe a reply to a question asked before a reset', async () => {
    const seen: (IAudioEngineStatus | undefined)[] = [];
    render(<Holder seen={seen} />);
    resetAudioEngineStatus();
    await answer(0, status('fluid'));
    expect(last(seen)).toBeUndefined();

    act(() => {
      refreshAudioEngineStatus();
    });
    await answer(1, status('apo'));
    expect(last(seen)?.engine).toBe('apo');
  });
});
