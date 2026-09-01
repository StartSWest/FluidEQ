/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graphs starting again when the engine comes back.
 *
 * The whole suite was green while the EQ spectrum sat frozen after every
 * refresh, and that is the fact this file exists to change. Nothing tested the
 * one property the panel depends on: a repaint loop that stops because there is
 * nothing to draw has to be startable by the ENGINE, not by a React render.
 *
 * The bug was that the only thing which re-armed it was a per-render redraw,
 * and an analysis frame arriving from IPC renders nothing — so the loop stopped
 * on mount, the host began publishing a moment later, and the spectrum stayed
 * dead until a control was moved. A refresh, an output change and an audio
 * driver restart all end in exactly that state, which is why one defect was
 * reported as three.
 *
 * Frames are driven by hand here rather than by jsdom's clock. A loop under
 * test must advance because the test said so and not because sixteen
 * milliseconds went by; anything else measures the machine.
 */
import fs from 'fs';
import path from 'path';
import {
  IGraphLoopFrame,
  startGraphLoop,
} from '../../../renderer/dsp/graphLoop';
import {
  IDspAnalyser,
  clearDspAnalysers,
  readDspAnalyser,
  readDspAnalysisLive,
  setDspAnalyser,
  subscribeDspAnalysers,
} from '../../../renderer/dsp/store';

/** Stands in for a `HostAnalyser`; only its identity matters here. */
const analyserStub = (marker: number): IDspAnalyser => ({
  frequencyBinCount: 1_024,
  getFloatFrequencyData: (target: Float32Array) => target.fill(marker),
});

const pending = new Map<number, FrameRequestCallback>();
let nextHandle = 1;
let realRequest: typeof window.requestAnimationFrame;
let realCancel: typeof window.cancelAnimationFrame;

/**
 * One animation frame: every callback pending when the frame began, and none
 * of the ones it goes on to request.
 *
 * Draining a snapshot rather than the live map is what makes a self-sustaining
 * loop advance one step per call instead of spinning until it stops.
 */
const runFrame = (): void => {
  const due = [...pending.values()];
  pending.clear();
  due.forEach((callback) => callback(0));
};

beforeEach(() => {
  clearDspAnalysers();
  pending.clear();
  nextHandle = 1;
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
  window.requestAnimationFrame = realRequest;
  window.cancelAnimationFrame = realCancel;
  clearDspAnalysers();
});

describe('the analyser slots announce who holds them', () => {
  it('tells a listener when a stage is registered and when it is given back', () => {
    const heard = jest.fn();
    const stop = subscribeDspAnalysers(heard);

    setDspAnalyser('eq', analyserStub(1));
    expect(heard).toHaveBeenCalledTimes(1);

    setDspAnalyser('eq', undefined);
    expect(heard).toHaveBeenCalledTimes(2);

    stop();
    setDspAnalyser('eq', analyserStub(2));
    expect(heard).toHaveBeenCalledTimes(2);
  });

  /**
   * The claim happens on every frame; the announcement must not.
   *
   * `nativeMeters` re-claims each slot on every analysis frame, because
   * anything else can be emptied underneath it. That is twenty-three claims a
   * second, and if each one woke every graph loop this mechanism would be a
   * cost on the frame path rather than a replacement for one.
   */
  it('says nothing when the same analyser is registered again', () => {
    const analyser = analyserStub(1);
    setDspAnalyser('eq', analyser);

    const heard = jest.fn();
    const stop = subscribeDspAnalysers(heard);
    setDspAnalyser('eq', analyser);
    setDspAnalyser('eq', analyser);
    expect(heard).not.toHaveBeenCalled();

    stop();
  });

  it('empties a slot rather than leaving it holding nothing', () => {
    setDspAnalyser('master', analyserStub(1));
    expect(readDspAnalysisLive()).toBe(true);

    setDspAnalyser('master', undefined);
    expect(readDspAnalyser('master')).toBeUndefined();
    expect(readDspAnalysisLive()).toBe(false);
  });

  /**
   * Any stage held is the signal, because most cards have no tap of their own.
   *
   * Denoise's tap goes quiet when the stage is bypassed, so a card gated on the
   * stage it belongs to would freeze while the engine ran on. `master` is the
   * output tap and is always among them while the engine is engaged.
   */
  it('reads as live while any one stage is held', () => {
    expect(readDspAnalysisLive()).toBe(false);
    setDspAnalyser('eq', analyserStub(1));
    setDspAnalyser('master', analyserStub(2));
    expect(readDspAnalysisLive()).toBe(true);

    setDspAnalyser('eq', undefined);
    expect(readDspAnalysisLive()).toBe(true);

    setDspAnalyser('master', undefined);
    expect(readDspAnalysisLive()).toBe(false);
  });

  it('announces a clear once, and stays quiet when there was nothing to clear', () => {
    setDspAnalyser('eq', analyserStub(1));
    setDspAnalyser('master', analyserStub(2));

    const heard = jest.fn();
    const stop = subscribeDspAnalysers(heard);
    clearDspAnalysers();
    expect(heard).toHaveBeenCalledTimes(1);

    clearDspAnalysers();
    expect(heard).toHaveBeenCalledTimes(1);

    stop();
  });
});

describe('a graph loop follows the engine', () => {
  it('paints once and stops while nothing is playing', () => {
    const painted = jest.fn();
    const loop = startGraphLoop(painted);

    // Armed by construction, not run: the first frame is still owed.
    expect(painted).not.toHaveBeenCalled();

    runFrame();
    expect(painted).toHaveBeenCalledTimes(1);

    runFrame();
    runFrame();
    expect(painted).toHaveBeenCalledTimes(1);

    loop.stop();
  });

  /**
   * THE REGRESSION. Everything else in this file supports this one case.
   *
   * No render happens between the loop stopping and the engine registering —
   * which is exactly the real sequence, because an analysis frame arrives on an
   * IPC callback and renders nothing. Before the registration was an event, the
   * third assertion here was 1 and the spectrum was dead until a knob moved.
   */
  it('starts again when the engine registers, with no render in between', () => {
    const painted = jest.fn();
    const loop = startGraphLoop(painted);
    runFrame();
    runFrame();
    expect(painted).toHaveBeenCalledTimes(1);

    setDspAnalyser('eq', analyserStub(1));

    runFrame();
    expect(painted).toHaveBeenCalledTimes(2);

    // And it keeps turning now, rather than needing a wake-up per frame.
    runFrame();
    runFrame();
    expect(painted).toHaveBeenCalledTimes(4);

    loop.stop();
  });

  it('keeps turning for a loop that started while the engine was already live', () => {
    setDspAnalyser('eq', analyserStub(1));
    const painted = jest.fn();
    const loop = startGraphLoop(painted);

    runFrame();
    runFrame();
    runFrame();
    expect(painted).toHaveBeenCalledTimes(3);

    loop.stop();
  });

  /**
   * A canvas the document has not laid out yet is not the engine's problem.
   *
   * Without this the graphs that mount inside a panel still being sized would
   * paint nothing, stop, and stay blank until audio started.
   */
  it('honours a frame the painter asks for while nothing is playing', () => {
    let needsLayout = true;
    const painted = jest.fn();
    const loop = startGraphLoop(({ schedule }: IGraphLoopFrame) => {
      painted();
      if (needsLayout) {
        schedule();
      }
    });

    runFrame();
    runFrame();
    runFrame();
    expect(painted).toHaveBeenCalledTimes(3);

    needsLayout = false;
    runFrame();
    expect(painted).toHaveBeenCalledTimes(4);

    runFrame();
    expect(painted).toHaveBeenCalledTimes(4);

    loop.stop();
  });

  it('gives one last frame when the engine lets go, then stops', () => {
    setDspAnalyser('eq', analyserStub(1));
    const painted = jest.fn();
    const loop = startGraphLoop(painted);
    runFrame();
    expect(painted).toHaveBeenCalledTimes(1);

    setDspAnalyser('eq', undefined);

    // One more frame, so the graph settles at rest rather than freezing on
    // whatever the host happened to send last. A live loop always has a frame
    // in flight, so this arrives whether or not the release re-arms it — what
    // is being pinned here is that it lands and that the loop then STOPS,
    // rather than idling at sixty frames a second over a silent chain.
    runFrame();
    expect(painted).toHaveBeenCalledTimes(2);

    runFrame();
    expect(painted).toHaveBeenCalledTimes(2);

    loop.stop();
  });
});

describe('a time strip empties rather than splicing two moments', () => {
  it('runs onEngineGone once, before the frame that redraws the strip', () => {
    setDspAnalyser('eq', analyserStub(1));
    const order: string[] = [];
    const loop = startGraphLoop(() => order.push('paint'), {
      onEngineGone: () => order.push('empty'),
    });
    runFrame();
    expect(order).toEqual(['paint']);

    setDspAnalyser('eq', undefined);
    runFrame();

    // Emptied first, so the frame that follows draws a strip with nothing in
    // it. The other way round paints the stale ring and then clears it, which
    // is a flash of the wrong picture.
    expect(order).toEqual(['paint', 'empty', 'paint']);

    loop.stop();
  });

  it('does not run onEngineGone when the engine arrives, or when it was never there', () => {
    const gone = jest.fn();
    const loop = startGraphLoop(() => undefined, { onEngineGone: gone });

    setDspAnalyser('eq', analyserStub(1));
    expect(gone).not.toHaveBeenCalled();

    setDspAnalyser('master', analyserStub(2));
    expect(gone).not.toHaveBeenCalled();

    // One stage of two going quiet is not the engine letting go.
    setDspAnalyser('eq', undefined);
    expect(gone).not.toHaveBeenCalled();

    setDspAnalyser('master', undefined);
    expect(gone).toHaveBeenCalledTimes(1);

    loop.stop();
  });

  it('lets go of its listener on stop, so a later engine cannot wake it', () => {
    const painted = jest.fn();
    const gone = jest.fn();
    const loop = startGraphLoop(painted, { onEngineGone: gone });
    runFrame();
    expect(painted).toHaveBeenCalledTimes(1);

    loop.stop();

    setDspAnalyser('eq', analyserStub(1));
    runFrame();
    setDspAnalyser('eq', undefined);
    runFrame();

    expect(painted).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();
  });

  it('cancels the frame it had pending when it is stopped', () => {
    const painted = jest.fn();
    const loop = startGraphLoop(painted);
    // Armed and not yet run, which is the frame `stop` has to take back.
    loop.stop();

    runFrame();
    expect(painted).not.toHaveBeenCalled();
  });
});

/**
 * The wiring, guarded at the source.
 *
 * The loop tests above cover the mechanism for every card at once, and that is
 * precisely the hole: they would all still pass with a graph quietly returned
 * to a hand-written `requestAnimationFrame(paint)` at the foot of its painter.
 * Eight files had drifted into two incompatible shapes that way once already.
 *
 * `check-styles.ts` polices the font-weight scale the same way, for the same
 * reason — some invariants are about which code exists, and no amount of
 * rendering will find them.
 */
describe('every graph in the rack is on the shared loop', () => {
  const GRAPHS: readonly string[] = [
    'DspBassForgeGraph',
    'DspBassPunchGraph',
    'DspDenoiseGraph',
    'DspDimensionGraph',
    'DspEqGraph',
    'DspExciterGraph',
    'DspMasterGraph',
    'DspMaximizerGraph',
  ];

  const sourceOf = (name: string): string =>
    fs.readFileSync(
      path.join(__dirname, '../../../renderer/dsp', `${name}.tsx`),
      'utf8',
    );

  it.each(GRAPHS)('%s can be woken by the engine', (name) => {
    // Either through the shared loop or, for the EQ curve, by subscribing
    // directly — what matters is that a registration reaches the canvas
    // without a render, because a host frame does not cause one.
    const source = sourceOf(name);
    const wakesOnRegistration =
      source.includes('startGraphLoop') ||
      source.includes('subscribeDspAnalysers');
    expect(wakesOnRegistration).toBe(true);
  });

  it.each(GRAPHS)('%s can still repaint on a render while idle', (name) => {
    // Stopping when nothing is playing is only safe because a knob can still
    // reach the canvas. `redraw?.()` on every render is the other half, and a
    // graph that loses it goes stale the moment the music does.
    expect(sourceOf(name)).toMatch(/redraw(\.current)?\?\.\(\)/);
  });
});
