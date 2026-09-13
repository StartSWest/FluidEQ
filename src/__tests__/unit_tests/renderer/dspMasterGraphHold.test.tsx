/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Master page's status chips holding an event, and letting it go.
 *
 * The hold was a `setTimeout` restarted on every change, which this project
 * does not allow, and which released an event that held one steady reading
 * while it was still happening. It is now measured: the last frame that
 * carried the event is stamped, and animation frames release the chip once
 * that stamp is old enough.
 *
 * Both clocks are driven by hand. Frames advance because the test runs one,
 * and time advances because the test moves it — a hold that passed here by
 * waiting would be measuring the machine.
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import en from '../../../common/i18n/en';
import DspMasterGraph from '../../../renderer/dsp/DspMasterGraph';
import {
  IDspOutputSafetyMeter,
  readDspOutputSafetyMeter,
  setDspOutputSafetyMeter,
} from '../../../renderer/dsp/store';

const pending = new Map<number, FrameRequestCallback>();
let nextHandle = 1;
let now = 10_000;
let realRequest: typeof window.requestAnimationFrame;
let realCancel: typeof window.cancelAnimationFrame;
let idleMeter: IDspOutputSafetyMeter;

/** Every callback pending when the frame began, and none it goes on to ask for. */
const runFrame = (): void => {
  const due = [...pending.values()];
  pending.clear();
  act(() => {
    due.forEach((callback) => callback(now));
  });
};

/** A host frame: the meter the engine would publish, with this reduction. */
const publish = (autoReductionDb: number): void => {
  act(() => {
    setDspOutputSafetyMeter({
      ...idleMeter,
      postFilterNormalizer: {
        gainReductionDb: autoReductionDb,
        inputTruePeakDb: -6,
      },
    });
  });
};

const fixedChip = (gain: string) =>
  en['dsp.master.graph.peakFixed'].replace('{gain}', gain);

beforeEach(() => {
  idleMeter = readDspOutputSafetyMeter();
  pending.clear();
  nextHandle = 1;
  now = 10_000;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  realRequest = window.requestAnimationFrame;
  realCancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    pending.set(handle, callback);
    return handle;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number) => {
    pending.delete(handle);
  }) as typeof window.cancelAnimationFrame;
});

afterEach(() => {
  act(() => setDspOutputSafetyMeter(idleMeter));
  window.requestAnimationFrame = realRequest;
  window.cancelAnimationFrame = realCancel;
  jest.restoreAllMocks();
});

const renderGraph = () =>
  render(
    <DspMasterGraph
      master={DSP_DEFAULTS.master}
      safetyEnabled
      loudnessGainDb={0}
    />,
  );

describe('the peak chip after the limiter lets go', () => {
  it('keeps saying what was fixed for the hold, then says the peak is safe', () => {
    renderGraph();
    publish(-3);
    expect(screen.getByText(fixedChip('3.0'))).toBeInTheDocument();

    // The reduction ends. The chip still reports it: it was a transient the
    // listener could not have read in the frames it lasted.
    now += 16;
    publish(0);
    runFrame();
    expect(screen.getByText(fixedChip('3.0'))).toBeInTheDocument();

    now += 2_400;
    runFrame();
    expect(screen.getByText(fixedChip('3.0'))).toBeInTheDocument();

    now += 100;
    runFrame();
    expect(
      screen.getByText(en['dsp.master.graph.peakSafe']),
    ).toBeInTheDocument();
    expect(screen.queryByText(fixedChip('3.0'))).not.toBeInTheDocument();
  });

  it('counts the hold from the LAST frame that carried the event', () => {
    renderGraph();
    publish(-3);

    // One steady reading for two seconds. The timer only restarted when a
    // reading changed, so this used to be released while still happening.
    for (let frame = 0; frame < 20; frame += 1) {
      now += 100;
      publish(-3);
      runFrame();
    }
    now += 16;
    publish(0);

    now += 2_000;
    runFrame();
    expect(screen.getByText(fixedChip('3.0'))).toBeInTheDocument();

    now += 600;
    runFrame();
    expect(
      screen.getByText(en['dsp.master.graph.peakSafe']),
    ).toBeInTheDocument();
  });

  it('releases on animation frames alone once the engine stops publishing', () => {
    renderGraph();
    publish(-3);
    now += 16;
    publish(0);

    // No host frames from here on. The countdown asks for its own frames, so
    // the chip clears on time regardless.
    for (let frame = 0; frame < 30; frame += 1) {
      now += 100;
      runFrame();
    }
    expect(
      screen.getByText(en['dsp.master.graph.peakSafe']),
    ).toBeInTheDocument();
  });

  it('holds the DC chip the same way', () => {
    renderGraph();
    const dcChip = en['dsp.master.graph.dcFixed'].replace(
      '{amount}',
      '-40.0 dBFS',
    );
    act(() => setDspOutputSafetyMeter({ ...idleMeter, dcCorrectionDb: -40 }));
    expect(screen.getByText(dcChip)).toBeInTheDocument();

    now += 16;
    act(() => setDspOutputSafetyMeter({ ...idleMeter, dcCorrectionDb: -120 }));
    now += 2_400;
    runFrame();
    expect(screen.getByText(dcChip)).toBeInTheDocument();

    now += 200;
    runFrame();
    expect(
      screen.getByText(en['dsp.master.graph.dcClean']),
    ).toBeInTheDocument();
  });

  it('moves in half-decibel steps while the limiter keeps working', () => {
    renderGraph();
    publish(-3);
    now += 16;
    publish(-3.3);
    expect(screen.getByText(fixedChip('3.0'))).toBeInTheDocument();

    now += 16;
    publish(-3.6);
    expect(screen.getByText(fixedChip('3.6'))).toBeInTheDocument();
  });
});
